import { NextResponse, type NextRequest } from 'next/server'
import {
  getReferenceAnalysisPolicyState,
  REFERENCE_ANALYSIS_ESTIMATED_CREDITS,
  REFERENCE_ANALYSIS_TIMEZONE,
} from '@/lib/references/reference-analysis-policy'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SettingsPatch = {
  is_auto_analysis_paused?: unknown
  daily_submission_limit?: unknown
}

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

function normalizePatch(input: SettingsPatch) {
  const values: {
    is_auto_analysis_paused?: boolean
    daily_submission_limit?: number
  } = {}

  if (typeof input.is_auto_analysis_paused === 'boolean') {
    values.is_auto_analysis_paused = input.is_auto_analysis_paused
  }

  if (input.daily_submission_limit !== undefined) {
    const limit = Number(input.daily_submission_limit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return { error: 'daily_submission_limit_invalid' } as const
    }
    values.daily_submission_limit = limit
  }

  return { values } as const
}

async function loadFolders(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin
    .from('linkko_folder_integrations')
    .select('id,folder_name,is_enabled,auto_analyze_new_links,created_at')
    .eq('posty_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error('reference_folder_settings_lookup_failed')
  }

  return data ?? []
}

export async function GET() {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  try {
    const [policy, folders] = await Promise.all([
      getReferenceAnalysisPolicyState(admin, user.id),
      loadFolders(admin, user.id),
    ])

    return NextResponse.json({
      settings: policy.settings,
      todaySubmissionCount: policy.submittedToday,
      dailySubmissionLimit: policy.settings.daily_submission_limit,
      dailyLimitReached: policy.dailyLimitReached,
      dayRange: policy.dayRange,
      estimatedCredits: policy.estimatedCredits,
      folders,
    })
  } catch {
    return NextResponse.json({ error: 'reference_settings_unavailable' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SettingsPatch

  try {
    body = await request.json() as SettingsPatch
  } catch {
    return NextResponse.json({ error: 'invalid_request_body' }, { status: 400 })
  }

  const normalized = normalizePatch(body)
  if ('error' in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    const current = await getReferenceAnalysisPolicyState(admin, user.id)
    const settings = {
      user_id: user.id,
      is_auto_analysis_paused:
        normalized.values.is_auto_analysis_paused ??
        current.settings.is_auto_analysis_paused,
      daily_submission_limit:
        normalized.values.daily_submission_limit ??
        current.settings.daily_submission_limit,
      timezone: REFERENCE_ANALYSIS_TIMEZONE,
      estimated_credit_min: REFERENCE_ANALYSIS_ESTIMATED_CREDITS.min,
      estimated_credit_max: REFERENCE_ANALYSIS_ESTIMATED_CREDITS.max,
    }

    const { error } = await admin
      .from('reference_analysis_settings')
      .upsert(settings, { onConflict: 'user_id' })

    if (error) {
      throw new Error('reference_settings_update_failed')
    }

    const updated = await getReferenceAnalysisPolicyState(admin, user.id)

    return NextResponse.json({
      settings: updated.settings,
      todaySubmissionCount: updated.submittedToday,
      dailySubmissionLimit: updated.settings.daily_submission_limit,
      dailyLimitReached: updated.dailyLimitReached,
      dayRange: updated.dayRange,
      estimatedCredits: updated.estimatedCredits,
    })
  } catch {
    return NextResponse.json({ error: 'reference_settings_update_failed' }, { status: 500 })
  }
}
