'use client'

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { clsx } from 'clsx'
import type { ContentCard } from '@/lib/types'
import { STATUS_COLORS } from '@/lib/constants'

interface CalendarMonthProps {
  cards: ContentCard[]
  currentDate: Date
  onDateClick?: (date: Date) => void
  onCardClick?: (card: ContentCard) => void
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarMonth({ cards, currentDate, onDateClick, onCardClick }: CalendarMonthProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getCardsForDate = (date: Date) =>
    cards.filter((card) => {
      const target = card.scheduled_at || card.published_at
      return target ? isSameDay(new Date(target), date) : false
    })

  return (
    <div className="overflow-hidden rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="grid grid-cols-7 border-b border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={clsx(
              'py-2.5 text-center text-xs font-medium',
              index === 0
                ? 'text-[var(--color-accent)]'
                : index === 6
                  ? 'text-[var(--color-link-legal)]'
                  : 'text-[var(--color-text-muted)]'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayCards = getCardsForDate(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const isLastRow = index >= days.length - 7
          const isLastColumn = index % 7 === 6

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateClick?.(day)}
              className={clsx(
                'min-h-[96px] cursor-pointer p-2 transition-colors',
                !isLastRow && 'border-b border-[var(--color-border-soft)]',
                !isLastColumn && 'border-r border-[var(--color-border-soft)]',
                isCurrentMonth
                  ? 'bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-soft)]'
                  : 'bg-[var(--color-bg-surface-soft)]'
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={clsx(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    today
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                      : !isCurrentMonth
                        ? 'text-[var(--color-text-muted)]'
                        : index % 7 === 0
                          ? 'text-[var(--color-accent)]'
                          : index % 7 === 6
                            ? 'text-[var(--color-link-legal)]'
                            : 'text-[var(--color-text-body)]'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {dayCards.slice(0, 3).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCardClick?.(card)
                    }}
                    className="truncate rounded-[4px] px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: `${STATUS_COLORS[card.status]}20`,
                      color: STATUS_COLORS[card.status],
                    }}
                  >
                    {card.project?.title && (
                      <span className="block truncate text-[9px] font-medium opacity-70">
                        {card.project.title}
                      </span>
                    )}
                    <span className="block truncate">{card.title}</span>
                  </button>
                ))}
                {dayCards.length > 3 && (
                  <span className="pl-1 text-[10px] text-[var(--color-text-muted)]">
                    +{dayCards.length - 3}개
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
