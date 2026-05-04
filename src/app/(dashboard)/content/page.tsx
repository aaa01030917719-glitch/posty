'use client'

import { useState, useEffect } from 'react'
import { Plus, LayoutGrid, List, Search } from 'lucide-react'
import { CardGrid } from '@/components/content/CardGrid'
import { CardList } from '@/components/content/CardList'
import { CardModal } from '@/components/content/CardModal'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import type { ContentCard, ContentStatus } from '@/lib/types'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { clsx } from 'clsx'

type ViewMode = 'grid' | 'list'

const STATUS_FILTERS: { value: ContentStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'idea', label: '아이디어' },
  { value: 'planning', label: '기획중' },
  { value: 'writing', label: '작성중' },
  { value: 'review', label: '검토중' },
  { value: 'scheduled', label: '예약됨' },
  { value: 'published', label: '발행됨' },
  { value: 'hold', label: '보류' },
]

export default function ContentPage() {
  const [view, setView] = useState<ViewMode>('grid')
  const [cards, setCards] = useState<ContentCard[]>([])
  const [selectedCard, setSelectedCard] = useState<ContentCard | null>(null)
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCards = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('content_cards')
        .select('*, channel:channels(*)')
        .order('created_at', { ascending: false })
      setCards((data as ContentCard[]) ?? [])
      setLoading(false)
    }
    fetchCards()
  }, [])

  const filtered = cards.filter((card) => {
    const matchStatus = statusFilter === 'all' || card.status === statusFilter
    const matchSearch = !search || card.title.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const handleCardUpdate = (updated: ContentCard) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setSelectedCard(updated)
  }

  return (
    <div className="p-5 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="콘텐츠 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#F0F0F0] rounded-[8px] outline-none focus:border-[#E8917E] focus:ring-2 focus:ring-[#E8917E]/10 bg-white placeholder-[#9CA3AF]"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-[#F5F5F5] rounded-[8px] p-0.5">
            <button
              onClick={() => setView('grid')}
              className={clsx('p-1.5 rounded-[6px] transition-all', view === 'grid' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#9CA3AF]')}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setView('list')}
              className={clsx('p-1.5 rounded-[6px] transition-all', view === 'list' ? 'bg-white shadow-sm text-[#1A1A1A]' : 'text-[#9CA3AF]')}
            >
              <List size={15} />
            </button>
          </div>
          <Button size="sm">
            <Plus size={14} />
            새 콘텐츠
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all',
              statusFilter === value
                ? value === 'all'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'text-white'
                : 'bg-[#F5F5F5] text-[#6B7280] hover:bg-[#EBEBEB]'
            )}
            style={
              statusFilter === value && value !== 'all'
                ? { backgroundColor: STATUS_COLORS[value as ContentStatus] }
                : undefined
            }
          >
            {label}
            {value !== 'all' && (
              <span className="ml-1 opacity-70">
                {cards.filter((c) => c.status === value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 border-2 border-[#E8917E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'grid' ? (
        <CardGrid cards={filtered} onCardClick={setSelectedCard} />
      ) : (
        <CardList cards={filtered} onCardClick={setSelectedCard} />
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
