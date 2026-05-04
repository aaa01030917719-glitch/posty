import { ContentCard } from './ContentCard'
import type { ContentCard as ContentCardType } from '@/lib/types'

interface CardGridProps {
  cards: ContentCardType[]
  onCardClick?: (card: ContentCardType) => void
}

export function CardGrid({ cards, onCardClick }: CardGridProps) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {cards.map((card) => (
        <ContentCard key={card.id} card={card} onClick={() => onCardClick?.(card)} />
      ))}
    </div>
  )
}
