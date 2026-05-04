import { IdeaCard } from './IdeaCard'
import type { Idea } from '@/lib/types'

interface IdeaBoardProps {
  ideas: Idea[]
  onConvert?: (idea: Idea) => void
  onArchive?: (idea: Idea) => void
}

const EMPTY_TITLE = '\uC544\uC774\uB514\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const EMPTY_DESCRIPTION = '\uC0C8 \uC544\uC774\uB514\uC5B4\uB97C \uCD94\uAC00\uD574\uBCF4\uC138\uC694'

export function IdeaBoard({ ideas, onConvert, onArchive }: IdeaBoardProps) {
  if (ideas.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
          ?
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_TITLE}</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{EMPTY_DESCRIPTION}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onConvert={onConvert}
          onArchive={onArchive}
        />
      ))}
    </div>
  )
}
