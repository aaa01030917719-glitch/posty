import 'server-only'

import { getTaskDetail, listTaskMessages, ManusApiError } from '@/lib/manus/client'
import type { ReferenceAnalysisResult } from '@/lib/manus/reference-analysis-contract'
import {
  finalizeManusReferenceResult,
  findStructuredOutputResult,
} from './manus-result-finalizer'

type AdminClient = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

type ManusJob = {
  id: string
  user_id: string
  reference_id: string
  manus_task_id: string
  submitted_at: string | null
  attempt_count: number
  max_attempts: number
}

function safeTaskNotFound(error: unknown) {
  return error instanceof ManusApiError &&
    (error.status === 404 || error.message.toLowerCase().includes('task not found'))
}

function safeStopReason(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const task = data.task && typeof data.task === 'object'
    ? data.task as Record<string, unknown>
    : null
  const taskDetail = data.task_detail && typeof data.task_detail === 'object'
    ? data.task_detail as Record<string, unknown>
    : null
  const stopReason = data.stop_reason ?? taskDetail?.stop_reason ?? task?.stop_reason

  return typeof stopReason === 'string' ? stopReason : null
}

function eventType(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const type = data.event_type ?? data.type

  return typeof type === 'string' ? type : null
}

function structuredOutputFromWebhookPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const taskDetail = data.task_detail && typeof data.task_detail === 'object'
    ? data.task_detail as Record<string, unknown>
    : null
  const structuredOutput = taskDetail?.structured_output ?? data.structured_output

  if (!structuredOutput || typeof structuredOutput !== 'object') return null

  const result = structuredOutput as {
    success?: boolean
    value?: ReferenceAnalysisResult
    error?: string | null
  }

  return result.success === true && result.value ? result : null
}

