'use client'

import { useState } from 'react'
import { format, addDays, subDays, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import type { ContentCard } from '@/lib/types'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'

interface CalendarDayProps {
  cards: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

export function CalendarDay({ cards, onCardClick }: CalendarDayProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const dayCards = cards.filter((card) => {
    const target = card.scheduled_at || card.published_at
    if (!target) return false
    const d = new Date(target)
    return (
      d.getFullYear() === currentDate.getFullYear() &&
      d.getMonth() === currentDate.getMonth() &&
      d.getDate() === currentDate.getDate()
    )
  })

  const today = isToday(currentDate)

  return (
    <div className="bg-white border border-[#F0F0F0] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[#1A1A1A]">
            {format(currentDate, 'M월 d일 (E)', { locale: ko })}
          </h2>
          {today && (
            <span className="px-2 py-0.5 text-xs bg-[#FDF0ED] text-[#E8917E] rounded-full font-medium">
              오늘
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate(subDays(currentDate, 1))}
            className="p-1.5 rounded-[8px] text-[#9CA3AF] hover:bg-[#F5F5F5] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-xs rounded-[8px] text-[#6B7280] hover:bg-[#F5F5F5] transition-colors font-medium"
          >
            오늘
          </button>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
            className="p-1.5 rounded-[8px] text-[#9CA3AF] hover:bg-[#F5F5F5] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {dayCards.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-8">이 날 예정된 콘텐츠가 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {dayCards.map((card) => (
              <div
                key={card.id}
                onClick={() => onCardClick?.(card)}
                className="flex items-start gap-3 p-4 border border-[#F0F0F0] rounded-[10px] cursor-pointer hover:border-[#E8917E]/30 hover:bg-[#FDF0ED]/30 transition-all"
              >
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[card.status] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] truncate">{card.title}</p>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {STATUS_LABELS[card.status]}
                    {card.channel && ` · ${card.channel.name}`}
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
