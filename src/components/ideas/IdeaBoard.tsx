import { IdeaCard } from './IdeaCard'
import type { Idea } from '@/lib/types'

interface IdeaBoardProps {
  ideas: Idea[]
  onConvert?: (idea: Idea) => void
  onArchive?: (idea: Idea) => void
}

export function IdeaBoard({ ideas, onConvert, onArchive }: IdeaBoardProps) {
  if (ideas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-3xl mb-3">💡</p>
        <p className="text-sm font-medium text-[#1A1A1A]">아이디어가 없습니다</p>
        <p className="text-xs text-[#9CA3AF] mt-1">새 아이디어를 추가해보세요</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
