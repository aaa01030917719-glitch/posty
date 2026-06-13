import 'server-only'

import { createReferenceAnalysisTask, ManusApiError } from '@/lib/manus/client'
import {
  ACTIVE_REFERENCE_ANALYSIS_JOB_STATUSES,
  getReferenceAnalysisPolicyState,
} from '@/lib/references/reference-analysis-policy'

type AdminClient = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

type ManualSubmissionSource = 'manual' | 'manual_reanalyze'
type ManualJobType = 'manual' | 'manual_reanalyze'

type ReferenceForAnalysis = {
  id: string
  user_id: string
  canonical_url: string
  platform: string
  title: string | null
  latest_analysis_id: string | null
  analysis_status: string
}

type ActiveJob = {
  id: string
  status: string
  manus_task_id: string | null
  manus_task_url: string | null
  submission_source: string | null
}

export class ManualReferenceAnalysisError extends Error {
  code: string
  status: number

  constructor(code: string, status: number, message = code) {
    super(message)
    this.name = 'ManualReferenceAnalysisError'
    this.code = code
    this.status = status
  }
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

async function getReferenceForAnalysis(
  admin: AdminClient,
  userId: string,
  referenceId: string
) {
  const { data, error } = await admin
    .from('references')
    .select('id,user_id,canonical_url,platform,title,latest_analysis_id,analysis_status')
    .eq('id', referenceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new ManualReferenceAnalysisError('reference_lookup_failed', 500)
  }

  if (!data) {
    throw new ManualReferenceAnalysisError('reference_not_found', 404)
  }

  return data as ReferenceForAnalysis
}

async function getActiveJob(admin: AdminClient, userId: string, referenceId: string) {
  const { data, error } = await admin
    .from('reference_analysis_jobs')
    .select('id,status,manus_task_id,manus_task_url,submission_source')
    .eq('user_id', userId)
    .eq('reference_id', referenceId)
    .in('status', [...ACTIVE_REFERENCE_ANALYSIS_JOB_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ManualReferenceAnalysisError('analysis_job_lookup_failed', 500)
  }

  return data as ActiveJob | null
}

async function createManualJob(input: {
  admin: AdminClient
  userId: string
  referenceId: string
  jobType: ManualJobType
  submissionSource: ManualSubmissionSource
  priority: number
}) {
  const { data, error } = await input.admin
    .from('reference_analysis_jobs')
    .insert({
      user_id: input.userId,
      reference_id: input.referenceId,
      job_type: input.jobType,
      status: 'queued',
      priority: input.priority,
      is_auto_submit_allowed: false,
      submission_source: input.submissionSource,
    })
    .select('id,status,manus_task_id,manus_task_url,submission_source')
    .single()

  if (error) {
    if (error.code === '23505') {
      return getActiveJob(input.admin, input.userId, input.referenceId)
    }

    throw new ManualReferenceAnalysisError('analysis_job_insert_failed', 500)
  }

  return data as ActiveJob
}

async function claimJob(admin: AdminClient, jobId: string) {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('reference_analysis_jobs')
    .update({
      status: 'processing',
      locked_at: now,
      locked_by: `posty-manual-reference-${Date.now()}`,
    })
    .eq('id', jobId)
    .in('status', ['queued', 'retry_scheduled'])
    .is('manus_task_id', null)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new ManualReferenceAnalysisError('analysis_job_claim_failed', 500)
  }

  return Boolean(data)
}

async function markReferenceQueued(admin: AdminClient, userId: string, referenceId: string) {
  await admin
    .from('references')
    .update({ analysis_status: 'processing' })
    .eq('id', referenceId)
    .eq('user_id', userId)
}

export async function submitManualReferenceAnalysis(input: {
  admin: AdminClient
  userId: string
  referenceId: string
  confirmCost: boolean
  allowCompletedAnalysis: boolean
  jobType: ManualJobType
  submissionSource: ManualSubmissionSource
  priority: number
}) {
  if (!input.confirmCost) {
    throw new ManualReferenceAnalysisError('cost_confirmation_required', 400)
  }

  const reference = await getReferenceForAnalysis(
    input.admin,
    input.userId,
    input.referenceId
  )

  if (reference.platform !== 'instagram_reel') {
    throw new ManualReferenceAnalysisError('unsupported_reference_platform', 400)
  }

  if (!input.allowCompletedAnalysis && reference.latest_analysis_id) {
    throw new ManualReferenceAnalysisError('analysis_already_completed', 409)
  }

  const policy = await getReferenceAnalysisPolicyState(input.admin, input.userId)

  if (policy.dailyLimitReached) {
    throw new ManualReferenceAnalysisError('daily_submission_limit_reached', 429)
  }

  const existingJob = await getActiveJob(input.admin, input.userId, input.referenceId)
  const job = existingJob ?? await createManualJob({
    admin: input.admin,
    userId: input.userId,
    referenceId: input.referenceId,
    jobType: input.jobType,
    submissionSource: input.submissionSource,
    priority: input.priority,
  })

  if (!job) {
    throw new ManualReferenceAnalysisError('analysis_job_unavailable', 409)
  }

  if (job.manus_task_id || job.status === 'submitted') {
    return {
      ok: true,
      referenceId: reference.id,
      jobId: job.id,
      status: 'already_submitted',
      estimatedCredits: policy.estimatedCredits,
    }
  }

  const claimed = await claimJob(input.admin, job.id)

  if (!claimed) {
    return {
      ok: true,
      referenceId: reference.id,
      jobId: job.id,
      status: 'in_progress',
      estimatedCredits: policy.estimatedCredits,
    }
  }

  try {
    const task = await createReferenceAnalysisTask({
      sourceUrl: reference.canonical_url,
      title: reference.title,
    })

    if (!task.taskId) {
      throw new Error('manus_task_id_missing')
    }

    const { error: submitUpdateError } = await input.admin
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
      .eq('user_id', input.userId)

    if (submitUpdateError) {
      await input.admin
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
        .eq('user_id', input.userId)

      throw new ManualReferenceAnalysisError('manual_reconcile_required', 500)
    }

    await markReferenceQueued(input.admin, input.userId, reference.id)

    return {
      ok: true,
      referenceId: reference.id,
      jobId: job.id,
      status: 'submitted',
      estimatedCredits: policy.estimatedCredits,
    }
  } catch (error) {
    if (error instanceof ManualReferenceAnalysisError) throw error

    const failure = safeFailure(error)
    await input.admin
      .from('reference_analysis_jobs')
      .update({
        status: 'failed',
        failure_code: failure.code,
        failure_reason: failure.reason,
      })
      .eq('id', job.id)
      .eq('user_id', input.userId)

    throw new ManualReferenceAnalysisError(failure.code, 502, failure.reason)
  }
}
