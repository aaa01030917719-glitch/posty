'use client'

import { useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import type { ContentCard } from '@/lib/types'
import { STATUS_COLORS } from '@/lib/constants'

interface CalendarMonthProps {
  cards: ContentCard[]
  onDateClick?: (date: Date) => void
  onCardClick?: (card: ContentCard) => void
}

const WEEKDAY_LABELS = [
  '\uC77C',
  '\uC6D4',
  '\uD654',
  '\uC218',
  '\uBAA9',
  '\uAE08',
  '\uD1A0',
]

const TODAY_BUTTON_LABEL = '\uC624\uB298'
const MORE_SUFFIX = '\uAC1C'

export function CalendarMonth({ cards, onDateClick, onCardClick }: CalendarMonthProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getCardsForDate = (date: Date) =>
    cards.filter((card) => {
      const target = card.scheduled_at || card.published_at
      return target && isSameDay(new Date(target), date)
    })

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {format(currentDate, 'yyyy\uB144 M\uC6D4', { locale: ko })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            {TODAY_BUTTON_LABEL}
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--color-border-default)] bg-[var(--color-bg-canvas)]">
        {WEEKDAY_LABELS.map((dayLabel, index) => (
          <div
            key={dayLabel}
            className={clsx(
              'py-2.5 text-center text-xs font-medium',
              index === 0
                ? 'text-red-400'
                : index === 6
                  ? 'text-blue-400'
                  : 'text-[var(--color-text-muted)]'
            )}
          >
            {dayLabel}
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
                !isLastRow && 'border-b border-[var(--color-border-default)]',
                !isLastColumn && 'border-r border-[var(--color-border-default)]',
                isCurrentMonth
                  ? 'bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-subtle)]'
                  : 'bg-[var(--color-bg-canvas)]'
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={clsx(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-medium',
                    today
                      ? 'bg-[var(--color-accent)] text-[var(--color-bg-surface)]'
                      : !isCurrentMonth
                        ? 'text-[var(--color-text-muted)]'
                        : index % 7 === 0
                          ? 'text-red-400'
                          : index % 7 === 6
                            ? 'text-blue-400'
                            : 'text-[var(--color-text-secondary)]'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                {dayCards.slice(0, 3).map((card) => (
                  <div
                    key={card.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      onCardClick?.(card)
                    }}
                    className="truncate rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: `${STATUS_COLORS[card.status]}20`,
                      color: STATUS_COLORS[card.status],
                    }}
                  >
                    {card.title}
                  </div>
                ))}
                {dayCards.length > 3 && (
                  <span className="pl-1 text-[10px] text-[var(--color-text-muted)]">
                    +{dayCards.length - 3}
                    {MORE_SUFFIX}
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
