import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_COLORS } from '@/lib/constants'
import type { ContentCard } from '@/lib/types'

const EMPTY_TITLE = '\uCF58\uD150\uCE20\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const EMPTY_DESCRIPTION = '\uC0C8 \uCF58\uD150\uCE20 \uCE74\uB4DC\uB97C \uCD94\uAC00\uD574\uBCF4\uC138\uC694'

interface CardListProps {
  cards: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

export function CardList({ cards, onCardClick }: CardListProps) {
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
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      {cards.map((card) => {
        const scheduled = card.scheduled_at || card.published_at

        return (
          <div
            key={card.id}
            onClick={() => onCardClick?.(card)}
            className="group flex cursor-pointer items-center gap-4 border-b border-[var(--color-border-default)] px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--color-bg-canvas)]"
          >
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[card.status] }}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)]">
                {card.title}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge label={STATUS_LABELS[card.status]} color={STATUS_COLORS[card.status]} />
              {card.channel && (
                <Badge
                  label={card.channel.name}
                  color={CHANNEL_COLORS[card.channel.type] ?? '#9CA3AF'}
                />
              )}
              {scheduled && (
                <span className="hidden items-center gap-1 font-mono text-xs text-[var(--color-text-muted)] sm:flex">
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
