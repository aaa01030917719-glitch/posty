'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutGrid, List, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { CardGrid } from '@/components/content/CardGrid'
import { CardList } from '@/components/content/CardList'
import { createContentCard } from '@/components/content/createContentCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { STATUS_COLORS } from '@/lib/constants'
import type { ContentCard, ContentStatus } from '@/lib/types'

type ViewMode = 'grid' | 'list'

const STATUS_FILTERS: { value: ContentStatus | 'all'; label: string }[] = [
  { value: 'all', label: '\uC804\uCCB4' },
  { value: 'idea', label: '\uC544\uC774\uB514\uC5B4' },
  { value: 'planning', label: '\uAE30\uD68D\uC911' },
  { value: 'writing', label: '\uC791\uC131\uC911' },
  { value: 'review', label: '\uAC80\uC218\uC911' },
  { value: 'scheduled', label: '\uC608\uC57D' },
  { value: 'published', label: '\uBC1C\uD589' },
  { value: 'hold', label: '\uBCF4\uB958' },
]

const SEARCH_PLACEHOLDER = '\uCF58\uD150\uCE20 \uAC80\uC0C9...'
const NEW_CONTENT_LABEL = '\uC0C8 \uCF58\uD150\uCE20'
const CREATING_LABEL = '\uC0DD\uC131 \uC911...'
const PREVIEW_LABEL = '\uC5D0\uB514\uD130 \uBBF8\uB9AC\uBCF4\uAE30'

export default function ContentPage() {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('grid')
  const [cards, setCards] = useState<ContentCard[]>([])
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

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

  const openDetail = (card: ContentCard) => {
    router.push(`/content/${card.id}`)
  }

  const handleCreateContent = async () => {
    if (creating) return

    setCreating(true)

    try {
      const nextId = await createContentCard()
      router.push(`/content/${nextId}`)
    } catch (error) {
      console.error('Failed to create content card', error)
      window.alert('새 콘텐츠를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <Input
              type="text"
              value={search}
              placeholder={SEARCH_PLACEHOLDER}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center justify-between gap-2 lg:ml-auto">
            <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-canvas)] p-0.5">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView('grid')}
                className={clsx(
                  'rounded-[var(--radius-sm)] p-1.5 transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  view === 'grid'
                    ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView('list')}
                className={clsx(
                  'rounded-[var(--radius-sm)] p-1.5 transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  view === 'list'
                    ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <List size={15} />
              </button>
            </div>

            <Button size="sm" className="shrink-0" onClick={handleCreateContent} disabled={creating}>
              <Plus size={14} />
              {creating ? CREATING_LABEL : NEW_CONTENT_LABEL}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto border-t border-[var(--color-border-default)] pt-4 pb-1">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={clsx(
                'whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                statusFilter === value
                  ? value === 'all'
                    ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-surface)]'
                    : 'text-[var(--color-bg-surface)]'
                  : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]'
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
                  {cards.filter((card) => card.status === value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-20 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
            +
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">콘텐츠가 없습니다</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            목록은 비어 있지만, 글 작성 화면 shell은 바로 미리볼 수 있습니다.
          </p>
          <div className="mt-4 flex justify-center">
            <Button size="sm" onClick={() => router.push('/content/preview')}>
              {PREVIEW_LABEL}
            </Button>
          </div>
        </div>
      ) : view === 'grid' ? (
        <CardGrid cards={filtered} onCardClick={openDetail} />
      ) : (
        <CardList cards={filtered} onCardClick={openDetail} />
      )}
    </div>
  )
}
