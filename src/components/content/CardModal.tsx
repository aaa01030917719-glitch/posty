'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CheckSquare, Square, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { recordContentActivityLog } from '@/lib/content-activity-logs'
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
const EDIT_BUTTON_LABEL = '\uCF58\uD150\uCE20 \uD3B8\uC9D1\uD558\uAE30'

export function CardModal({ card, isOpen, onClose, onUpdate }: CardModalProps) {
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  if (!card) return null

  const scheduled = card.scheduled_at || card.published_at

  const handleStatusChange = async (status: ContentStatus) => {
    if (saving || status === card.status) return

    setSaving(true)

    try {
      const supabase = createClient()
      const previousStatus = card.status
      const { data, error } = await supabase
        .from('content_cards')
        .update({ status } as never)
        .eq('id', card.id)
        .select('*, channel:channels(*), project:content_projects(id,title)')
        .single()

      if (error) {
        console.error('Failed to update content status', error)
        return
      }

      if (!data) {
        return
      }

      const nextCard = data as ContentCard

      try {
        await recordContentActivityLog(
          {
            user_id: nextCard.user_id,
            card_id: nextCard.id,
            project_id: nextCard.project_id,
            action: 'status_changed',
            title: nextCard.title,
            description: '상태를 변경했습니다',
            metadata: {
              previous_status: previousStatus,
              next_status: nextCard.status,
              project_id: nextCard.project_id,
              scheduled_at: nextCard.scheduled_at,
            },
          },
          supabase
        )
      } catch (activityLogError) {
        console.warn('Failed to record status change activity log', activityLogError)
      }

      onUpdate?.(nextCard)
    } finally {
      setSaving(false)
    }
  }

  const toggleChecklist = async (itemId: string) => {
    const updatedChecklist = card.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    )

    const supabase = createClient()
    const { data, error } = await supabase
      .from('content_cards')
      .update({ checklist: updatedChecklist } as never)
      .eq('id', card.id)
      .select('*, channel:channels(*), project:content_projects(id,title)')
      .single()

    if (error) {
      console.error('Failed to update content checklist', error)
      return
    }

    if (!data) {
      return
    }

    const nextCard = data as ContentCard
    const checklistCount = nextCard.checklist.length
    const checkedCount = nextCard.checklist.filter((item) => item.done).length

    try {
      await recordContentActivityLog(
        {
          user_id: nextCard.user_id,
          card_id: nextCard.id,
          project_id: nextCard.project_id,
          action: 'checklist_updated',
          title: nextCard.title,
          description: '체크리스트를 수정했습니다',
          metadata: {
            checklist_count: checklistCount,
            checked_count: checkedCount,
            project_id: nextCard.project_id,
            scheduled_at: nextCard.scheduled_at,
          },
        },
        supabase
      )
    } catch (activityLogError) {
      console.warn('Failed to record checklist activity log', activityLogError)
    }

    onUpdate?.(nextCard)
  }

  const handleEditClick = () => {
    onClose()
    router.push(`/content/${card.id}`)
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

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              {STATUS_SECTION_TITLE}
            </p>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {STATUS_LABELS[card.status]}
            </span>
          </div>
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
                    card.status === status ? STATUS_COLORS[status] : `${STATUS_COLORS[status]}16`,
                  color:
                    card.status === status ? 'var(--color-bg-surface)' : STATUS_COLORS[status],
                }}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border-default)] pt-2">
          <Button size="sm" onClick={handleEditClick}>
            {EDIT_BUTTON_LABEL}
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {CLOSE_BUTTON_LABEL}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
