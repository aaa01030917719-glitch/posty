import type { CSSProperties, ReactNode } from 'react'
import type { ContentCard } from '@/lib/types'

interface ScheduleCardPreviewProps {
  card: ContentCard
  children: ReactNode
  className?: string
}

const EMPTY_PREVIEW_MESSAGE = '\uC791\uC131\uB41C \uB0B4\uC6A9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'
const SCHEDULE_CARD_PALETTE = [
  { bg: '#fff1f2', border: '#ffe4e6', hoverBorder: '#fda4af' },
  { bg: '#fff7ed', border: '#ffedd5', hoverBorder: '#fdba74' },
  { bg: '#fffbeb', border: '#fef3c7', hoverBorder: '#fcd34d' },
  { bg: '#f0fdf4', border: '#dcfce7', hoverBorder: '#86efac' },
  { bg: '#f0fdfa', border: '#ccfbf1', hoverBorder: '#5eead4' },
  { bg: '#eff6ff', border: '#dbeafe', hoverBorder: '#93c5fd' },
  { bg: '#eef2ff', border: '#e0e7ff', hoverBorder: '#a5b4fc' },
  { bg: '#f5f3ff', border: '#ede9fe', hoverBorder: '#c4b5fd' },
] as const

type ScheduleCardToneStyle = CSSProperties & {
  '--schedule-card-bg': string
  '--schedule-card-border': string
  '--schedule-card-border-hover': string
}

function getStablePaletteIndex(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash % SCHEDULE_CARD_PALETTE.length
}

export function getScheduleCardToneStyle(card: ContentCard): ScheduleCardToneStyle {
  const key = card.project_id || card.id
  const tone = SCHEDULE_CARD_PALETTE[getStablePaletteIndex(key)]

  return {
    '--schedule-card-bg': tone.bg,
    '--schedule-card-border': tone.border,
    '--schedule-card-border-hover': tone.hoverBorder,
  }
}

export function ScheduleCardPreview({ card, children, className }: ScheduleCardPreviewProps) {
  const body = card.memo?.trim() ?? ''
  const title = card.title?.trim() || '\uC81C\uBAA9 \uC5C6\uC74C'

  return (
    <div className={className ?? 'relative'}>
      {children}
      <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-[240px] rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 py-2.5 text-left shadow-[0_14px_32px_rgba(15,23,42,0.12)] group-hover:block group-focus-within:block">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-1 overflow-hidden break-words text-xs leading-5 text-[var(--color-text-muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5]">
          {body || EMPTY_PREVIEW_MESSAGE}
        </p>
      </div>
    </div>
  )
}
