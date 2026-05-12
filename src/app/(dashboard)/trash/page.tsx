'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { recordContentActivityLog } from '@/lib/content-activity-logs'
import { STATUS_LABELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { ContentCard } from '@/lib/types'

const PAGE_TITLE = '\uD734\uC9C0\uD1B5'
const PAGE_DESCRIPTION =
  '\uC0AD\uC81C\uB41C \uCF58\uD150\uCE20\uB97C \uD655\uC778\uD558\uACE0 \uD544\uC694\uD558\uBA74 \uB2E4\uC2DC \uBCF5\uAD6C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
const EMPTY_MESSAGE = '\uD734\uC9C0\uD1B5\uC5D0 \uCF58\uD150\uCE20\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const RESTORE_LABEL = '\uBCF5\uAD6C'
const RESTORING_LABEL = '\uBCF5\uAD6C \uC911...'
const RESTORE_CONFIRM = '\uC774 \uCF58\uD150\uCE20\uB97C \uBCF5\uAD6C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'
const RESTORE_ERROR =
  '\uCF58\uD150\uCE20\uB97C \uBCF5\uAD6C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
const NO_CAMPAIGN_LABEL = '\uCEA0\uD398\uC778 \uC5C6\uC74C'
const NO_CHANNEL_LABEL = '\uCC44\uB110 \uC5C6\uC74C'
const UNKNOWN_DATE_LABEL = '\uBBF8\uC815'
const UNTITLED_LABEL = 'Untitled content'

function formatDateTime(value: string | null) {
  if (!value) return UNKNOWN_DATE_LABEL

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getChannelLabel(card: ContentCard) {
  return card.channel?.name?.trim() || NO_CHANNEL_LABEL
}

export default function TrashPage() {
  const [cards, setCards] = useState<ContentCard[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    const fetchDeletedCards = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('content_cards')
        .select('*, channel:channels(*), project:content_projects(id,title)')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch deleted content cards', error)
      }

      setCards((data as ContentCard[] | null) ?? [])
      setLoading(false)
    }

    fetchDeletedCards()
  }, [])

  const handleRestore = async (card: ContentCard) => {
    if (restoringId) return

    const confirmed = window.confirm(RESTORE_CONFIRM)

    if (!confirmed) return

    setRestoringId(card.id)

    try {
      const supabase = createClient()
      const restoredAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('content_cards')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_reason: null,
        })
        .eq('id', card.id)
        .select('*, channel:channels(*), project:content_projects(id,title)')
        .single()

      if (error) {
        throw error
      }

      const restoredCard = data as ContentCard

      try {
        await recordContentActivityLog(
          {
            user_id: restoredCard.user_id,
            card_id: restoredCard.id,
            project_id: restoredCard.project_id ?? null,
            action: 'restored',
            title: restoredCard.title?.trim() || UNTITLED_LABEL,
            description: '\uCF58\uD150\uCE20\uB97C \uBCF5\uAD6C\uD588\uC2B5\uB2C8\uB2E4',
            metadata: {
              status: restoredCard.status,
              scheduled_at: restoredCard.scheduled_at,
              project_id: restoredCard.project_id,
              restored_at: restoredAt,
              source: 'trash',
            },
          },
          supabase
        )
      } catch (activityLogError) {
        console.warn('Failed to record content restore activity log', activityLogError)
      }

      setCards((prev) => prev.filter((item) => item.id !== restoredCard.id))
    } catch (error) {
      console.error('Failed to restore content card', error)
      window.alert(RESTORE_ERROR)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="space-y-1">
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
          {PAGE_TITLE}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{PAGE_DESCRIPTION}</p>
      </section>

      {loading ? (
        <div className="flex items-center justify-center border-t border-[var(--color-border-soft)] py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : cards.length === 0 ? (
        <p className="border-t border-[var(--color-border-soft)] pt-5 text-sm text-[var(--color-text-muted)]">
          {EMPTY_MESSAGE}
        </p>
      ) : (
        <ul className="border-t border-[var(--color-border-soft)]">
          {cards.map((card) => {
            const projectTitle = card.project?.title?.trim() || NO_CAMPAIGN_LABEL
            const title = card.title?.trim() || UNTITLED_LABEL
            const isRestoring = restoringId === card.id

            return (
              <li
                key={card.id}
                className="flex flex-col gap-3 border-b border-[var(--color-border-soft)] px-1 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-accent)]">
                      {STATUS_LABELS[card.status]}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDateTime(card.deleted_at)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span>{projectTitle}</span>
                    <span className="text-[var(--color-border-strong)]">/</span>
                    <span>{getChannelLabel(card)}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRestore(card)}
                  disabled={Boolean(restoringId)}
                  className="w-fit shrink-0"
                >
                  <RotateCcw size={14} />
                  {isRestoring ? RESTORING_LABEL : RESTORE_LABEL}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
