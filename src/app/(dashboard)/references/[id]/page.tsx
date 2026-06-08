import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ReferenceAnalysisSection } from '@/components/references/ReferenceAnalysisSection'
import { ReferenceJobStatus } from '@/components/references/ReferenceJobStatus'
import { ReferenceSourceList } from '@/components/references/ReferenceSourceList'
import { ReferenceStatusBadge } from '@/components/references/ReferenceStatusBadge'
import {
  compactUrl,
  formatReferenceDate,
  getReferenceTitle,
} from '@/components/references/referenceFormat'
import type {
  ReferenceAnalysisData,
  ReferenceAnalysisStatus,
  ReferenceJobData,
  ReferenceSourceData,
} from '@/components/references/referenceTypes'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ id: string }>
}

type ReferenceDetailRecord = {
  id: string
  canonical_url: string
  platform: string
  title: string | null
  thumbnail_url: string | null
  analysis_status: ReferenceAnalysisStatus
  latest_analysis_id: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  created_at: string
}

export default async function ReferenceDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: reference, error: referenceError } = await supabase
    .from('references')
    .select(`
      id,
      canonical_url,
      platform,
      title,
      thumbnail_url,
      analysis_status,
      latest_analysis_id,
      first_seen_at,
      last_seen_at,
      created_at
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (referenceError) {
    throw new Error('Reference could not be loaded')
  }

  if (!reference) {
    notFound()
  }

  const referenceRecord = reference as ReferenceDetailRecord

  const [sourcesResult, jobResult, latestAnalysisResult] = await Promise.all([
    supabase
      .from('reference_sources')
      .select(`
        id,
        source_folder_name,
        raw_url,
        custom_title,
        preview_title,
        memo,
        source_created_at,
        source_deleted_at,
        last_seen_at
      `)
      .eq('user_id', user.id)
      .eq('reference_id', referenceRecord.id)
      .order('last_seen_at', { ascending: false }),
    supabase
      .from('reference_analysis_jobs')
      .select(`
        id,
        job_type,
        status,
        priority,
        attempt_count,
        failure_code,
        failure_reason,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .eq('reference_id', referenceRecord.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    referenceRecord.latest_analysis_id
      ? supabase
          .from('reference_analyses')
          .select(`
            id,
            transcript,
            captions,
            viral_factors,
            business_use_points,
            content_angles,
            risk_notes,
            completed_at
          `)
          .eq('user_id', user.id)
          .eq('reference_id', referenceRecord.id)
          .eq('id', referenceRecord.latest_analysis_id)
          .maybeSingle()
      : supabase
          .from('reference_analyses')
          .select(`
            id,
            transcript,
            captions,
            viral_factors,
            business_use_points,
            content_angles,
            risk_notes,
            completed_at
          `)
          .eq('user_id', user.id)
          .eq('reference_id', referenceRecord.id)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
  ])

  if (sourcesResult.error || jobResult.error || latestAnalysisResult.error) {
    throw new Error('Reference detail metadata could not be loaded')
  }

  const title = getReferenceTitle(referenceRecord.title, referenceRecord.canonical_url)
  const sources = (sourcesResult.data ?? []) as ReferenceSourceData[]
  const latestJob = (jobResult.data ?? null) as ReferenceJobData | null
  const latestAnalysis = (latestAnalysisResult.data ?? null) as ReferenceAnalysisData | null

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <Link
        href="/references"
        className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        ← 래퍼런스 목록
      </Link>

      <section className="rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {referenceRecord.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={referenceRecord.thumbnail_url}
              alt=""
              className="h-24 w-24 shrink-0 rounded-[6px] border border-[var(--color-border-soft)] object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-xs font-semibold text-[var(--color-text-muted)]">
              REF
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ReferenceStatusBadge status={referenceRecord.analysis_status} />
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {referenceRecord.platform}
              </span>
            </div>
            <h1 className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {title}
            </h1>
            <p className="mt-2 break-words text-sm text-[var(--color-text-muted)]">
              {compactUrl(referenceRecord.canonical_url, 120)}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
              <span>최초 수집 {formatReferenceDate(referenceRecord.first_seen_at ?? referenceRecord.created_at)}</span>
              <span>마지막 확인 {formatReferenceDate(referenceRecord.last_seen_at)}</span>
            </div>
          </div>

          <a
            href={referenceRecord.canonical_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-[5px] border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
          >
            <ExternalLink size={15} />
            원본 링크 열기
          </a>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Linkko 출처</h2>
        <ReferenceSourceList sources={sources} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">분석 Queue 상태</h2>
        <ReferenceJobStatus job={latestJob} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">분석 결과</h2>
        <ReferenceAnalysisSection analysis={latestAnalysis} />
      </section>
    </div>
  )
}
