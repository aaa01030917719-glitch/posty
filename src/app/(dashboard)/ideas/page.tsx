'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { IdeaBoard } from '@/components/ideas/IdeaBoard'
import { createClient } from '@/lib/supabase/client'
import type { Idea } from '@/lib/types'

const IDEA_PLACEHOLDER = '\uC544\uC774\uB514\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694'
const CREATE_LABEL = '\uCD94\uAC00'
const SAVE_ERROR_MESSAGE =
  '\uC544\uC774\uB514\uC5B4\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
const UPDATE_ERROR_MESSAGE =
  '\uC544\uC774\uB514\uC5B4\uB97C \uC218\uC815\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [newIdeaTitle, setNewIdeaTitle] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchIdeas()
  }, [])

  const fetchIdeas = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    setIdeas((data as Idea[]) ?? [])
    setLoading(false)
  }

  const handleCreate = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    const title = newIdeaTitle.trim()

    if (!title || saving) return

    setSaving(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from('ideas')
        .insert({
          user_id: user.id,
          title,
          body: null,
          channel_type: null,
        } as never)
        .select()
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setIdeas((prev) => [data as Idea, ...prev])
        setNewIdeaTitle('')
      }
    } catch (error) {
      console.error('Failed to create idea', error)
      window.alert(SAVE_ERROR_MESSAGE)
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (idea: Idea) => {
    const supabase = createClient()
    await supabase.from('ideas').update({ is_archived: true } as never).eq('id', idea.id)
    setIdeas((prev) => prev.filter((item) => item.id !== idea.id))
  }

  const handleUpdateTitle = async (idea: Idea, title: string) => {
    const nextTitle = title.trim()

    if (!nextTitle || nextTitle === idea.title) {
      return true
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ideas')
        .update({ title: nextTitle } as never)
        .eq('id', idea.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setIdeas((prev) =>
          prev.map((item) => (item.id === idea.id ? (data as Idea) : item))
        )
      }

      return true
    } catch (error) {
      console.error('Failed to update idea', error)
      window.alert(UPDATE_ERROR_MESSAGE)
      return false
    }
  }

  return (
    <div className="flex flex-col gap-3 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <form
        onSubmit={handleCreate}
        className="flex w-full items-center gap-3 pb-1"
      >
        <input
          type="text"
          value={newIdeaTitle}
          onChange={(event) => setNewIdeaTitle(event.target.value)}
          placeholder={IDEA_PLACEHOLDER}
          className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus-visible:[box-shadow:var(--focus-ring)]"
          disabled={saving}
        />
        <button
          type="submit"
          disabled={saving || !newIdeaTitle.trim()}
          className="shrink-0 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted-soft)]"
        >
          {CREATE_LABEL}
        </button>
      </form>

      {loading ? (
        <div className="flex w-full items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : (
        <IdeaBoard ideas={ideas} onArchive={handleArchive} onUpdateTitle={handleUpdateTitle} />
      )}
    </div>
  )
}
