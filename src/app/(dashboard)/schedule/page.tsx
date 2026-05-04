'use client'

import { useEffect, useState } from 'react'
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
import { ChevronLeft, ChevronRight, ListTodo, Plus, Share2 } from 'lucide-react'
import { CardModal } from '@/components/content/CardModal'
import { createContentCard } from '@/components/content/createContentCard'
import { CalendarDay } from '@/components/schedule/CalendarDay'
import { CalendarMonth } from '@/components/schedule/CalendarMonth'
import { CalendarWeek } from '@/components/schedule/CalendarWeek'
import { CHANNEL_COLORS, STATUS_LABELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { ChannelType, ContentCard } from '@/lib/types'

type ViewMode = 'month' | 'week' | 'day'

const VIEW_LABELS: Record<ViewMode, string> = {
  month: '월',
  week: '주',
  day: '일',
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

function formatTimeLabel(card: ContentCard) {
  const targetDate = getTargetDate(card)
  return targetDate ? format(targetDate, 'a h시', { locale: ko }) : STATUS_LABELS[card.status]
}

function getViewTitle(view: ViewMode, currentDate: Date) {
  if (view === 'month') {
    return format(currentDate, 'yyyy년 M월', { locale: ko })
  }

  if (view === 'day') {
    return format(currentDate, 'yyyy년 M월 d일', { locale: ko })
  }

  return `${format(currentDate, 'yyyy년 M월', { locale: ko })} ${getWeekOfMonth(currentDate)}주차`
}

function getViewSubtitle(view: ViewMode, currentDate: Date) {
  if (view === 'month') {
    return '월간 일정'
  }

  if (view === 'day') {
    return format(currentDate, 'M월 d일 EEEE', { locale: ko })
  }

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  return `${format(weekStart, 'M월 d일', { locale: ko })} - ${format(weekEnd, 'M월 d일', { locale: ko })}`
}

export default function SchedulePage() {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [cards, setCards] = useState<ContentCard[]>([])
  const [selectedCard, setSelectedCard] = useState<ContentCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fetchCards = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('content_cards')
        .select('*, channel:channels(*)')
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true })

      setCards((data as ContentCard[]) ?? [])
      setLoading(false)
    }

    fetchCards()
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
      window.alert('새 콘텐츠를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.')
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

  const title = getViewTitle(view, currentDate)
  const subtitle = getViewSubtitle(view, currentDate)

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

    return (
      <button
        key={`${variant}-${card.id}`}
        type="button"
        onClick={() => setSelectedCard(card)}
        className="flex w-full items-start gap-2 rounded-[5px] px-2 py-1.5 text-left transition-[background-color] hover:bg-[var(--color-bg-surface-soft)]"
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
            <span className="text-[10.5px] text-[var(--color-text-muted)]">
              {formatTimeLabel(card)}
            </span>
          </span>
        </span>
      </button>
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
                {format(todayDate, 'yyyy년 M월 d일 EEEE', { locale: ko })}
              </p>
              <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
                오늘의 작업
              </h2>

              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <div className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-1.5 py-2 text-center">
                  <p className="text-[17px] font-bold leading-none tracking-[-0.03em] text-[var(--color-accent)]">
                    {todayCards.length}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted-soft)]">오늘 일정</p>
                </div>
                <div className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-1.5 py-2 text-center">
                  <p className="text-[17px] font-bold leading-none tracking-[-0.03em] text-[var(--color-text-primary)]">
                    {writingCount}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted-soft)]">작성 중</p>
                </div>
                <div className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-1.5 py-2 text-center">
                  <p className="text-[17px] font-bold leading-none tracking-[-0.03em] text-[var(--color-text-primary)]">
                    {weekCount}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted-soft)]">이번 주</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <section>
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted-soft)]">
                    오늘 할 일
                  </p>
                  <div className="space-y-1">
                    {todayCards.length > 0 ? (
                      todayCards.slice(0, 4).map((card) =>
                        renderPanelCard(card, card.status === 'published' ? 'done' : 'default')
                      )
                    ) : (
                      <p className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                        오늘 등록된 일정이 없습니다.
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted-soft)]">
                    컨펌 필요
                  </p>
                  <div className="space-y-1">
                    {reviewCards.length > 0 ? (
                      reviewCards.map((card) => renderPanelCard(card, 'review'))
                    ) : (
                      <p className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                        지금 확인이 필요한 콘텐츠가 없습니다.
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted-soft)]">
                    이번 주 주요 일정
                  </p>
                  <div className="space-y-1">
                    {visibleWeekCards.length > 0 ? (
                      visibleWeekCards.slice(0, 5).map((card) => renderPanelCard(card, 'default'))
                    ) : (
                      <p className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                        이번 주에 등록된 일정이 없습니다.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-hidden bg-[var(--color-bg-surface-soft)]">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-col gap-4 px-[18px] pb-0 pt-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-end gap-[10px]">
                  <h1 className="text-[14px] font-bold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[15px]">
                    {title}
                  </h1>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{subtitle}</p>

                  <div className="ml-1 flex items-center gap-[3px]">
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
                </div>

                <div className="flex flex-wrap items-center gap-[5px]">
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
                    title="작업 타임라인은 추후 지원됩니다."
                    className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-body)]"
                  >
                    <ListTodo size={13} />
                  </button>
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
