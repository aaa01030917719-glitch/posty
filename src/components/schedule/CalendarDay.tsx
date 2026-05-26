'use client'

import { format, isSameDay, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { ContentCard } from '@/lib/types'
import { ScheduleCardPreview, getScheduleCardToneStyle } from './ScheduleCardPreview'

interface CalendarDayProps {
  cards: ContentCard[]
  currentDate: Date
  onCardClick?: (card: ContentCard) => void
}

export function CalendarDay({ cards, currentDate, onCardClick }: CalendarDayProps) {
  const dayCards = cards.filter((card) => {
    const target = card.scheduled_at || card.published_at
    return target ? isSameDay(new Date(target), currentDate) : false
  })

  const today = isToday(currentDate)

  return (
    <div className="overflow-hidden rounded-[9px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="border-b border-[var(--color-border-soft)] px-6 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {format(currentDate, 'M월 d일 (E)', { locale: ko })}
          </h2>
          {today && (
            <span className="rounded-[999px] bg-[var(--color-bg-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
              오늘
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {dayCards.length === 0 ? (
          <div className="rounded-[6px] bg-[var(--color-bg-surface-soft)] px-6 py-16 text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              등록된 일정이 없습니다
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              다른 날짜를 선택해보세요
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {dayCards.map((card) => (
              <ScheduleCardPreview key={card.id} card={card} className="group relative min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={() => onCardClick?.(card)}
                  style={getScheduleCardToneStyle(card)}
                  className="box-border flex w-full max-w-full min-w-0 items-start gap-3 rounded-[6px] border border-[var(--schedule-card-border)] bg-[var(--schedule-card-bg)] p-4 text-left transition-[border-color] hover:border-[var(--schedule-card-border-hover)]"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[card.status] }}
                  />
                  <span className="min-w-0 flex-1">
                    {card.project?.title && (
                      <span className="block truncate text-[11px] font-medium text-[var(--color-text-muted)]">
                        {card.project.title}
                      </span>
                    )}
                    <span className="block min-w-0 break-words text-sm font-medium text-[var(--color-text-primary)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                      {card.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                      {STATUS_LABELS[card.status]}
                      {card.channel && ` / ${card.channel.name}`}
                    </span>
                  </span>
                </button>
              </ScheduleCardPreview>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
