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

export function CalendarMonth({ cards, onDateClick, onCardClick }: CalendarMonthProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

  const getCardsForDate = (date: Date) =>
    cards.filter((card) => {
      const target = card.scheduled_at || card.published_at
      return target && isSameDay(new Date(target), date)
    })

  return (
    <div className="bg-white border border-[#F0F0F0] rounded-[12px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
        <h2 className="text-base font-semibold text-[#1A1A1A]">
          {format(currentDate, 'yyyy년 M월', { locale: ko })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-1.5 rounded-[8px] text-[#9CA3AF] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
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
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-1.5 rounded-[8px] text-[#9CA3AF] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[#F0F0F0]">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={clsx(
              'py-2.5 text-center text-xs font-medium',
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[#9CA3AF]'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayCards = getCardsForDate(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const isLastRow = idx >= days.length - 7

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateClick?.(day)}
              className={clsx(
                'min-h-[90px] p-2 border-b border-r border-[#F0F0F0] cursor-pointer transition-colors',
                !isLastRow && 'border-b',
                idx % 7 !== 6 && 'border-r',
                isCurrentMonth ? 'bg-white hover:bg-[#FAFAFA]' : 'bg-[#FAFAFA]/50',
              )}
            >
              <div className="flex justify-end mb-1">
                <span
                  className={clsx(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium font-mono',
                    today
                      ? 'bg-[#E8917E] text-white'
                      : !isCurrentMonth
                      ? 'text-[#D1D5DB]'
                      : idx % 7 === 0
                      ? 'text-red-400'
                      : idx % 7 === 6
                      ? 'text-blue-400'
                      : 'text-[#6B7280]'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {dayCards.slice(0, 3).map((card) => (
                  <div
                    key={card.id}
                    onClick={(e) => { e.stopPropagation(); onCardClick?.(card) }}
                    className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: `${STATUS_COLORS[card.status]}20`,
                      color: STATUS_COLORS[card.status],
                    }}
                  >
                    {card.title}
                  </div>
                ))}
                {dayCards.length > 3 && (
                  <span className="text-[10px] text-[#9CA3AF] pl-1">
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
