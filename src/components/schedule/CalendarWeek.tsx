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
    <div className="bg-white border border-[#F0F0F0] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
        <h2 className="text-base font-semibold text-[#1A1A1A]">
          {format(weekStart, 'M월 d일', { locale: ko })} –{' '}
          {format(weekEnd, 'M월 d일', { locale: ko })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="p-1.5 rounded-[8px] text-[#9CA3AF] hover:bg-[#F5F5F5] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-xs rounded-[8px] text-[#6B7280] hover:bg-[#F5F5F5] transition-colors font-medium"
          >
            이번 주
          </button>
          <button
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            className="p-1.5 rounded-[8px] text-[#9CA3AF] hover:bg-[#F5F5F5] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 divide-x divide-[#F0F0F0]">
        {days.map((day, i) => {
          const dayCards = getCardsForDate(day)
          const today = isToday(day)
          return (
            <div key={day.toISOString()} className="min-h-[200px] p-3">
              <div className="flex flex-col items-center mb-3 gap-0.5">
                <span className="text-[10px] text-[#9CA3AF]">
                  {['일', '월', '화', '수', '목', '금', '토'][i]}
                </span>
                <span
                  className={clsx(
                    'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium font-mono',
                    today ? 'bg-[#E8917E] text-white' : 'text-[#1A1A1A]'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {dayCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => onCardClick?.(card)}
                    className="px-2 py-1 rounded-[6px] text-xs font-medium truncate cursor-pointer hover:opacity-80 transition-opacity"
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
