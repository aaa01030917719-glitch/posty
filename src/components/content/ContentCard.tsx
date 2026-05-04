'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, MoreHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_COLORS } from '@/lib/constants'
import type { ContentCard as ContentCardType } from '@/lib/types'

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
        'group flex min-h-[176px] cursor-pointer flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4',
        'transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:shadow-[var(--shadow-sm)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={STATUS_LABELS[card.status]} color={STATUS_COLORS[card.status]} />
          {card.channel && (
            <Badge
              label={card.channel.name}
              color={CHANNEL_COLORS[card.channel.type] ?? '#9CA3AF'}
            />
          )}
        </div>

        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)]">
        {card.title}
      </p>

      {card.memo && (
        <p className="line-clamp-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {card.memo}
        </p>
      )}

      {scheduled && (
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-[var(--color-text-muted)]">
          <Calendar size={11} strokeWidth={1.8} />
          <span className="font-mono">
            {format(new Date(scheduled), 'M/d(E)', { locale: ko })}
          </span>
        </div>
      )}
    </div>
  )
}
