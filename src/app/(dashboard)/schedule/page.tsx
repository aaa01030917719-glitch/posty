'use client'

import { useState, useEffect } from 'react'
import { CalendarMonth } from '@/components/schedule/CalendarMonth'
import { CalendarWeek } from '@/components/schedule/CalendarWeek'
import { CalendarDay } from '@/components/schedule/CalendarDay'
import { CardModal } from '@/components/content/CardModal'
import { createClient } from '@/lib/supabase/client'
import type { ContentCard } from '@/lib/types'
import { clsx } from 'clsx'

type ViewMode = 'month' | 'week' | 'day'

export default function SchedulePage() {
  const [view, setView] = useState<ViewMode>('month')
  const [cards, setCards] = useState<ContentCard[]>([])
  const [selectedCard, setSelectedCard] = useState<ContentCard | null>(null)
  const [loading, setLoading] = useState(true)

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
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setSelectedCard(updated)
  }

  const viewBtnClass = (v: ViewMode) =>
    clsx(
      'px-3 py-1.5 text-xs font-medium rounded-[8px] transition-all',
      view === v
        ? 'bg-[#E8917E] text-white'
        : 'text-[#6B7280] hover:bg-[#F5F5F5]'
    )

  return (
    <div className="p-5 md:p-6 max-w-6xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div />
        <div className="flex items-center gap-1 bg-[#F5F5F5] rounded-[10px] p-1">
          <button className={viewBtnClass('month')} onClick={() => setView('month')}>월</button>
          <button className={viewBtnClass('week')} onClick={() => setView('week')}>주</button>
          <button className={viewBtnClass('day')} onClick={() => setView('day')}>일</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 border-2 border-[#E8917E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {view === 'month' && (
            <CalendarMonth
              cards={cards}
              onCardClick={setSelectedCard}
            />
          )}
          {view === 'week' && (
            <CalendarWeek
              cards={cards}
              onCardClick={setSelectedCard}
            />
          )}
          {view === 'day' && (
            <CalendarDay
              cards={cards}
              onCardClick={setSelectedCard}
            />
          )}
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
