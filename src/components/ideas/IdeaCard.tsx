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

const CONVERT_LABEL = '\uCF58\uD150\uCE20\uB85C \uBCC0\uD658'
const CONVERTED_LABEL = '\uBCC0\uD658\uB428'
const ARCHIVE_LABEL = '\uC544\uCE74\uC774\uBE0C'

export function IdeaCard({ idea, onConvert, onArchive }: IdeaCardProps) {
  return (
    <div className="group flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-2">
        {idea.channel_type && (
          <Badge
            label={CHANNEL_TYPE_LABELS[idea.channel_type]}
            color={CHANNEL_COLORS[idea.channel_type]}
          />
        )}
        <span className="ml-auto shrink-0 font-mono text-xs text-[var(--color-text-muted)]">
          {format(new Date(idea.created_at), 'M/d', { locale: ko })}
        </span>
      </div>

      <p className="text-sm font-medium leading-snug text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent)]">
        {idea.title}
      </p>

      {idea.body && (
        <p className="line-clamp-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {idea.body}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        {!idea.converted_card_id && onConvert && (
          <button
            type="button"
            onClick={() => onConvert(idea)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
            aria-label={CONVERT_LABEL}
          >
            <ArrowRight size={12} />
            {CONVERT_LABEL}
          </button>
        )}

        {idea.converted_card_id && (
          <span className="text-xs font-medium text-[var(--color-success)]">{CONVERTED_LABEL}</span>
        )}

        {onArchive && (
          <button
            type="button"
            onClick={() => onArchive(idea)}
            className="ml-auto rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
            aria-label={ARCHIVE_LABEL}
          >
            <Archive size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
