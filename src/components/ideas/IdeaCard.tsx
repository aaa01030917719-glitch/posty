'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import type { Idea } from '@/lib/types'

interface IdeaCardProps {
  idea: Idea
  onArchive?: (idea: Idea) => void
  onUpdateTitle?: (idea: Idea, title: string) => Promise<boolean>
}

const DELETE_LABEL = '\uC0AD\uC81C'

export function IdeaCard({ idea, onArchive, onUpdateTitle }: IdeaCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(idea.title)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraft(idea.title)
    }
  }, [editing, idea.title])

  const commitEdit = async () => {
    if (saving) return

    const nextTitle = draft.trim()

    if (!nextTitle) {
      setDraft(idea.title)
      setEditing(false)
      return
    }

    if (!onUpdateTitle || nextTitle === idea.title) {
      setDraft(idea.title)
      setEditing(false)
      return
    }

    setSaving(true)
    const saved = await onUpdateTitle(idea, nextTitle)
    setSaving(false)

    if (saved) {
      setEditing(false)
    }
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commitEdit()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(idea.title)
      setEditing(false)
    }
  }

  return (
    <div className="flex min-h-10 items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            type="text"
            value={draft}
            autoFocus
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void commitEdit()}
            onKeyDown={handleEditKeyDown}
            className="h-7 w-full border-0 bg-transparent p-0 text-sm text-[var(--color-text-primary)] outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:text-[var(--color-text-muted)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (onUpdateTitle) {
                setEditing(true)
              }
            }}
            className="block w-full truncate text-left text-sm text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            {idea.title}
          </button>
        )}
      </div>

      {onArchive && (
        <button
          type="button"
          onClick={() => onArchive(idea)}
          className="shrink-0 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
        >
          {DELETE_LABEL}
        </button>
      )}
    </div>
  )
}
