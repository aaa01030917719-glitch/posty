import { IdeaCard } from './IdeaCard'
import type { Idea } from '@/lib/types'

interface IdeaBoardProps {
  ideas: Idea[]
  onArchive?: (idea: Idea) => void
  onUpdateTitle?: (idea: Idea, title: string) => Promise<boolean>
}

const EMPTY_TITLE = '\uC544\uC774\uB514\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'

export function IdeaBoard({ ideas, onArchive, onUpdateTitle }: IdeaBoardProps) {
  if (ideas.length === 0) {
    return (
      <p className="w-full py-6 text-sm text-[var(--color-text-muted)]">{EMPTY_TITLE}</p>
    )
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {ideas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          onArchive={onArchive}
          onUpdateTitle={onUpdateTitle}
        />
      ))}
    </div>
  )
}
