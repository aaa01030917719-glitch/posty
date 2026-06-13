import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ReferenceRow } from '@/components/references/ReferenceRow'
import type { ReferenceAnalysisStatus, ReferenceRowData } from '@/components/references/referenceTypes'
import { getReferenceAnalysisDayRange } from '@/lib/references/reference-analysis-policy'
import { createClient } from '@/lib/supabase/server'

type ReferenceRecord = {
  id: string
  canonical_url: string
  platform: string
  title: string | null
  thumbnail_url: string | null
  analysis_status: ReferenceAnalysisStatus
  first_seen_at: string | null
  last_seen_at: string | null
  created_at: string
}

type SourceRecord = {
  reference_id: string
  source_folder_name: string | null
  last_seen_at: string | null
  created_at: string
}

type JobRecord = {
  reference_id: string
  status: string
  created_at: string
}

type ReferenceAnalysisSettingsRecord = {
  is_auto_analysis_paused: boolean
  daily_submission_limit: number
}

function latestTimestamp(value: SourceRecord) {
  return new Date(value.last_seen_at ?? value.created_at).getTime()
}

function toReferenceRows(
  references: ReferenceRecord[],
  sources: SourceRecord[],
  jobs: JobRecord[]
): ReferenceRowData[] {
  const sourcesByReference = sources.reduce<Record<string, SourceRecord[]>>((acc, source) => {
    acc[source.reference_id] = [...(acc[source.reference_id] ?? []), source]
    return acc
  }, {})

  const latestJobByReference = jobs.reduce<Record<string, JobRecord>>((acc, job) => {
    if (!acc[job.reference_id]) {
      acc[job.reference_id] = job
    }
    return acc
  }, {})

  return references.map((reference) => {
    const referenceSources = sourcesByReference[reference.id] ?? []
    const latestSource = [...referenceSources].sort(
      (left, right) => latestTimestamp(right) - latestTimestamp(left)
    )[0]

    return {
      ...reference,
      sourceCount: referenceSources.length,
      latestSourceFolderName: latestSource?.source_folder_name ?? null,
      latestJobStatus: latestJobByReference[reference.id]?.status ?? null,
    }
  })
}

export default async function ReferencesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: referenceData, error: referenceError } = await supabase
    .from('references')
    .select(`
      id,
      canonical_url,
      platform,
      title,
      thumbnail_url,
      analysis_status,
      first_seen_at,
      last_seen_at,
      created_at
    `)
    .eq('user_id', user.id)
    .order('last_seen_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (referenceError) {
    throw new Error('References could not be loaded')
  }

  const references = (referenceData ?? []) as ReferenceRecord[]
  const referenceIds = references.map((reference) => reference.id)

  const [sourcesResult, jobsResult] = referenceIds.length > 0
    ? await Promise.all([
        supabase
          .from('reference_sources')
          .select('reference_id, source_folder_name, last_seen_at, created_at')
          .eq('user_id', user.id)
          .in('reference_id', referenceIds)
          .order('last_seen_at', { ascending: false }),
        supabase
          .from('reference_analysis_jobs')
          .select('reference_id, status, created_at')
          .eq('user_id', user.id)
          .in('reference_id', referenceIds)
          .order('created_at', { ascending: false }),
      ])
    : [
        { data: [] as SourceRecord[], error: null },
        { data: [] as JobRecord[], error: null },
      ]

  if (sourcesResult.error || jobsResult.error) {
    throw new Error('Reference metadata could not be loaded')
  }

  const rows = toReferenceRows(
    references,
    (sourcesResult.data ?? []) as SourceRecord[],
    (jobsResult.data ?? []) as JobRecord[]
  )
  const dayRange = getReferenceAnalysisDayRange()
  const [settingsResult, todayCountResult] = await Promise.all([
    supabase
      .from('reference_analysis_settings')
      .select('is_auto_analysis_paused,daily_submission_limit')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('reference_analysis_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('submitted_at', dayRange.start)
      .lt('submitted_at', dayRange.end),
  ])

  if (settingsResult.error || todayCountResult.error) {
    throw new Error('Reference analysis settings could not be loaded')
  }

  const analysisSettings = settingsResult.data as ReferenceAnalysisSettingsRecord | null
  const isAutoPaused = analysisSettings?.is_auto_analysis_paused ?? true
  const dailyLimit = analysisSettings?.daily_submission_limit ?? 5
  const todaySubmissionCount = todayCountResult.count ?? 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
            래퍼런스
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Linkko에서 수집된 공개 래퍼런스와 분석 진행 상태를 확인합니다.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="rounded-[999px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-2 py-1">
              자동 분석 {isAutoPaused ? '일시정지' : '활성'}
            </span>
            <span className="rounded-[999px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-2 py-1">
              오늘 제출 {todaySubmissionCount} / {dailyLimit}
            </span>
          </div>
        </div>
        <Link
          href="/references/settings"
          className="inline-flex h-9 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
        >
          분석 설정
        </Link>
      </section>

      <section className="overflow-hidden rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        {rows.length > 0 ? (
          rows.map((reference) => (
            <ReferenceRow key={reference.id} reference={reference} />
          ))
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              아직 수집된 래퍼런스가 없습니다
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Linkko 연동 폴더에 링크를 저장하면 자동으로 쌓입니다
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
