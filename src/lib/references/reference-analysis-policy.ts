import 'server-only'

export const REFERENCE_ANALYSIS_TIMEZONE = 'Asia/Seoul'
export const REFERENCE_ANALYSIS_ESTIMATED_CREDITS = {
  min: 35,
  max: 157,
} as const

export const ACTIVE_REFERENCE_ANALYSIS_JOB_STATUSES = [
  'queued',
  'processing',
  'submitted',
  'retry_scheduled',
] as const

export type ReferenceAnalysisSettings = {
  user_id: string
  is_auto_analysis_paused: boolean
  daily_submission_limit: number
  timezone: string
  estimated_credit_min: number
  estimated_credit_max: number
}

type AdminClient = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

function normalizeSettings(
  userId: string,
  settings: Partial<ReferenceAnalysisSettings> | null | undefined
): ReferenceAnalysisSettings {
  const dailyLimit = Number(settings?.daily_submission_limit)
  const minCredits = Number(settings?.estimated_credit_min)
  const maxCredits = Number(settings?.estimated_credit_max)

  return {
    user_id: userId,
    is_auto_analysis_paused: settings?.is_auto_analysis_paused ?? true,
    daily_submission_limit:
      Number.isInteger(dailyLimit) && dailyLimit >= 1 && dailyLimit <= 100
        ? dailyLimit
        : 5,
    timezone: REFERENCE_ANALYSIS_TIMEZONE,
    estimated_credit_min:
      Number.isInteger(minCredits) && minCredits >= 0
        ? minCredits
        : REFERENCE_ANALYSIS_ESTIMATED_CREDITS.min,
    estimated_credit_max:
      Number.isInteger(maxCredits) && maxCredits >= minCredits
        ? maxCredits
        : REFERENCE_ANALYSIS_ESTIMATED_CREDITS.max,
  }
}

export function getReferenceAnalysisDayRange(now = new Date()) {
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffsetMs)
  const startUtcMs =
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) -
    kstOffsetMs
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000

  return {
    timezone: REFERENCE_ANALYSIS_TIMEZONE,
    start: new Date(startUtcMs).toISOString(),
    end: new Date(endUtcMs).toISOString(),
  }
}

export async function getReferenceAnalysisSettings(
  admin: AdminClient,
  userId: string
) {
  const { data, error } = await admin
    .from('reference_analysis_settings')
    .select(`
      user_id,
      is_auto_analysis_paused,
      daily_submission_limit,
      timezone,
      estimated_credit_min,
      estimated_credit_max
    `)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error('reference_analysis_settings_lookup_failed')
  }

  return {
    settings: normalizeSettings(userId, data as ReferenceAnalysisSettings | null),
    exists: Boolean(data),
  }
}

export async function getSubmittedAnalysisCountForToday(
  admin: AdminClient,
  userId: string,
  now = new Date()
) {
  const range = getReferenceAnalysisDayRange(now)
  const { count, error } = await admin
    .from('reference_analysis_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('submitted_at', range.start)
    .lt('submitted_at', range.end)

  if (error) {
    throw new Error('reference_analysis_submission_count_failed')
  }

  return {
    count: count ?? 0,
    range,
  }
}

export async function getReferenceAnalysisPolicyState(
  admin: AdminClient,
  userId: string,
  now = new Date()
) {
  const [{ settings, exists }, submitted] = await Promise.all([
    getReferenceAnalysisSettings(admin, userId),
    getSubmittedAnalysisCountForToday(admin, userId, now),
  ])

  const dailyLimitReached = submitted.count >= settings.daily_submission_limit

  return {
    settings,
    settingsExists: exists,
    submittedToday: submitted.count,
    dayRange: submitted.range,
    dailyLimitReached,
    automaticBlockStatus: settings.is_auto_analysis_paused
      ? 'auto_analysis_paused'
      : dailyLimitReached
        ? 'daily_submission_limit_reached'
        : null,
    estimatedCredits: {
      min: settings.estimated_credit_min,
      max: settings.estimated_credit_max,
    },
  }
}
