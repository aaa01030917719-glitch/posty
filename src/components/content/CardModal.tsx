'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CheckSquare, Square, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_COLORS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { ContentCard, ContentStatus } from '@/lib/types'

interface CardModalProps {
  card: ContentCard | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (card: ContentCard) => void
}

const STATUS_OPTIONS: ContentStatus[] = ['idea', 'planning', 'writing', 'review', 'scheduled', 'published', 'hold']
const STATUS_SECTION_TITLE = '\uC0C1\uD0DC \uBCC0\uACBD'
const MEMO_SECTION_TITLE = '\uBA54\uBAA8'
const REFERENCE_SECTION_TITLE = '\uCC38\uACE0 \uB9C1\uD06C'
const CHECKLIST_SECTION_TITLE = '\uCCB4\uD06C\uB9AC\uC2A4\uD2B8'
const CLOSE_BUTTON_LABEL = '\uB2EB\uAE30'

export function CardModal({ card, isOpen, onClose, onUpdate }: CardModalProps) {
  const [saving, setSaving] = useState(false)

  if (!card) return null

  const scheduled = card.scheduled_at || card.published_at

  const handleStatusChange = async (status: ContentStatus) => {
    setSaving(true)

    const supabase = createClient()
    const { data } = await supabase
      .from('content_cards')
      .update({ status } as never)
      .eq('id', card.id)
      .select('*, channel:channels(*), project:content_projects(id,title)')
      .single()

    if (data) onUpdate?.(data as ContentCard)
    setSaving(false)
  }

  const toggleChecklist = async (itemId: string) => {
    const updatedChecklist = card.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    )

    const supabase = createClient()
    const { data } = await supabase
      .from('content_cards')
      .update({ checklist: updatedChecklist } as never)
      .eq('id', card.id)
      .select('*, channel:channels(*), project:content_projects(id,title)')
      .single()

    if (data) onUpdate?.(data as ContentCard)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="콘텐츠 상세" size="lg">
      <div className="flex flex-col gap-5">
        <section>
          {card.project?.title && (
            <p className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
              {card.project.title}
            </p>
          )}
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
            {card.title}
          </h2>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Badge label={STATUS_LABELS[card.status]} color={STATUS_COLORS[card.status]} />
          {card.channel && (
            <Badge
              label={card.channel.name}
              color={CHANNEL_COLORS[card.channel.type] ?? '#9CA3AF'}
            />
          )}
          {scheduled && (
            <span className="ml-auto font-mono text-xs text-[var(--color-text-muted)]">
              {format(new Date(scheduled), 'yyyy.M.d(E)', { locale: ko })}
            </span>
          )}
        </div>

        <section className="rounded-[var(--radius-lg)] bg-[var(--color-bg-canvas)] p-4">
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            {STATUS_SECTION_TITLE}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                disabled={saving}
                onClick={() => handleStatusChange(status)}
                className="rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:opacity-50"
                style={{
                  backgroundColor:
                    card.status === status ? STATUS_COLORS[status] : `${STATUS_COLORS[status]}20`,
                  color:
                    card.status === status ? 'var(--color-bg-surface)' : STATUS_COLORS[status],
                }}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </section>

        {card.memo && (
          <section>
            <p className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              {MEMO_SECTION_TITLE}
            </p>
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-canvas)] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
                {card.memo}
              </p>
            </div>
          </section>
        )}

        {card.reference_url && (
          <section>
            <p className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              {REFERENCE_SECTION_TITLE}
            </p>
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-canvas)] p-4">
              <a
                href={card.reference_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
              >
                <ExternalLink size={12} />
                {card.reference_url}
              </a>
            </div>
          </section>
        )}

        {card.checklist && card.checklist.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
              {CHECKLIST_SECTION_TITLE}
            </p>
            <div className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] bg-[var(--color-bg-canvas)] p-4">
              {card.checklist.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklist(item.id)}
                  className="flex items-center gap-2.5 rounded-[var(--radius-md)] text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                >
                  {item.done ? (
                    <CheckSquare
                      size={15}
                      className="shrink-0 text-[var(--color-success)]"
                      strokeWidth={2}
                    />
                  ) : (
                    <Square
                      size={15}
                      className="shrink-0 text-[var(--color-border-strong)]"
                      strokeWidth={1.5}
                    />
                  )}
                  <span
                    className={clsx(
                      'text-sm',
                      item.done
                        ? 'line-through text-[var(--color-text-muted)]'
                        : 'text-[var(--color-text-primary)]'
                    )}
                  >
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--color-border-default)] pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {CLOSE_BUTTON_LABEL}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
