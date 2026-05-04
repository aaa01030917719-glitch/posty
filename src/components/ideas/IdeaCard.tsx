'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ArrowRight, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { CHANNEL_COLORS, CHANNEL_TYPE_LABELS } from '@/lib/constants'
import type { Idea } from '@/lib/types'

interface IdeaCardProps {
  idea: Idea
  onConvert?: (idea: Idea) => void
  onArchive?: (idea: Idea) => void
}

export function IdeaCard({ idea, onConvert, onArchive }: IdeaCardProps) {
  return (
    <div className="bg-white border border-[#F0F0F0] rounded-[12px] p-4 flex flex-col gap-3 hover:border-[#E8917E]/30 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        {idea.channel_type && (
          <Badge
            label={CHANNEL_TYPE_LABELS[idea.channel_type]}
            color={CHANNEL_COLORS[idea.channel_type]}
          />
        )}
        <span className="text-xs text-[#9CA3AF] font-mono ml-auto shrink-0">
          {format(new Date(idea.created_at), 'M/d', { locale: ko })}
        </span>
      </div>

      <p className="text-sm font-medium text-[#1A1A1A] leading-snug">{idea.title}</p>

      {idea.body && (
        <p className="text-xs text-[#9CA3AF] line-clamp-2 leading-relaxed">{idea.body}</p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-1">
        {!idea.converted_card_id && onConvert && (
          <button
            onClick={() => onConvert(idea)}
            className="flex items-center gap-1 text-xs text-[#E8917E] hover:underline font-medium"
          >
            <ArrowRight size={12} />
            콘텐츠로 전환
          </button>
        )}
        {idea.converted_card_id && (
          <span className="text-xs text-[#47C9A2] font-medium">✓ 전환됨</span>
        )}
        {onArchive && (
          <button
            onClick={() => onArchive(idea)}
            className="ml-auto text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
          >
            <Archive size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
