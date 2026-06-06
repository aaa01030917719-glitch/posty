'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type AutoDmEvent = {
  id: string
  createdAt: string
  updatedAt: string
  ruleId: string | null
  ruleTitle: string | null
  keyword: string | null
  mediaId: string
  commentId: string
  commenterUsername: string | null
  commentText: string | null
  lifecycleStatus: string
  initialReplyStatus: string
  publicReplyStatus: string
  followStatus: string
  deliveryStatus: string
  initialPrivateReplySentAt: string | null
  publicCommentReplySentAt: string | null
  userRepliedAt: string | null
  followCheckedAt: string | null
  materialSentAt: string | null
  failureStage: string | null
  failureCode: string | null
  failureReason: string | null
  attemptCount: number
}

const lifecycleLabels: Record<string, string> = {
  comment_received: '댓글 수신',
  keyword_matched: '댓글 감지',
  waiting_for_user_reply: '사용자 답장 대기',
  follow_check_pending: '팔로우 확인 중',
  waiting_for_follow: '팔로우 대기',
  material_sent: '자료 발송 완료',
  failed: '실패',
  duplicate_skipped: '중복 제외',
}

const actionLabels: Record<string, string> = {
  pending: '대기',
  sent: '완료',
  failed: '실패',
  not_attempted: '미시도',
  unknown: '미확인',
  following: '팔로우',
  not_following: '미팔로우',
  check_failed: '확인 실패',
  not_ready: '준비 전',
}

const badgeTone: Record<string, string> = {
  sent: 'border-[color-mix(in_srgb,var(--color-success)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-bg-surface))] text-[var(--color-success)]',
  following: 'border-[color-mix(in_srgb,var(--color-success)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-bg-surface))] text-[var(--color-success)]',
  material_sent: 'border-[color-mix(in_srgb,var(--color-success)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-bg-surface))] text-[var(--color-success)]',
  failed: 'border-[color-mix(in_srgb,var(--color-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-bg-surface))] text-[var(--color-danger)]',
  check_failed: 'border-[color-mix(in_srgb,var(--color-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-bg-surface))] text-[var(--color-danger)]',
  pending: 'border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]',
  not_attempted: 'border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]',
  not_ready: 'border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]',
  waiting_for_user_reply: 'border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]',
  waiting_for_follow: 'border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]',
}

export function AutoDmEventsTab() {
  const [events, setEvents] = useState<AutoDmEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadEvents({ silent = false }: { silent?: boolean } = {}) {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/auto-dm/events')
      const data = await response.json() as { events?: AutoDmEvent[]; error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? '발송 이력을 불러오지 못했습니다')
      }

      setEvents(data.events ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '발송 이력을 불러오지 못했습니다')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || refreshing}
          onClick={() => loadEvents({ silent: true })}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />
          새로고침
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] px-3 py-2 text-xs text-[var(--color-danger)]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center border-y border-[var(--color-border-soft)] text-[var(--color-text-muted)]">
          <LoaderCircle className="animate-spin" size={18} />
        </div>
      ) : events.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center border-y border-[var(--color-border-soft)] px-4 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted-soft)]">
            <Inbox size={18} />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
            발송 이력이 없습니다
          </h2>
          <p className="mt-1 max-w-md text-xs leading-5 text-[var(--color-text-muted)]">
            자동 DM이 실행되면 댓글 감지부터 자료 발송까지의 처리 결과가 여기에 표시됩니다
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto border-y border-[var(--color-border-soft)] md:block">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
                <tr>
                  <Th>발생 시간</Th>
                  <Th>규칙</Th>
                  <Th>댓글 작성자</Th>
                  <Th>댓글 내용</Th>
                  <Th>최초 DM</Th>
                  <Th>공개 답글</Th>
                  <Th>팔로우</Th>
                  <Th>자료 발송</Th>
                  <Th>실패 사유</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-soft)]">
                {events.map((event) => (
                  <tr key={event.id} className="align-top">
                    <Td>
                      <div className="font-medium text-[var(--color-text-primary)]">{formatDateTime(event.createdAt)}</div>
                      <div className="mt-1 text-[var(--color-text-muted)]">{displayLabel(event.lifecycleStatus, lifecycleLabels)}</div>
                    </Td>
                    <Td>
                      <div className="max-w-36 truncate font-medium text-[var(--color-text-primary)]" title={event.ruleTitle ?? undefined}>
                        {event.ruleTitle ?? '삭제된 규칙'}
                      </div>
                      <div className="mt-1 max-w-36 truncate text-[var(--color-text-muted)]" title={event.keyword ?? undefined}>
                        키워드 {event.keyword ?? '없음'}
                      </div>
                    </Td>
                    <Td>{event.commenterUsername ?? '사용자 없음'}</Td>
                    <Td>
                      <p className="line-clamp-2 max-w-48 break-words" title={event.commentText ?? undefined}>
                        {event.commentText || '댓글 내용 없음'}
                      </p>
                    </Td>
                    <Td><StatusBadge value={event.initialReplyStatus} /></Td>
                    <Td><StatusBadge value={event.publicReplyStatus} /></Td>
                    <Td><StatusBadge value={event.followStatus} /></Td>
                    <Td><StatusBadge value={event.deliveryStatus} /></Td>
                    <Td>
                      {event.failureReason ? (
                        <span className="line-clamp-2 max-w-44 break-words text-[var(--color-danger)]" title={event.failureReason}>
                          {event.failureReason}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted-soft)]">-</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {events.map((event) => (
              <article key={event.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(event.createdAt)}</p>
                    <h3 className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {event.ruleTitle ?? '삭제된 규칙'}
                    </h3>
                  </div>
                  <StatusBadge value={event.lifecycleStatus} map={lifecycleLabels} />
                </div>
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                  @{event.commenterUsername ?? '사용자 없음'}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]" title={event.commentText ?? undefined}>
                  {event.commentText || '댓글 내용 없음'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <StatusItem label="최초 DM" value={event.initialReplyStatus} />
                  <StatusItem label="공개 답글" value={event.publicReplyStatus} />
                  <StatusItem label="팔로우" value={event.followStatus} />
                  <StatusItem label="자료 발송" value={event.deliveryStatus} />
                </div>
                {event.failureReason ? (
                  <p className="mt-3 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] px-3 py-2 text-xs leading-5 text-[var(--color-danger)]">
                    {event.failureReason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 text-[var(--color-text-secondary)]">{children}</td>
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <StatusBadge value={value} />
    </div>
  )
}

function StatusBadge({ value, map = actionLabels }: { value: string; map?: Record<string, string> }) {
  return (
    <span className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone[value] ?? 'border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'}`}>
      <span className="truncate">{displayLabel(value, map)}</span>
    </span>
  )
}

function displayLabel(value: string, map: Record<string, string>) {
  return map[value] ?? value
}

function formatDateTime(value: string | null) {
  if (!value) return '확인되지 않음'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '확인되지 않음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
