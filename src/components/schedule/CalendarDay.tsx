'use client'

import { useState } from 'react'
import { format, addDays, subDays, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ContentCard } from '@/lib/types'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'

interface CalendarDayProps {
  cards: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

const TODAY_LABEL = '\uC624\uB298'
const EMPTY_TITLE = '\uB4F1\uB85D\uB41C \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'
const EMPTY_DESCRIPTION = '\uB2E4\uB978 \uB0A0\uC9DC\uB97C \uC120\uD0DD\uD574\uBCF4\uC138\uC694'

export function CalendarDay({ cards, onCardClick }: CalendarDayProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const dayCards = cards.filter((card) => {
    const target = card.scheduled_at || card.published_at
    if (!target) return false

    const targetDate = new Date(target)
    return (
      targetDate.getFullYear() === currentDate.getFullYear() &&
      targetDate.getMonth() === currentDate.getMonth() &&
      targetDate.getDate() === currentDate.getDate()
    )
  })

  const today = isToday(currentDate)

  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {format(currentDate, 'M\uC6D4 d\uC77C (E)', { locale: ko })}
          </h2>
          {today && (
            <span className="rounded-[var(--radius-pill)] bg-[var(--color-bg-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
              {TODAY_LABEL}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentDate(subDays(currentDate, 1))}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            {TODAY_LABEL}
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
            className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {dayCards.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-canvas)] px-6 py-16 text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_TITLE}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{EMPTY_DESCRIPTION}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dayCards.map((card) => (
              <div
                key={card.id}
                onClick={() => onCardClick?.(card)}
                className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 transition-[background-color,border-color,box-shadow] hover:border-[color:color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:bg-[var(--color-bg-accent-soft)] hover:shadow-[var(--shadow-sm)]"
              >
                <div
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[card.status] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {card.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {STATUS_LABELS[card.status]}
                    {card.channel && ` / ${card.channel.name}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
