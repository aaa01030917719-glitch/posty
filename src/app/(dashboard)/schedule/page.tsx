'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { CalendarMonth } from '@/components/schedule/CalendarMonth'
import { CalendarWeek } from '@/components/schedule/CalendarWeek'
import { CalendarDay } from '@/components/schedule/CalendarDay'
import { CardModal } from '@/components/content/CardModal'
import { createClient } from '@/lib/supabase/client'
import type { ContentCard } from '@/lib/types'

type ViewMode = 'month' | 'week' | 'day'

const VIEW_LABELS: Record<ViewMode, string> = {
  month: '\uC6D4',
  week: '\uC8FC',
  day: '\uC77C',
}

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
    setCards((prev) => prev.map((card) => (card.id === updated.id ? updated : card)))
    setSelectedCard(updated)
  }

  const viewButtonClass = (targetView: ViewMode) =>
    clsx(
      'rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
      view === targetView
        ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
    )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 md:p-5">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-canvas)] p-0.5">
            {(['month', 'week', 'day'] as const).map((targetView) => (
              <button
                key={targetView}
                type="button"
                aria-pressed={view === targetView}
                onClick={() => setView(targetView)}
                className={viewButtonClass(targetView)}
              >
                {VIEW_LABELS[targetView]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : (
        <>
          {view === 'month' && (
            <CalendarMonth cards={cards} onCardClick={setSelectedCard} />
          )}
          {view === 'week' && (
            <CalendarWeek cards={cards} onCardClick={setSelectedCard} />
          )}
          {view === 'day' && (
            <CalendarDay cards={cards} onCardClick={setSelectedCard} />
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
