'use client'

import { useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  addWeeks,
  subWeeks,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import type { ContentCard } from '@/lib/types'
import { STATUS_COLORS } from '@/lib/constants'

interface CalendarWeekProps {
  cards: ContentCard[]
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

const CURRENT_WEEK_LABEL = '\uC774\uBC88 \uC8FC'

export function CalendarWeek({ cards, onCardClick }: CalendarWeekProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const getCardsForDate = (date: Date) =>
    cards.filter((card) => {
      const target = card.scheduled_at || card.published_at
      return target && isSameDay(new Date(target), date)
    })

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {format(weekStart, 'M\uC6D4 d\uC77C', { locale: ko })} - {format(weekEnd, 'M\uC6D4 d\uC77C', { locale: ko })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            {CURRENT_WEEK_LABEL}
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 divide-x divide-[var(--color-border-default)]">
        {days.map((day, index) => {
          const dayCards = getCardsForDate(day)
          const today = isToday(day)

          return (
            <div key={day.toISOString()} className="min-h-[220px] bg-[var(--color-bg-surface)] p-3">
              <div className="mb-3 flex flex-col items-center gap-0.5">
                <span
                  className={clsx(
                    'text-[10px]',
                    index === 0
                      ? 'text-red-400'
                      : index === 6
                        ? 'text-blue-400'
                        : 'text-[var(--color-text-muted)]'
                  )}
                >
                  {WEEKDAY_LABELS[index]}
                </span>
                <span
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm font-medium',
                    today
                      ? 'bg-[var(--color-accent)] text-[var(--color-bg-surface)]'
                      : 'text-[var(--color-text-primary)]'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {dayCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => onCardClick?.(card)}
                    className="truncate rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: `${STATUS_COLORS[card.status]}20`,
                      color: STATUS_COLORS[card.status],
                    }}
                  >
                    {card.title}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
