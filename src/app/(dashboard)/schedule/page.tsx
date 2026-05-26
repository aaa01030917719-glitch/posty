'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarWeeks,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Share2 } from 'lucide-react'
import { CardModal } from '@/components/content/CardModal'
import { createContentCard } from '@/components/content/createContentCard'
import { CalendarDay } from '@/components/schedule/CalendarDay'
import { CalendarMonth } from '@/components/schedule/CalendarMonth'
import { CalendarWeek } from '@/components/schedule/CalendarWeek'
import {
  ScheduleCardPreview,
  getScheduleCardToneStyle,
} from '@/components/schedule/ScheduleCardPreview'
import {
  ACTIVITY_ACTION_COMPACT_BADGE_CLASSES,
  ACTIVITY_ACTION_COMPACT_LABELS,
  CHANNEL_COLORS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
} from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { ChannelType, ContentActivityAction, ContentActivityLog, ContentCard } from '@/lib/types'

type ViewMode = 'month' | 'week' | 'day'

const VIEW_LABELS: Record<ViewMode, string> = {
  month: '\uC6D4',
  week: '\uC8FC',
  day: '\uC77C',
}

const CHANNEL_SHORT_LABELS: Record<ChannelType, string> = {
  instagram: 'IG',
  threads: 'TH',
  youtube: 'YT',
  blog: 'BL',
  custom: 'ETC',
}

function getTargetDate(card: ContentCard) {
  const target = card.scheduled_at || card.published_at
  return target ? new Date(target) : null
}

function compareByTargetDate(left: ContentCard, right: ContentCard) {
  const leftDate = getTargetDate(left)?.getTime() ?? 0
  const rightDate = getTargetDate(right)?.getTime() ?? 0
  return leftDate - rightDate
}

function getWeekOfMonth(date: Date) {
  const monthStart = startOfMonth(date)
  return (
    differenceInCalendarWeeks(
      startOfWeek(date, { weekStartsOn: 0 }),
      startOfWeek(monthStart, { weekStartsOn: 0 }),
      { weekStartsOn: 0 }
    ) + 1
  )
}

function getPanelMeta(card: ContentCard) {
  const targetDate = getTargetDate(card)

  if (targetDate) {
    return {
      kind: 'time' as const,
      label: format(targetDate, 'a h\uC2DC', { locale: ko }),
    }
  }

  return {
    kind: 'status' as const,
    label: STATUS_LABELS[card.status],
  }
}

function getViewTitle(view: ViewMode, currentDate: Date) {
  if (view === 'month') {
    return format(currentDate, 'yyyy\uB144 M\uC6D4', { locale: ko })
  }

  if (view === 'day') {
    return format(currentDate, 'yyyy\uB144 M\uC6D4 d\uC77C', { locale: ko })
  }

  return `${format(currentDate, 'yyyy\uB144 M\uC6D4', { locale: ko })} ${getWeekOfMonth(currentDate)}\uC8FC\uCC28`
}

