'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { IdeaBoard } from '@/components/ideas/IdeaBoard'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { CHANNEL_TYPE_LABELS } from '@/lib/constants'
import type { Idea, ChannelType } from '@/lib/types'

const CREATE_BUTTON_LABEL = '\uC0C8 \uC544\uC774\uB514\uC5B4'
const CREATE_MODAL_TITLE = '\uC544\uC774\uB514\uC5B4 \uCD94\uAC00'
const TITLE_LABEL = '\uC81C\uBAA9'
const TITLE_PLACEHOLDER = '\uC544\uC774\uB514\uC5B4 \uC81C\uBAA9'
const BODY_LABEL = '\uB0B4\uC6A9'
const BODY_PLACEHOLDER = '\uC544\uC774\uB514\uC5B4 \uB0B4\uC6A9\uC744 \uC790\uC720\uB86D\uAC8C \uC801\uC5B4\uBCF4\uC138\uC694'
const CHANNEL_LABEL = '\uCC44\uB110'
const CHANNEL_OPTION_PLACEHOLDER = '\uC120\uD0DD \uC548 \uD568'
const CANCEL_LABEL = '\uCDE8\uC18C'
const SAVE_PENDING_LABEL = '\uC800\uC7A5 \uC911...'
const CREATE_LABEL = '\uCD94\uAC00'

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', channel_type: '' })
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

  const handleCreate = async () => {
    if (!form.title.trim()) return

    setSaving(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from('ideas')
      .insert({
        user_id: user.id,
        title: form.title,
        body: form.body || null,
        channel_type: (form.channel_type as ChannelType) || null,
      } as never)
      .select()
      .single()

    if (data) {
      setIdeas((prev) => [data as Idea, ...prev])
      setForm({ title: '', body: '', channel_type: '' })
      setShowCreate(false)
    }

    setSaving(false)
  }

  const handleArchive = async (idea: Idea) => {
    const supabase = createClient()
    await supabase.from('ideas').update({ is_archived: true } as never).eq('id', idea.id)
    setIdeas((prev) => prev.filter((item) => item.id !== idea.id))
  }

  const handleConvert = async (idea: Idea) => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: card } = await supabase
      .from('content_cards')
      .insert({
        user_id: user.id,
        title: idea.title,
        memo: idea.body,
        status: 'idea',
        idea_id: idea.id,
      } as never)
      .select()
      .single()

    if (card) {
      const cardData = card as { id: string }
      await supabase
        .from('ideas')
        .update({ converted_card_id: cardData.id } as never)
        .eq('id', idea.id)

      setIdeas((prev) =>
        prev.map((item) => (item.id === idea.id ? { ...item, converted_card_id: cardData.id } : item))
      )
    }
  }

  return (
    <div className="flex flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 md:p-5">
        <div className="flex items-center justify-end">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            {CREATE_BUTTON_LABEL}
          </Button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : (
        <IdeaBoard ideas={ideas} onConvert={handleConvert} onArchive={handleArchive} />
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={CREATE_MODAL_TITLE}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            id="idea-title"
            label={TITLE_LABEL}
            placeholder={TITLE_PLACEHOLDER}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">{BODY_LABEL}</label>
            <textarea
              rows={4}
              placeholder={BODY_PLACEHOLDER}
              value={form.body}
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-[background-color,border-color,color,box-shadow] placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">{CHANNEL_LABEL}</label>
            <select
              value={form.channel_type}
              onChange={(event) => setForm((prev) => ({ ...prev, channel_type: event.target.value }))}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-[background-color,border-color,color,box-shadow] focus-visible:border-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]"
            >
              <option value="">{CHANNEL_OPTION_PLACEHOLDER}</option>
              {Object.entries(CHANNEL_TYPE_LABELS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
              {CANCEL_LABEL}
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={saving || !form.title.trim()}
            >
              {saving ? SAVE_PENDING_LABEL : CREATE_LABEL}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
