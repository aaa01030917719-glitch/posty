'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { ContentCard, ContentStatus } from '@/lib/types'

const STATUS_ORDER: ContentStatus[] = [
  'idea',
  'planning',
  'writing',
  'review',
  'scheduled',
  'published',
  'hold',
]

const SUMMARY_ITEMS = [
  {
    key: 'total',
    label: '\uC804\uCCB4 \uCF58\uD150\uCE20',
    color: 'var(--color-accent)',
  },
  {
    key: 'published',
    label: '\uBC1C\uD589',
    color: 'var(--color-success)',
  },
  {
    key: 'inProgress',
    label: '\uC9C4\uD589 \uC911',
    color: 'var(--color-info)',
  },
] as const

const STATUS_SECTION_TITLE = '\uC0C1\uD0DC\uBCC4 \uD604\uD669'

export default function DashboardPage() {
  const [cards, setCards] = useState<ContentCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('content_cards')
        .select('*, channel:channels(*)')
        .eq('is_deleted', false)

      setCards((data as ContentCard[]) ?? [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const total = cards.length
  const published = cards.filter((card) => card.status === 'published').length
  const inProgress = cards.filter((card) =>
    ['planning', 'writing', 'review'].includes(card.status)
  ).length

  const summaryValues = {
    total,
    published,
    inProgress,
  }

  const countByStatus = STATUS_ORDER.reduce(
    (accumulator, status) => ({
      ...accumulator,
      [status]: cards.filter((card) => card.status === status).length,
    }),
    {} as Record<ContentStatus, number>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[var(--color-bg-canvas)] py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SUMMARY_ITEMS.map((item) => (
          <div
            key={item.key}
            className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-5 py-4"
          >
            <p className="mb-1 text-xs text-[var(--color-text-muted)]">{item.label}</p>
            <p className="font-mono text-3xl font-bold" style={{ color: item.color }}>
              {summaryValues[item.key]}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {STATUS_SECTION_TITLE}
        </h2>

        <div className="flex flex-col gap-3">
          {STATUS_ORDER.map((status) => {
            const count = countByStatus[status]
            const percentage = total > 0 ? (count / total) * 100 : 0

            return (
              <div key={status} className="flex items-center gap-3">
                <div className="w-16 shrink-0">
                  <Badge label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} />
                </div>

                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: STATUS_COLORS[status],
                    }}
                  />
                </div>

                <span className="w-8 shrink-0 text-right font-mono text-xs text-[var(--color-text-secondary)]">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
