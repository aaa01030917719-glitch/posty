'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { CHANNEL_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { Script } from '@/lib/types'

const PAGE_TITLE = '대본 작업'
const PAGE_DESCRIPTION =
  '대본, 캡션, 해시태그 작업이 있는 콘텐츠를 모아봅니다. 실제 편집은 콘텐츠 상세에서 진행합니다.'
const EMPTY_TITLE = '아직 대본 작업이 있는 콘텐츠가 없습니다.'
const UNTITLED_LABEL = '제목 없음'
const NO_CAMPAIGN_LABEL = '캠페인 없음'
const NO_CHANNEL_LABEL = '채널 없음'
const UNKNOWN_DATE_LABEL = '미정'
const EDIT_IN_CONTENT_LABEL = '콘텐츠에서 편집'

function hasText(value: string | null) {
  return Boolean(value?.trim())
}

function formatDateTime(value: string | null) {
  if (!value) return UNKNOWN_DATE_LABEL

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getChannelLabel(script: Script) {
  const channel = script.card?.channel

  if (!channel) return NO_CHANNEL_LABEL

  return channel.name?.trim() || CHANNEL_TYPE_LABELS[channel.type] || NO_CHANNEL_LABEL
}

function getScriptParts(script: Script) {
  return [
    { label: '대본 있음', active: hasText(script.body) },
    { label: '캡션 있음', active: hasText(script.caption) },
    { label: '해시태그 있음', active: hasText(script.hashtags) },
    { label: '썸네일 문구 있음', active: hasText(script.thumbnail_text) },
  ].filter((item) => item.active)
}

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchScripts = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('scripts')
        .select(
          '*, card:content_cards(id,title,status,scheduled_at,is_deleted,project:content_projects(id,title),channel:channels(id,name,type))'
        )
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch scripts', error)
      }

      setScripts((data as Script[] | null) ?? [])
      setLoading(false)
    }

    fetchScripts()
  }, [])

  const visibleScripts = useMemo(
    () => scripts.filter((script) => script.card && !script.card.is_deleted),
    [scripts]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[var(--color-bg-canvas)] py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="space-y-1">
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
          {PAGE_TITLE}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
          {PAGE_DESCRIPTION}
        </p>
      </section>

      {visibleScripts.length === 0 ? (
        <div className="border-t border-[var(--color-border-soft)] pt-8">
          <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
            <FileText size={18} />
            <p className="text-sm">{EMPTY_TITLE}</p>
          </div>
        </div>
      ) : (
        <ul className="border-t border-[var(--color-border-soft)]">
          {visibleScripts.map((script) => {
            const card = script.card

            if (!card) return null

            const parts = getScriptParts(script)
            const projectTitle = card.project?.title?.trim() || NO_CAMPAIGN_LABEL
            const contentTitle = card.title?.trim() || script.title?.trim() || UNTITLED_LABEL
            const channelLabel = getChannelLabel(script)

            return (
              <li key={script.id} className="border-b border-[var(--color-border-soft)]">
                <Link
                  href={`/content/${card.id}`}
                  className="group grid gap-3 px-1 py-4 transition-colors hover:bg-[var(--color-bg-surface-soft)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                      <span>{projectTitle}</span>
                      <span className="text-[var(--color-border-strong)]">/</span>
                      <span>{channelLabel}</span>
                      <span className="text-[var(--color-border-strong)]">/</span>
                      <span>{STATUS_LABELS[card.status]}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {contentTitle}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {parts.length > 0 ? (
                        parts.map((part) => (
                          <span
                            key={`${script.id}-${part.label}`}
                            className="rounded-[3px] bg-[var(--color-bg-surface-soft)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--color-text-secondary)]"
                          >
                            {part.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted-soft)]">
                          작성된 대본 필드 없음
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-xs md:justify-end">
                    <time className="text-[var(--color-text-muted)]">
                      {formatDateTime(script.updated_at)}
                    </time>
                    <span className="font-semibold text-[var(--color-accent)] transition-colors group-hover:text-[var(--color-accent-hover)]">
                      {EDIT_IN_CONTENT_LABEL}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