async function findJobByTaskId(admin: AdminClient, manusTaskId: string) {
  const { data, error } = await admin
    .from('reference_analysis_jobs')
    .select('id,user_id,reference_id,manus_task_id,submitted_at,attempt_count,max_attempts')
    .eq('manus_task_id', manusTaskId)
    .in('status', ['submitted', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error('manus_job_lookup_failed')

  return data as ManusJob | null
}

async function markPolled(admin: AdminClient, jobId: string, detailStatus?: string | null, creditUsage?: number | null) {
  await admin
    .from('reference_analysis_jobs')
    .update({
      last_polled_at: new Date().toISOString(),
      task_detail_status: detailStatus ?? null,
      credit_usage: creditUsage ?? null,
      credits_used: creditUsage ?? null,
    })
    .eq('id', jobId)
}

async function completeFromTask(admin: AdminClient, job: ManusJob) {
  let detailStatus: string | null = null
  let creditUsage: number | null = null

  try {
    const detail = await getTaskDetail(job.manus_task_id)
    detailStatus = detail.task?.status ?? null
    creditUsage = detail.task?.credit_usage ?? null
    await markPolled(admin, job.id, detailStatus, creditUsage)

    if (detailStatus === 'error') {
      await admin
        .from('reference_analysis_jobs')
        .update({
          status: 'failed',
          failure_code: 'manus_task_error',
          failure_reason: 'task.detail returned error status.',
        })
        .eq('id', job.id)
      return { status: 'failed', reason: 'task_detail_error' }
    }
  } catch (error) {
    if (safeTaskNotFound(error)) {
      await markPolled(admin, job.id)
      return { status: 'transient', reason: 'task_not_found' }
    }

    throw error
  }

  const messages = await listTaskMessages(job.manus_task_id)
  const structured = findStructuredOutputResult((messages.messages ?? []) as Array<Record<string, unknown>>)

  if (structured?.success === true && structured.value) {
    const finalized = await finalizeManusReferenceResult({
      admin,
      jobId: job.id,
      userId: job.user_id,
      referenceId: job.reference_id,
      manusTaskId: job.manus_task_id,
      result: structured.value as ReferenceAnalysisResult,
      structuredOutputSuccess: true,
      taskDetailCreditUsage: creditUsage,
      rawResult: structured as unknown as Record<string, unknown>,
    })

    return { status: 'completed', ...finalized }
  }

  if (detailStatus === 'stopped') {
    await admin
      .from('reference_analysis_jobs')
      .update({
        status: 'completed_with_extraction_error',
        completed_at: new Date().toISOString(),
        failure_code: 'structured_output_missing',
        failure_reason: 'Task stopped but structured_output_result was missing or unsuccessful.',
      })
      .eq('id', job.id)

    await admin
      .from('references')
      .update({ analysis_status: 'partial' })
      .eq('id', job.reference_id)
      .eq('user_id', job.user_id)

    return { status: 'partial', reason: 'structured_output_missing' }
  }

  return { status: 'pending', detailStatus }
}

export async function processManusWebhookPayload({
  admin,
  payload,
  manusTaskId,
}: {
  admin: AdminClient
  payload: unknown
  manusTaskId: string | null
}) {
  if (!manusTaskId) return { status: 'ignored', reason: 'task_id_missing' }

  const job = await findJobByTaskId(admin, manusTaskId)
  if (!job) return { status: 'ignored', reason: 'job_not_found' }

  const type = eventType(payload)
  const stopReason = safeStopReason(payload)

  if (type === 'task_created') {
    await admin
      .from('reference_analysis_jobs')
      .update({ status: 'submitted' })
      .eq('id', job.id)
    return { status: 'acknowledged', eventType: type }
  }

  if (type === 'task_stopped' && stopReason === 'ask') {
    await admin
      .from('reference_analysis_jobs')
      .update({
        status: 'completed_with_extraction_error',
        webhook_stop_reason: stopReason,
        failure_code: 'manus_task_waiting_for_input',
        failure_reason: 'Manus task asked for interactive input; automated workflow does not continue it.',
      })
      .eq('id', job.id)
    return { status: 'partial', reason: 'ask_stop_reason' }
  }

  if (type === 'task_stopped' || stopReason === 'finish') {
    await admin
      .from('reference_analysis_jobs')
      .update({ webhook_stop_reason: stopReason })
      .eq('id', job.id)

    const webhookStructured = structuredOutputFromWebhookPayload(payload)
    if (webhookStructured) {
      let creditUsage: number | null = null
      try {
        const detail = await getTaskDetail(job.manus_task_id)
        creditUsage = detail.task?.credit_usage ?? null
        await markPolled(admin, job.id, detail.task?.status ?? null, creditUsage)
      } catch (error) {
        if (!safeTaskNotFound(error)) throw error
      }

      const finalized = await finalizeManusReferenceResult({
        admin,
        jobId: job.id,
        userId: job.user_id,
        referenceId: job.reference_id,
        manusTaskId: job.manus_task_id,
        result: webhookStructured.value as ReferenceAnalysisResult,
        structuredOutputSuccess: true,
        taskDetailCreditUsage: creditUsage,
        rawResult: webhookStructured as unknown as Record<string, unknown>,
      })

      return { status: 'completed', source: 'webhook_payload', ...finalized }
    }

    return completeFromTask(admin, job)
  }

  return { status: 'acknowledged', eventType: type }
}

export async function reconcileSubmittedManusJobs() {
  const admin = (await import('@/lib/supabase/admin')).createAdminClient()
  const { data, error } = await admin
    .from('reference_analysis_jobs')
    .select('id,user_id,reference_id,manus_task_id,submitted_at,attempt_count,max_attempts')
    .in('status', ['submitted', 'processing'])
    .not('manus_task_id', 'is', null)
    .order('submitted_at', { ascending: true })
    .limit(5)

  if (error) throw new Error('manus_reconcile_lookup_failed')

  const results = []
  for (const job of (data ?? []) as ManusJob[]) {
    results.push({ jobId: job.id, ...(await completeFromTask(admin, job)) })
  }

  return { processed: results.length, results }
}
