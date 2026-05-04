import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_COLORS } from '@/lib/constants'
import type { ContentCard } from '@/lib/types'

interface CardListProps {
  cards: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

export function CardList({ cards, onCardClick }: CardListProps) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-3xl mb-3">📝</p>
        <p className="text-sm font-medium text-[#1A1A1A]">콘텐츠가 없습니다</p>
        <p className="text-xs text-[#9CA3AF] mt-1">새 콘텐츠 카드를 추가해보세요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-[#F0F0F0] bg-white border border-[#F0F0F0] rounded-[12px] overflow-hidden">
      {cards.map((card) => {
        const scheduled = card.scheduled_at || card.published_at
        return (
          <div
            key={card.id}
            onClick={() => onCardClick?.(card)}
            className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLORS[card.status] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A1A] truncate">{card.title}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge label={STATUS_LABELS[card.status]} color={STATUS_COLORS[card.status]} />
              {card.channel && (
                <Badge
                  label={card.channel.name}
                  color={CHANNEL_COLORS[card.channel.type] ?? '#9CA3AF'}
                />
              )}
              {scheduled && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-[#9CA3AF] font-mono">
                  <Calendar size={11} />
                  {format(new Date(scheduled), 'M/d(E)', { locale: ko })}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
