'use client'

import { format } from 'date-fns'
import { isAttachmentContentMedia } from '@/lib/content-media-purpose'
import { getPlainTextPreview } from '@/lib/text-format'
import type { ContentCard, ContentCardMedia } from '@/lib/types'

type ContentCardMediaPreview = ContentCardMedia & { signedUrl?: string | null }
type ContentCardPreview = ContentCard & { media?: ContentCardMediaPreview[] }

interface CampaignRowListProps {
  cards: ContentCardPreview[]
  onCardClick?: (card: ContentCard) => void
}

const UPLOAD_DATE_PREFIX = '\uC5C5\uB85C\uB4DC \uB0A0\uC9DC'
const NO_UPLOAD_DATE_LABEL = `${UPLOAD_DATE_PREFIX} \uBBF8\uC815`
const NO_CAMPAIGN_LABEL = '\uCEA0\uD398\uC778 \uC5C6\uC74C'
const EMPTY_BODY_PREVIEW = '\uC6D0\uACE0 \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'

function getScheduleValue(card: ContentCard) {
  return card.scheduled_at || card.published_at || null
}

function getTimeSlotLabel(value: Date) {
  const hours = value.getHours()

  if (hours < 12) return '\uC624\uC804'
  if (hours < 18) return '\uC624\uD6C4'
  return '\uC800\uB141'
}

function formatUploadDate(value: string | null | undefined) {
  if (!value) return NO_UPLOAD_DATE_LABEL

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return NO_UPLOAD_DATE_LABEL

  return `${UPLOAD_DATE_PREFIX} ${format(date, 'yy. MM. dd')} ${getTimeSlotLabel(date)}`
}

function getCampaignLabel(card: ContentCard) {
  return card.project?.title?.trim() || NO_CAMPAIGN_LABEL
}

function getPrimaryMedia(card: ContentCardPreview): ContentCardMediaPreview | null {
  return card.media?.find((media) => isAttachmentContentMedia(media)) ?? null
}

function getCardPreviewText(card: ContentCardPreview) {
  return getPlainTextPreview(card.memo) || EMPTY_BODY_PREVIEW
}

export function CampaignRowList({ cards, onCardClick }: CampaignRowListProps) {
  if (cards.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4 sm:gap-5">
      {cards.map((card) => {
        const media = getPrimaryMedia(card)
        const previewText = getCardPreviewText(card)

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onCardClick?.(card)}
            className="group w-full min-w-0 overflow-hidden rounded-[12px] border border-[var(--color-border-soft)] bg-white text-left transition-colors hover:border-[var(--color-border-default)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <div className="flex aspect-[1.38] items-center justify-center overflow-hidden bg-[#F3F4F6]">
              {media?.signedUrl ? (
                media.media_type === 'image' ? (
                  <img
                    src={media.signedUrl}
                    alt={media.file_name ?? card.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video
                    src={media.signedUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                )
              ) : (
                <p className="line-clamp-6 whitespace-pre-line px-7 text-left text-[12px] font-normal leading-5 text-[var(--color-text-primary)]">
                  {previewText}
                </p>
              )}
            </div>

            <div className="space-y-1 px-4 py-3">
              <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)]">
                {getCampaignLabel(card)}
              </p>
              <p className="truncate text-sm font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)]">
                {card.title}
              </p>
              <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)]">
                {formatUploadDate(getScheduleValue(card))}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