function getViewSubtitle(view: ViewMode, currentDate: Date) {
  if (view === 'month') {
    return '\uC6D4\uAC04 \uC77C\uC815'
  }

  if (view === 'day') {
    return format(currentDate, 'M\uC6D4 d\uC77C EEEE', { locale: ko })
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  return `${format(weekStart, 'M\uC6D4 d\uC77C', { locale: ko })} - ${format(weekEnd, 'M\uC6D4 d\uC77C', { locale: ko })}`
}

function formatActivityActionLabel(action: string) {
  return ACTIVITY_ACTION_COMPACT_LABELS[action as ContentActivityAction] ?? action.slice(0, 1)
}

function getActivityActionBadgeClass(action: string) {
  return ACTIVITY_ACTION_COMPACT_BADGE_CLASSES[action as ContentActivityAction] ??
    'bg-[var(--color-bg-surface-soft)] text-[var(--color-text-secondary)]'
}

function formatActivityDateTime(value: string) {
  try {
    return format(new Date(value), 'M/d(EEE) HH:mm', { locale: ko })
  } catch {
    return value
  }
}

export default function SchedulePage() {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [cards, setCards] = useState<ContentCard[]>([])
  const [recentActivityLogs, setRecentActivityLogs] = useState<ContentActivityLog[]>([])
  const [selectedCard, setSelectedCard] = useState<ContentCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fetchScheduleData = async () => {
      const supabase = createClient()
      const [cardsResult, activityResult] = await Promise.all([
        supabase
          .from('content_cards')
          .select('*, channel:channels(*), project:content_projects(id,title)')
          .eq('is_deleted', false)
          .not('scheduled_at', 'is', null)
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('content_activity_logs')
          .select(
            'id, user_id, card_id, project_id, action, title, description, metadata, created_at, card:content_cards(id,title), project:content_projects(id,title)'
          )
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (activityResult.error) {
        console.error('Failed to fetch recent activity logs', activityResult.error)
      }

      setCards((cardsResult.data as ContentCard[]) ?? [])
      setRecentActivityLogs((activityResult.data as ContentActivityLog[] | null) ?? [])
      setLoading(false)
    }

    fetchScheduleData()
  }, [])

  const handleCardUpdate = (updated: ContentCard) => {
    setCards((prev) => prev.map((card) => (card.id === updated.id ? updated : card)))
    setSelectedCard(updated)
  }

  const handleCreateContent = async () => {
    if (creating) return

    setCreating(true)

    try {
      const nextId = await createContentCard()
      router.push(`/content/${nextId}`)
    } catch (error) {
      console.error('Failed to create content card', error)
      window.alert('\uC0C8 \uCF58\uD150\uCE20\uB97C \uC0DD\uC131\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.')
    } finally {
      setCreating(false)
    }
  }

  const moveRange = (direction: 'prev' | 'next') => {
    const step = direction === 'next' ? 1 : -1

    if (view === 'month') {
      setCurrentDate((prev) => (step > 0 ? addMonths(prev, 1) : subMonths(prev, 1)))
      return
    }

    if (view === 'day') {
      setCurrentDate((prev) => (step > 0 ? addDays(prev, 1) : subDays(prev, 1)))
      return
    }

    setCurrentDate((prev) => (step > 0 ? addWeeks(prev, 1) : subWeeks(prev, 1)))
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const todayDate = new Date()

  const viewTitle = getViewTitle(view, currentDate)
  const subtitle = getViewSubtitle(view, currentDate)
  const greetingTitle = '\uC548\uB155\uD558\uC138\uC694! \uC624\uB298\uB3C4 \uD589\uBCF5\uD55C \uD558\uB8E8 \uBCF4\uB0B4\uC138\uC694 \u2600\uFE0F'
  const periodLabel =
    view === 'week'
      ? `${format(weekStart, 'yyyy')}\uB144 ${format(weekStart, 'M')}\uC6D4 ${getWeekOfMonth(weekStart)}\uC8FC\uCC28 - ${format(weekEnd, 'yyyy')}\uB144 ${format(weekEnd, 'M')}\uC6D4 ${getWeekOfMonth(weekEnd)}\uC8FC\uCC28`
      : `${viewTitle} \u00B7 ${subtitle}`

  const todayCards = cards
    .filter((card) => {
      const targetDate = getTargetDate(card)
      return targetDate ? isSameDay(targetDate, todayDate) : false
    })
    .sort(compareByTargetDate)

  const reviewCards = cards
    .filter((card) => card.status === 'review')
    .sort(compareByTargetDate)
    .slice(0, 3)

  const visibleWeekCards = cards
    .filter((card) => {
      const targetDate = getTargetDate(card)
      return targetDate ? isWithinInterval(targetDate, { start: weekStart, end: weekEnd }) : false
    })
    .sort(compareByTargetDate)

  const writingCount = cards.filter(
    (card) => card.status === 'planning' || card.status === 'writing'
  ).length

  const weekCount = visibleWeekCards.length

  const viewButtonClass = (targetView: ViewMode) =>
    clsx(
      'rounded-[4px] px-3 py-[3px] text-[11.5px] font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
      view === targetView
        ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] font-bold'
        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
    )

  const renderPanelCard = (card: ContentCard, variant: 'default' | 'done' | 'review') => {
    const channelColor = card.channel ? CHANNEL_COLORS[card.channel.type] ?? '#929292' : '#929292'
    const channelLabel = card.channel ? CHANNEL_SHORT_LABELS[card.channel.type] : null
    const panelMeta = getPanelMeta(card)

    return (
      <ScheduleCardPreview
        key={`${variant}-${card.id}`}
        card={card}
        className="group relative min-w-0 max-w-full"
      >
        <button
          type="button"
          onClick={() => setSelectedCard(card)}
          style={getScheduleCardToneStyle(card)}
          className="box-border flex w-full max-w-full min-w-0 items-start gap-2 rounded-[5px] border border-[var(--schedule-card-border)] bg-[var(--schedule-card-bg)] px-2 py-1.5 text-left transition-[border-color] hover:border-[var(--schedule-card-border-hover)]"
        >
          <span
            className={clsx(
              'mt-0.5 h-[14px] w-[14px] shrink-0 rounded-[3px] border',
              variant === 'done'
                ? 'border-[var(--color-text-body)] bg-[var(--color-text-body)]'
                : variant === 'review'
                  ? 'border-[var(--color-link-legal)]'
                  : 'border-[var(--color-border-default)]'
            )}
          />

          <span className="min-w-0 flex-1">
            <span
              className={clsx(
                'block truncate text-[12.5px] leading-5 text-[var(--color-text-primary)]',
                variant === 'done' && 'text-[var(--color-text-muted)] line-through'
              )}
            >
              {card.title}
            </span>
            <span className="mt-1 flex items-center gap-1.5">
              {channelLabel && (
                <span
                  className="inline-flex rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: `${channelColor}14`,
                    color: channelColor,
                  }}
                >
                  {channelLabel}
                </span>
              )}
              {panelMeta.kind === 'time' ? (
                <span className="text-[10.5px] text-[var(--color-text-muted)]">{panelMeta.label}</span>
              ) : (
                <span
                  className={clsx(
                    'inline-flex rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold',
                    STATUS_BADGE_CLASSES[card.status]
                  )}
                >
                  {panelMeta.label}
                </span>
              )}
            </span>
          </span>
        </button>
      </ScheduleCardPreview>
    )
  }

  const renderActivityLog = (log: ContentActivityLog) => {
    const actionLabel = formatActivityActionLabel(log.action)
    const actionBadgeClass = getActivityActionBadgeClass(log.action)
    const title = log.card?.title?.trim() || log.title?.trim() || '\uC81C\uBAA9 \uC5C6\uC74C'
    const projectTitle = log.project?.title?.trim()
    const rowBody = (
      <div className="flex w-full flex-col gap-1 px-2 py-2.5 text-left transition-[background-color]">
        {projectTitle ? (
          <span className="block truncate text-[10.5px] font-medium text-[var(--color-text-muted-soft)]">
            {projectTitle}
          </span>
        ) : null}
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium leading-5 text-[var(--color-text-primary)]">
            {title}
          </span>
          <span
            className={clsx(
              'mt-0.5 inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[4px] px-1.5 text-[10px] font-bold leading-none',
              actionBadgeClass
            )}
          >
            <span className="sr-only">{log.action}</span>
            {actionLabel}
          </span>
        </span>
        <time className="text-[10.5px] text-[var(--color-text-muted-soft)]">
          {formatActivityDateTime(log.created_at)}
        </time>
      </div>
    )

    if (!log.card_id) {
      return (
        <li key={log.id} className="border-b border-[var(--color-border-soft)] last:border-b-0">
          {rowBody}
        </li>
      )
    }

    return (
      <li key={log.id} className="border-b border-[var(--color-border-soft)] last:border-b-0">
        <Link
          href={`/content/${log.card_id}`}
          className="block rounded-[5px] hover:bg-[var(--color-bg-surface-soft)]"
        >
          {rowBody}
        </Link>
      </li>
    )
  }

  return (
    <div className="flex min-h-full flex-1 bg-[var(--color-bg-surface-soft)]">
      {loading ? (
        <div className="flex min-h-[700px] w-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : (
        <>
          <aside className="w-[248px] shrink-0 border-r border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]">
            <div className="h-full overflow-y-auto px-4 pb-5 pt-[18px]">
              <p className="mb-1 text-[11px] font-medium text-[var(--color-text-muted-soft)]">
                {format(todayDate, 'yyyy\uB144 M\uC6D4 d\uC77C EEEE', { locale: ko })}
              </p>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
                {'\uC624\uB298\uC758 \uC791\uC5C5'}
              </h2>

              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <div className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-1.5 py-2 text-center">
                  <p className="text-[17px] font-bold leading-none tracking-[-0.03em] text-[var(--color-accent)]">
                    {todayCards.length}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted-soft)]">{'\uC624\uB298 \uC77C\uC815'}</p>
                </div>
                <div className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-1.5 py-2 text-center">
                  <p className="text-[17px] font-bold leading-none tracking-[-0.03em] text-[var(--color-text-primary)]">
                    {writingCount}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted-soft)]">{'\uC791\uC131 \uC911'}</p>
                </div>
                <div className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-1.5 py-2 text-center">
                  <p className="text-[17px] font-bold leading-none tracking-[-0.03em] text-[var(--color-text-primary)]">
                    {weekCount}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted-soft)]">{'\uC774\uBC88 \uC8FC'}</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <section>
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted-soft)]">
                    {'\uC624\uB298 \uD560 \uC77C'}
                  </p>
                  <div className="space-y-1">
                    {todayCards.length > 0 ? (
                      todayCards.slice(0, 4).map((card) =>
                        renderPanelCard(card, card.status === 'published' ? 'done' : 'default')
                      )
                    ) : (
                      <p className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                        {'\uC624\uB298 \uB4F1\uB85D\uB41C \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted-soft)]">
                    {'\uCEE8\uD38C \uD544\uC694'}
                  </p>
                  <div className="space-y-1">
                    {reviewCards.length > 0 ? (
                      reviewCards.map((card) => renderPanelCard(card, 'review'))
                    ) : (
                      <p className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                        {'\uC9C0\uAE08 \uD655\uC778\uC774 \uD544\uC694\uD55C \uCF58\uD150\uCE20\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted-soft)]">
                    {'\uC774\uBC88 \uC8FC \uC8FC\uC694 \uC77C\uC815'}
                  </p>
                  <div className="space-y-1">
                    {visibleWeekCards.length > 0 ? (
                      visibleWeekCards.slice(0, 5).map((card) => renderPanelCard(card, 'default'))
                    ) : (
                      <p className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                        {'\uC774\uBC88 \uC8FC\uC5D0 \uB4F1\uB85D\uB41C \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted-soft)]">
                      {'\uCD5C\uADFC \uC791\uC5C5 \uC774\uB825'}
                    </p>
                    <Link
                      href="/timeline"
                      className="text-[10.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
                    >
                      {'\uC804\uCCB4 \uBCF4\uAE30'}
                    </Link>
                  </div>
                  {recentActivityLogs.length > 0 ? (
                    <ul>{recentActivityLogs.map((log) => renderActivityLog(log))}</ul>
                  ) : (
                    <p className="px-2 py-2 text-[12px] text-[var(--color-text-muted)]">
                      {'\uC544\uC9C1 \uC791\uC5C5 \uC774\uB825\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}
                    </p>
                  )}
                </section>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-hidden bg-[var(--color-bg-surface-soft)]">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-col gap-2 px-[18px] pb-0 pt-4">
                <h1 className="text-[14px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[15px]">
                  {greetingTitle}
                </h1>

                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-[5px]">
                    <p className="text-[12px] text-[var(--color-text-muted)]">{periodLabel}</p>
                    {view !== 'week' && (
                      <div className="flex items-center gap-[3px]">
                        <button
                          type="button"
                          onClick={() => moveRange('prev')}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-body)] transition-[background-color] hover:bg-[var(--color-bg-surface-soft)]"
                        >
                          <ChevronLeft size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentDate(new Date())}
                          className="h-[26px] rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-[9px] text-[11.5px] font-semibold text-[var(--color-text-body)] transition-[background-color] hover:bg-[var(--color-bg-surface-soft)]"
                        >
                          오늘
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRange('next')}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-body)] transition-[background-color] hover:bg-[var(--color-bg-surface-soft)]"
                        >
                          <ChevronRight size={10} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-[5px] md:justify-end">
                    <div className="flex items-center gap-px rounded-[5px] bg-[var(--color-bg-surface-strong)] p-[2px]">
                      {(['month', 'week', 'day'] as const).map((targetView) => (
                        <button
                          key={targetView}
                          type="button"
                          aria-pressed={view === targetView}
                          onClick={() => setView(targetView)}
                          className={viewButtonClass(targetView)}
                        >
                          {VIEW_LABELS[targetView]}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="공유 기능은 추후 지원됩니다."
                      className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-body)]"
                    >
                      <Share2 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={handleCreateContent}
                      disabled={creating}
                      className="inline-flex h-7 items-center gap-[5px] rounded-[5px] bg-[var(--color-accent)] px-3 text-[12px] font-bold tracking-[-0.01em] text-[var(--color-on-accent)] transition-[background-color] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-accent-disabled)]"
                    >
                      <Plus size={11} />
                      {creating ? '생성 중...' : '새 콘텐츠'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 px-4 pb-[14px] pt-[10px]">
                {view === 'month' && (
                  <CalendarMonth
                    cards={cards}
                    currentDate={currentDate}
                    onCardClick={setSelectedCard}
                  />
                )}
                {view === 'week' && (
                  <div className="h-full min-h-0 overflow-x-auto">
                    <CalendarWeek
                      cards={cards}
                      currentDate={currentDate}
                      onCardClick={setSelectedCard}
                    />
                  </div>
                )}
                {view === 'day' && (
                  <CalendarDay
                    cards={cards}
                    currentDate={currentDate}
                    onCardClick={setSelectedCard}
                  />
                )}
              </div>
            </div>
          </main>
        </>
      )}

      <CardModal
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        onUpdate={handleCardUpdate}
      />
    </div>
  )
}
