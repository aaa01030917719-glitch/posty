'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { STATUS_COLORS, STATUS_LABELS, CHANNEL_COLORS } from '@/lib/constants'
import type { ContentCard, ContentStatus } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Square, ExternalLink } from 'lucide-react'

interface CardModalProps {
  card: ContentCard | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: (card: ContentCard) => void
}

const STATUS_OPTIONS: ContentStatus[] = ['idea', 'planning', 'writing', 'review', 'scheduled', 'published', 'hold']

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
      .select()
      .single()
    if (data) onUpdate?.(data as ContentCard)
    setSaving(false)
  }

  const toggleChecklist = async (itemId: string) => {
    const updated = card.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    )
    const supabase = createClient()
    const { data } = await supabase
      .from('content_cards')
      .update({ checklist: updated } as never)
      .eq('id', card.id)
      .select()
      .single()
    if (data) onUpdate?.(data as ContentCard)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={card.title} size="lg">
      <div className="flex flex-col gap-5">
        {/* Status + Channel */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge label={STATUS_LABELS[card.status]} color={STATUS_COLORS[card.status]} />
          {card.channel && (
            <Badge
              label={card.channel.name}
              color={CHANNEL_COLORS[card.channel.type] ?? '#9CA3AF'}
            />
          )}
          {scheduled && (
            <span className="text-xs text-[#9CA3AF] font-mono ml-auto">
              {format(new Date(scheduled), 'yyyy.M.d(E)', { locale: ko })}
            </span>
          )}
        </div>

        {/* Status change */}
        <div>
          <p className="text-xs font-medium text-[#6B7280] mb-2">상태 변경</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => handleStatusChange(s)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: card.status === s ? STATUS_COLORS[s] : `${STATUS_COLORS[s]}20`,
                  color: card.status === s ? 'white' : STATUS_COLORS[s],
                }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Memo */}
        {card.memo && (
          <div>
            <p className="text-xs font-medium text-[#6B7280] mb-1.5">메모</p>
            <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">
              {card.memo}
            </p>
          </div>
        )}

        {/* Reference URL */}
        {card.reference_url && (
          <div>
            <p className="text-xs font-medium text-[#6B7280] mb-1.5">참고 링크</p>
            <a
              href={card.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[#E8917E] hover:underline"
            >
              <ExternalLink size={12} />
              {card.reference_url}
            </a>
          </div>
        )}

        {/* Checklist */}
        {card.checklist && card.checklist.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#6B7280] mb-2">체크리스트</p>
            <div className="flex flex-col gap-1.5">
              {card.checklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleChecklist(item.id)}
                  className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
                >
                  {item.done ? (
                    <CheckSquare size={15} className="text-[#47C9A2] shrink-0" strokeWidth={2} />
                  ) : (
                    <Square size={15} className="text-[#D1D5DB] shrink-0" strokeWidth={1.5} />
                  )}
                  <span
                    className={`text-sm ${item.done ? 'line-through text-[#9CA3AF]' : 'text-[#1A1A1A]'}`}
                  >
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[#F0F0F0]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Modal>
  )
}
