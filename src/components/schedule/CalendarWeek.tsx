'use client'

import { clsx } from 'clsx'
import { eachDayOfInterval, endOfWeek, format, isSameDay, isToday, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CHANNEL_COLORS, STATUS_BADGE_CLASSES, STATUS_LABELS } from '@/lib/constants'
import type { ContentCard } from '@/lib/types'

interface CalendarWeekProps {
  cards: ContentCard[]
  currentDate: Date
  onCardClick?: (card: ContentCard) => void
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const TIME_LABELS = ['오전', '오후', '저녁']

function getTargetDate(card: ContentCard) {
  const target = card.scheduled_at || card.published_at
  return target ? new Date(target) : null
}

function getChannelShortLabel(card: ContentCard) {
  if (!card.channel) return null

  switch (card.channel.type) {
    case 'instagram':
      return 'IG'
    case 'threads':
      return 'TH'
    case 'youtube':
      return 'YT'
    case 'blog':
      return 'BL'
    default:
      return 'ETC'
  }
}

export function CalendarWeek({ cards, currentDate, onCardClick }: CalendarWeekProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const getCardsForDate = (date: Date) =>
    cards
      .filter((card) => {
        const targetDate = getTargetDate(card)
        return targetDate ? isSameDay(targetDate, date) : false
      })
      .sort((left, right) => {
        const leftDate = getTargetDate(left)?.getTime() ?? 0
        const rightDate = getTargetDate(right)?.getTime() ?? 0
        return leftDate - rightDate
      })

  return (
    <div className="flex h-full min-h-[620px] w-full min-w-[980px] flex-col overflow-hidden rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="grid grid-cols-[52px_repeat(7,minmax(120px,1fr))] border-b border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]">
        <div className="border-r border-[var(--color-border-soft)]" />

        {days.map((day, index) => {
          const today = isToday(day)

          return (
            <div
              key={day.toISOString()}
              className="border-r border-[var(--color-border-soft)] px-2 py-[9px] text-center last:border-r-0"
            >
              <div
                className={clsx(
                  'mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                  index === 0
                    ? 'text-[var(--color-accent)]'
                    : index === 6
                      ? 'text-[var(--color-link-legal)]'
                      : 'text-[var(--color-text-muted-soft)]'
                )}
              >
                {WEEKDAY_LABELS[index]}
              </div>
              <div
                className={clsx(
                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold leading-none',
                  today
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : index === 0
                      ? 'text-[var(--color-accent)]'
                      : index === 6
                        ? 'text-[var(--color-link-legal)]'
                        : 'text-[var(--color-text-body)]'
                )}
              >
                {format(day, 'd', { locale: ko })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[52px_repeat(7,minmax(120px,1fr))] overflow-hidden bg-[var(--color-bg-surface)]">
        <div className="flex flex-col border-r border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] pt-3">
          {TIME_LABELS.map((label) => (
            <div key={label} className="flex flex-1 items-start px-1.5">
              <span className="text-[10px] font-medium text-[var(--color-text-muted-soft)]">
                {label}
              </span>
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayCards = getCardsForDate(day)

          return (
            <div
              key={`body-${day.toISOString()}`}
              className="flex min-w-0 flex-col gap-[5px] border-r border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-[5px] py-2 last:border-r-0"
            >
              {dayCards.map((card) => {
                const targetDate = getTargetDate(card)
                const channelColor = card.channel
                  ? CHANNEL_COLORS[card.channel.type] ?? '#929292'
                  : '#929292'
                const channelShortLabel = getChannelShortLabel(card)

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onCardClick?.(card)}
                    className="min-w-0 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 py-[7px] text-left transition-[border-color,background-color] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-surface-soft)]"
                  >
                    <div className="mb-1 flex items-center gap-1">
                      {channelShortLabel && (
                        <span
                          className="inline-flex rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${channelColor}14`,
                            color: channelColor,
                          }}
                        >
                          {channelShortLabel}
                        </span>
                      )}
                    </div>
                    {card.project?.title && (
                      <div className="truncate text-[10px] font-medium text-[var(--color-text-muted)]">
                        {card.project.title}
                      </div>
                    )}
                    <div className="truncate text-[13px] font-semibold leading-[1.35] text-[var(--color-text-primary)]">
                      {card.title}
                    </div>
                    {targetDate && (
                      <div className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
                        {format(targetDate, 'a h시', { locale: ko })}
                      </div>
                    )}
                    <span
                      className={clsx(
                        'mt-[3px] inline-flex rounded-[3px] px-[5px] py-[1.5px] text-[10px] font-semibold',
                        STATUS_BADGE_CLASSES[card.status]
                      )}
                    >
                      {STATUS_LABELS[card.status]}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
