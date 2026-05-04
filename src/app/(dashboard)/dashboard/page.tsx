'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { ContentCard, ContentStatus } from '@/lib/types'

const STATUS_ORDER: ContentStatus[] = [
  'idea', 'planning', 'writing', 'review', 'scheduled', 'published', 'hold',
]

export default function DashboardPage() {
  const [cards, setCards] = useState<ContentCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('content_cards')
        .select('*, channel:channels(*)')
      setCards((data as ContentCard[]) ?? [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const total = cards.length
  const published = cards.filter((c) => c.status === 'published').length
  const inProgress = cards.filter((c) => ['planning', 'writing', 'review'].includes(c.status)).length

  const countByStatus = STATUS_ORDER.reduce(
    (acc, s) => ({ ...acc, [s]: cards.filter((c) => c.status === s).length }),
    {} as Record<ContentStatus, number>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-[#E8917E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-5 md:p-6 max-w-5xl">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '전체 콘텐츠', value: total, color: '#E8917E' },
          { label: '발행됨', value: published, color: '#47C9A2' },
          { label: '진행 중', value: inProgress, color: '#3B9EFF' },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white border border-[#F0F0F0] rounded-[12px] px-5 py-4"
          >
            <p className="text-xs text-[#9CA3AF] mb-1">{item.label}</p>
            <p
              className="text-3xl font-bold font-mono"
              style={{ color: item.color }}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="bg-white border border-[#F0F0F0] rounded-[12px] p-5">
        <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">상태별 현황</h2>
        <div className="flex flex-col gap-3">
          {STATUS_ORDER.map((status) => {
            const count = countByStatus[status]
            const pct = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={status} className="flex items-center gap-3">
                <div className="w-16 shrink-0">
                  <Badge label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} />
                </div>
                <div className="flex-1 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: STATUS_COLORS[status],
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[#6B7280] w-8 text-right shrink-0">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
