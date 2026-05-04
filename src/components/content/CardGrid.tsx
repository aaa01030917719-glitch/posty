import { ContentCard } from './ContentCard'
import type { ContentCard as ContentCardType } from '@/lib/types'

const EMPTY_TITLE = '\uCF58\uD150\uCE20\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const EMPTY_DESCRIPTION = '\uC0C8 \uCF58\uD150\uCE20 \uCE74\uB4DC\uB97C \uCD94\uAC00\uD574\uBCF4\uC138\uC694'

interface CardGridProps {
  cards: ContentCardType[]
  onCardClick?: (card: ContentCardType) => void
}

export function CardGrid({ cards, onCardClick }: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
          +
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_TITLE}</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{EMPTY_DESCRIPTION}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {cards.map((card) => (
        <ContentCard key={card.id} card={card} onClick={() => onCardClick?.(card)} />
      ))}
    </div>
  )
}
