import Link from 'next/link'
import { STATUS_LABELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/server'
import type { ContentActivityLog, ContentStatus } from '@/lib/types'

const PAGE_TITLE = '타임라인'
const PAGE_DESCRIPTION = '콘텐츠 작업 이력을 최신순으로 확인할 수 있습니다.'
const EMPTY_MESSAGE = '아직 기록된 작업 이력이 없습니다.'

const ACTION_LABELS: Record<string, string> = {
  draft_saved: '임시저장',
  completed: '완료',
  content_created: '콘텐츠 생성',
  status_changed: '상태 변경',
  schedule_changed: '일정 변경',
  script_updated: '대본 수정',
  checklist_updated: '체크리스트 수정',
  deleted: '삭제됨',
}

const CONTENT_STATUSES: ContentStatus[] = [
  'idea',
  'planning',
  'writing',
  'review',
  'scheduled',
  'published',
  'hold',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isContentStatus(value: string): value is ContentStatus {
  return CONTENT_STATUSES.includes(value as ContentStatus)
}

function formatActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatMetadataSummary(metadata: unknown) {
  if (!isRecord(metadata)) {
    return []
  }

  const summary: string[] = []
  const status = typeof metadata.status === 'string' ? metadata.status : null
  const scheduledAt = typeof metadata.scheduled_at === 'string' ? metadata.scheduled_at : null
  const hasScript = typeof metadata.has_script === 'boolean' ? metadata.has_script : null
  const checklistCount =
    typeof metadata.checklist_count === 'number' ? metadata.checklist_count : null

  if (status && isContentStatus(status)) {
    summary.push(`상태 ${STATUS_LABELS[status]}`)
  }

  if (scheduledAt) {
    summary.push(`예약 ${formatDateTime(scheduledAt)}`)
  }

  if (hasScript !== null) {
    summary.push(`대본 ${hasScript ? '있음' : '없음'}`)
  }

  if (checklistCount !== null) {
    summary.push(`체크리스트 ${checklistCount}개`)
  }

  return summary
}

export default async function TimelinePage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_activity_logs')
    .select(
      'id, user_id, card_id, project_id, action, title, description, metadata, created_at, card:content_cards(id,title), project:content_projects(id,title)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch content activity logs', error)
  }

  const logs = (data as ContentActivityLog[] | null) ?? []

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="space-y-1">
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
          {PAGE_TITLE}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{PAGE_DESCRIPTION}</p>
      </section>

      {logs.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{EMPTY_MESSAGE}</p>
      ) : (
        <section className="border-t border-[var(--color-border-soft)]">
          <ul>
            {logs.map((log) => {
              const actionLabel = formatActionLabel(log.action)
              const projectTitle = log.project?.title?.trim() || '캠페인 없음'
              const contentTitle = log.card?.title?.trim() || log.title?.trim() || '제목 없음'
              const metadataSummary = formatMetadataSummary(log.metadata)
              const rowBody = (
                <div className="flex items-start justify-between gap-4 px-1 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-[var(--color-bg-surface-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        {actionLabel}
                      </span>
                      <time className="text-[11px] text-[var(--color-text-muted-soft)]">
                        {formatDateTime(log.created_at)}
                      </time>
                    </div>

                    <p className="mt-2 text-[15px] font-semibold text-[var(--color-text-primary)]">
                      {log.title?.trim() || contentTitle}
                    </p>

                    {log.description ? (
                      <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-body)]">
                        {log.description}
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--color-text-muted)]">
                      <span>캠페인 {projectTitle}</span>
                      <span>콘텐츠 {contentTitle}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--color-text-muted-soft)]">
                      {metadataSummary.length > 0 ? (
                        metadataSummary.map((item) => <span key={`${log.id}-${item}`}>{item}</span>)
                      ) : (
                        <span>추가 메타데이터 없음</span>
                      )}
                    </div>
                  </div>

                  {log.card_id ? (
                    <span className="shrink-0 text-[11px] font-medium text-[var(--color-text-muted-soft)] transition-colors group-hover:text-[var(--color-accent)]">
                      콘텐츠 보기
                    </span>
                  ) : null}
                </div>
              )

              return (
                <li
                  key={log.id}
                  className="border-b border-[var(--color-border-soft)] last:border-b-0"
                >
                  {log.card_id ? (
                    <Link
                      href={`/content/${log.card_id}`}
                      className="group block transition-colors hover:bg-[var(--color-bg-surface-soft)]"
                    >
                      {rowBody}
                    </Link>
                  ) : (
                    <div>{rowBody}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
