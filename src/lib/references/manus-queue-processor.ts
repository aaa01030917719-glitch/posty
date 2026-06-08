import 'server-only'

import { createReferenceAnalysisTask, getReferencesQueueBatchSize, ManusApiError } from '@/lib/manus/client'
import { createAdminClient } from '@/lib/supabase/admin'

type QueueJob = {
  id: string
  user_id: string
  reference_id: string
  attempt_count: number
  max_attempts: number
  manus_task_id: string | null
  references: {
    canonical_url: string
    platform: string
    title: string | null
  } | Array<{
    canonical_url: string
    platform: string
    title: string | null
  }> | null
}

const BACKOFF_MINUTES = [2, 5, 15, 60]

function referenceForJob(job: QueueJob) {
  if (Array.isArray(job.references)) return job.references[0] ?? null

  return job.references
}

function nextBackoff(attemptCount: number) {
  const minutes = BACKOFF_MINUTES[Math.max(0, Math.min(attemptCount - 1, BACKOFF_MINUTES.length - 1))]
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

function safeFailure(error: unknown) {
  if (error instanceof ManusApiError) {
    return { code: error.code, reason: error.message.slice(0, 500) }
  }

  if (error instanceof Error) {
    return { code: 'reference_analysis_submit_failed', reason: error.message.slice(0, 500) }
  }

  return { code: 'reference_analysis_submit_failed', reason: 'Unknown submission failure.' }
}

export async function processReferenceAnalysisQueue() {
  const admin = createAdminClient()
  const batchSize = getReferencesQueueBatchSize()
  const now = new Date().toISOString()
  const lockedBy = `posty-reference-worker-${Date.now()}`
  const results: Array<{ jobId: string; status: string; error?: string }> = []

  const { data: jobs, error: lookupError } = await admin
    .from('reference_analysis_jobs')
    .select(`
      id,
      user_id,
      reference_id,
      attempt_count,
      max_attempts,
      manus_task_id,
      references (
        canonical_url,
        platform,
        title
      )
    `)
    .in('status', ['queued', 'retry_scheduled'])
    .or(`available_at.is.null,available_at.lte.${now}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (lookupError) {
    throw new Error('reference_queue_lookup_failed')
  }

  for (const job of (jobs ?? []) as unknown as QueueJob[]) {
    const { data: claimed, error: claimError } = await admin
      .from('reference_analysis_jobs')
      .update({
        status: 'processing',
        locked_at: now,
        locked_by: lockedBy,
        attempt_count: job.attempt_count + 1,
      })
      .eq('id', job.id)
      .in('status', ['queued', 'retry_scheduled'])
      .is('manus_task_id', null)
      .select('id')
      .maybeSingle()

    if (claimError) {
      results.push({ jobId: job.id, status: 'claim_error', error: 'claim_failed' })
      continue
    }

    if (!claimed) {
      results.push({ jobId: job.id, status: 'skipped' })
      continue
    }

    const reference = referenceForJob(job)

    if (!reference || reference.platform !== 'instagram_reel') {
      await admin
        .from('reference_analysis_jobs')
        .update({
          status: 'failed',
          failure_code: 'unsupported_reference_platform',
          failure_reason: 'Only instagram_reel references are submitted to Manus in the MVP.',
        })
        .eq('id', job.id)
      results.push({ jobId: job.id, status: 'failed', error: 'unsupported_reference_platform' })
      continue
    }

    try {
      const task = await createReferenceAnalysisTask({
        sourceUrl: reference.canonical_url,
        title: reference.title,
      })

      if (!task.taskId) {
        throw new Error('manus_task_id_missing')
      }

      const { error: submitUpdateError } = await admin
        .from('reference_analysis_jobs')
        .update({
          status: 'submitted',
          manus_task_id: task.taskId,
          manus_task_url: task.taskUrl,
          manus_request_id: task.requestId,
          task_create_request_id: task.requestId,
          submitted_at: new Date().toISOString(),
          failure_code: null,
          failure_reason: null,
        })
        .eq('id', job.id)

      if (submitUpdateError) {
        await admin
          .from('reference_analysis_jobs')
          .update({
            status: 'failed',
            manus_task_id: task.taskId,
            manus_task_url: task.taskUrl,
            manus_request_id: task.requestId,
            task_create_request_id: task.requestId,
            failure_code: 'manual_reconcile_required',
            failure_reason: 'Manus task was created, but Posty could not save the submitted state automatically.',
          })
          .eq('id', job.id)

        results.push({ jobId: job.id, status: 'failed', error: 'manual_reconcile_required' })
        continue
      }

      await admin
        .from('references')
        .update({ analysis_status: 'processing' })
        .eq('id', job.reference_id)
        .eq('user_id', job.user_id)

      results.push({ jobId: job.id, status: 'submitted' })
    } catch (error) {
      const failure = safeFailure(error)
      const attemptCount = job.attempt_count + 1
      const exhausted = attemptCount >= job.max_attempts
      await admin
        .from('reference_analysis_jobs')
        .update({
          status: exhausted ? 'failed' : 'retry_scheduled',
          available_at: exhausted ? null : nextBackoff(attemptCount),
          failure_code: failure.code,
          failure_reason: failure.reason,
        })
        .eq('id', job.id)

      results.push({ jobId: job.id, status: exhausted ? 'failed' : 'retry_scheduled', error: failure.code })
    }
  }

  return { processed: results.length, results }
}
