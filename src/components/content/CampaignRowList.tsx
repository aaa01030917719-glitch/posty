import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  SCRIPT_PART_BADGE_CLASSES,
  SCRIPT_PART_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '@/lib/constants'
import type { ContentCard } from '@/lib/types'

interface CampaignRowListProps {
  cards: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

function getCardScriptParts(card: ContentCard) {
  const scripts = card.scripts ?? []

  return [
    {
      label: SCRIPT_PART_LABELS.body,
      active: scripts.some((script) => hasText(script.body)),
      className: SCRIPT_PART_BADGE_CLASSES.body,
    },
    {
      label: SCRIPT_PART_LABELS.caption,
      active: scripts.some((script) => hasText(script.caption)),
      className: SCRIPT_PART_BADGE_CLASSES.caption,
    },
    {
      label: SCRIPT_PART_LABELS.hashtags,
      active: scripts.some((script) => hasText(script.hashtags)),
      className: SCRIPT_PART_BADGE_CLASSES.hashtags,
    },
    {
      label: SCRIPT_PART_LABELS.thumbnail,
      active: scripts.some((script) => hasText(script.thumbnail_text)),
      className: SCRIPT_PART_BADGE_CLASSES.thumbnail,
    },
  ].filter((item) => item.active)
}

function ContentRow({
  card,
  onCardClick,
}: {
  card: ContentCard
  onCardClick?: (card: ContentCard) => void
}) {
  const scheduled = card.scheduled_at || card.published_at
  const projectTitle = card.project?.title?.trim()
  const scriptParts = getCardScriptParts(card)

  return (
    <button
      type="button"
      onClick={() => onCardClick?.(card)}
      className="group grid w-full gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow] hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <span className="min-w-0">
        {projectTitle && (
          <span className="mb-1 block truncate text-xs text-[var(--color-text-muted)]">
            {projectTitle}
          </span>
        )}
        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-text-primary)]">
          {card.title}
        </span>
        {scriptParts.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {scriptParts.map((part) => (
              <span
                key={`${card.id}-${part.label}`}
                className={`rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold ${part.className}`}
              >
                {part.label}
              </span>
            ))}
          </span>
        )}
      </span>

      <span className="flex flex-wrap items-center gap-2 text-xs md:justify-end">
        {card.channel && (
          <span className="text-[var(--color-text-secondary)]">{card.channel.name}</span>
        )}
        <Badge label={STATUS_LABELS[card.status]} color={STATUS_COLORS[card.status]} />
        {scheduled && (
          <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <Calendar size={11} />
            <span className="font-mono">
              {format(new Date(scheduled), 'M/d(E)', { locale: ko })}
            </span>
          </span>
        )}
      </span>
    </button>
  )
}

export function CampaignRowList({ cards, onCardClick }: CampaignRowListProps) {
  if (cards.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      {cards.map((card) => (
        <ContentRow key={card.id} card={card} onCardClick={onCardClick} />
      ))}
    </div>
  )
}
