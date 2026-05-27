'use client'

import { format } from 'date-fns'
import type { ContentCard } from '@/lib/types'

interface CampaignRowListProps {
  cards: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

const UPLOAD_DATE_PREFIX = '업로드 날짜'
const NO_UPLOAD_DATE_LABEL = `${UPLOAD_DATE_PREFIX} 미정`
const FALLBACK_CONTENT_TYPE_LABEL = '콘텐츠'

function getScheduleValue(card: ContentCard) {
  return card.scheduled_at || card.published_at || null
}

function getTimeSlotLabel(value: Date) {
  const hours = value.getHours()

  if (hours < 12) return '오전'
  if (hours < 18) return '오후'
  return '저녁'
}

function formatUploadDate(value: string | null | undefined) {
  if (!value) return NO_UPLOAD_DATE_LABEL

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return NO_UPLOAD_DATE_LABEL

  return `${UPLOAD_DATE_PREFIX} ${format(date, 'yy. MM. dd')} ${getTimeSlotLabel(date)}`
}

function getContentTypeLabel(card: ContentCard) {
  return card.channel?.name?.trim() || card.format?.trim() || FALLBACK_CONTENT_TYPE_LABEL
}

export function CampaignRowList({ cards, onCardClick }: CampaignRowListProps) {
  if (cards.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-5">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onCardClick?.(card)}
          className="group block w-full px-0 py-1 text-left focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
        >
          <span className="flex items-center justify-between gap-4 text-[12px] text-[var(--color-text-muted)]">
            <span className="min-w-0 truncate font-semibold text-[var(--color-text-secondary)]">
              {getContentTypeLabel(card)}
            </span>
            <span className="shrink-0 font-medium">{formatUploadDate(getScheduleValue(card))}</span>
          </span>
          <span className="mt-1 block truncate text-sm font-medium text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)]">
            {card.title}
          </span>
        </button>
      ))}
    </div>
  )
}
