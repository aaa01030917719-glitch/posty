'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_COLORS } from '@/lib/constants'
import type { ContentCard as ContentCardType } from '@/lib/types'
import { clsx } from 'clsx'

interface ContentCardProps {
  card: ContentCardType
  onClick?: () => void
}

export function ContentCard({ card, onClick }: ContentCardProps) {
  const scheduled = card.scheduled_at || card.published_at

  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white border border-[#F0F0F0] rounded-[12px] p-4 cursor-pointer',
        'hover:border-[#E8917E]/30 hover:shadow-sm transition-all',
        'flex flex-col gap-3'
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            label={STATUS_LABELS[card.status]}
            color={STATUS_COLORS[card.status]}
          />
          {card.channel && (
            <Badge
              label={card.channel.name}
              color={CHANNEL_COLORS[card.channel.type] ?? '#9CA3AF'}
            />
          )}
        </div>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-[6px] text-[#9CA3AF] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shrink-0"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-[#1A1A1A] leading-snug line-clamp-2">
        {card.title}
      </p>

      {/* Memo */}
      {card.memo && (
        <p className="text-xs text-[#9CA3AF] line-clamp-2 leading-relaxed">
          {card.memo}
        </p>
      )}

      {/* Footer */}
      {scheduled && (
        <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] mt-auto pt-1">
          <Calendar size={11} strokeWidth={1.8} />
          <span className="font-mono">
            {format(new Date(scheduled), 'M/d(E)', { locale: ko })}
          </span>
        </div>
      )}
    </div>
  )
}
