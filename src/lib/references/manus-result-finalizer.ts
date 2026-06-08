import 'server-only'

import {
  getReferenceAnalysisStatus,
  REFERENCE_ANALYSIS_SCHEMA_VERSION,
  type ReferenceAnalysisResult,
} from '@/lib/manus/reference-analysis-contract'

type AdminClient = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

export type FinalizeManusResultInput = {
  admin: AdminClient
  jobId: string
  userId: string
  referenceId: string
  manusTaskId: string
  result: ReferenceAnalysisResult
  structuredOutputSuccess: boolean
  taskDetailCreditUsage?: number | null
  rawResult?: Record<string, unknown>
}

function safeRawResult(rawResult: Record<string, unknown> | undefined) {
  if (!rawResult) return {}

  return JSON.parse(JSON.stringify(rawResult, (key, value) => {
    if (typeof value === 'string' && /https?:\/\/.*(signature|token|expires|X-Amz)/i.test(value)) {
      return '[redacted-url]'
    }

    if (/authorization|api[-_]?key|signature/i.test(key)) return '[redacted]'

    return value
  })) as Record<string, unknown>
}

export async function finalizeManusReferenceResult(input: FinalizeManusResultInput) {
  const status = getReferenceAnalysisStatus(input.result)
  const now = new Date().toISOString()
  const creditsUsed = input.taskDetailCreditUsage ?? null
  const { data: existingAnalysis, error: existingError } = await input.admin
    .from('reference_analyses')
    .select('id')
    .eq('manus_task_id', input.manusTaskId)
    .eq('reference_id', input.referenceId)
    .maybeSingle()

  if (existingError) {
    throw new Error('reference_analysis_lookup_failed')
  }

  if (existingAnalysis) {
    await input.admin
      .from('references')
      .update({
        latest_analysis_id: existingAnalysis.id,
        analysis_status: status,
      })
      .eq('id', input.referenceId)
      .eq('user_id', input.userId)

    await input.admin
      .from('reference_analysis_jobs')
      .update({
        status: status === 'partial' ? 'completed_with_extraction_error' : 'completed',
        completed_at: now,
        credit_usage: creditsUsed,
        credits_used: creditsUsed,
        failure_code: null,
        failure_reason: null,
      })
      .eq('id', input.jobId)
      .eq('user_id', input.userId)

    return { analysisId: existingAnalysis.id as string, analysisStatus: status, duplicate: true }
  }

  const { data: analysis, error: insertError } = await input.admin
    .from('reference_analyses')
    .insert({
      user_id: input.userId,
      reference_id: input.referenceId,
      analysis_job_id: input.jobId,
      provider: 'manus',
      schema_version: REFERENCE_ANALYSIS_SCHEMA_VERSION,
      transcript: input.result.transcript,
      captions: input.result.captions,
      viral_factors: input.result.viral_factors,
      business_use_points: input.result.business_use_points,
      content_angles: input.result.content_angles,
      risk_notes: input.result.risk_notes,
      raw_result: safeRawResult(input.rawResult),
      access_status: input.result.access_status,
      access_notes: input.result.access_notes,
      audio_access_status: input.result.audio_access_status,
      audio_access_notes: input.result.audio_access_notes,
      transcript_source: input.result.transcript_source,
      transcript_confidence: input.result.transcript_confidence,
      structured_output_success: input.structuredOutputSuccess,
      credits_used: creditsUsed,
      manus_task_id: input.manusTaskId,
      completed_at: now,
    })
    .select('id')
    .single()

  if (insertError?.code === '23505') {
    const { data: racedAnalysis } = await input.admin
      .from('reference_analyses')
      .select('id')
      .eq('manus_task_id', input.manusTaskId)
      .eq('reference_id', input.referenceId)
      .maybeSingle()

    if (racedAnalysis) {
      await input.admin
        .from('references')
        .update({
          latest_analysis_id: racedAnalysis.id,
          analysis_status: status,
        })
        .eq('id', input.referenceId)
        .eq('user_id', input.userId)

      await input.admin
        .from('reference_analysis_jobs')
        .update({
          status: status === 'partial' ? 'completed_with_extraction_error' : 'completed',
          completed_at: now,
          credit_usage: creditsUsed,
          credits_used: creditsUsed,
          failure_code: null,
          failure_reason: null,
        })
        .eq('id', input.jobId)
        .eq('user_id', input.userId)

      return { analysisId: racedAnalysis.id as string, analysisStatus: status, duplicate: true }
    }
  }

  if (insertError || !analysis) {
    throw new Error('reference_analysis_insert_failed')
  }

  const { error: referenceError } = await input.admin
    .from('references')
    .update({
      latest_analysis_id: analysis.id,
      analysis_status: status,
    })
    .eq('id', input.referenceId)
    .eq('user_id', input.userId)

  if (referenceError) {
    throw new Error('reference_analysis_status_update_failed')
  }

  const { error: jobError } = await input.admin
    .from('reference_analysis_jobs')
    .update({
      status: status === 'partial' ? 'completed_with_extraction_error' : 'completed',
      completed_at: now,
      credit_usage: creditsUsed,
      credits_used: creditsUsed,
      failure_code: null,
      failure_reason: null,
    })
    .eq('id', input.jobId)
    .eq('user_id', input.userId)

  if (jobError) {
    throw new Error('reference_analysis_job_complete_failed')
  }

  return { analysisId: analysis.id as string, analysisStatus: status }
}

export function findStructuredOutputResult(messages: Array<Record<string, unknown>>) {
  for (const message of messages) {
    const candidate = message.structured_output_result
    if (candidate && typeof candidate === 'object') {
      const result = candidate as {
        success?: boolean
        value?: ReferenceAnalysisResult
        error?: string | null
      }
      if (result.success === true && result.value) {
        return result
      }
    }
  }

  return null
}
