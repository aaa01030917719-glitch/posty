'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import type { ContentCard } from '@/lib/types'

interface CampaignRowListProps {
  cards: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

type CampaignGroup = {
  id: string
  title: string
  cards: ContentCard[]
  scheduledAt: string | null
}

const UNCATEGORIZED_GROUP_ID = '__uncategorized__'
const UNCATEGORIZED_GROUP_LABEL = '캠페인 없음'
const UPLOAD_DATE_PREFIX = '업로드 날짜'
const NO_UPLOAD_DATE_LABEL = `${UPLOAD_DATE_PREFIX} 미정`

function getScheduleValue(card: ContentCard) {
  return card.scheduled_at || card.published_at || null
}

function getTimeSlotLabel(value: Date) {
  const hours = value.getHours()

  if (hours < 12) return '오전'
  if (hours < 18) return '오후'
  return '저녁'
}

function formatUploadDate(value: string | null | undefined) {
  if (!value) return NO_UPLOAD_DATE_LABEL

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return NO_UPLOAD_DATE_LABEL

  return `${UPLOAD_DATE_PREFIX} ${format(date, 'yy. MM. dd')} ${getTimeSlotLabel(date)}`
}

function getGroupScheduledAt(cards: ContentCard[]) {
  return cards.map(getScheduleValue).find(Boolean) ?? null
}

function createCampaignGroups(cards: ContentCard[]) {
  const groups = new Map<string, CampaignGroup>()

  cards.forEach((card) => {
    const groupId = card.project_id || UNCATEGORIZED_GROUP_ID
    const groupTitle = card.project?.title?.trim() || UNCATEGORIZED_GROUP_LABEL
    const group = groups.get(groupId)

    if (group) {
      group.cards.push(card)
      group.scheduledAt = group.scheduledAt || getScheduleValue(card)
      return
    }

    groups.set(groupId, {
      id: groupId,
      title: groupTitle,
      cards: [card],
      scheduledAt: getScheduleValue(card),
    })
  })

  return Array.from(groups.values()).map((group) => ({
    ...group,
    scheduledAt: group.scheduledAt || getGroupScheduledAt(group.cards),
  }))
}

export function CampaignRowList({ cards, onCardClick }: CampaignRowListProps) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([])
  const campaignGroups = useMemo(() => createCampaignGroups(cards), [cards])

  if (campaignGroups.length === 0) {
    return null
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    )
  }

  return (
    <div className="border-y border-[var(--color-border-soft)]">
      {campaignGroups.map((group) => {
        const isCollapsed = collapsedGroupIds.includes(group.id)

        return (
          <section key={group.id} className="border-b border-[var(--color-border-soft)] last:border-b-0">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between gap-4 px-1 py-3 text-left transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {group.title}
                </span>
                <ChevronDown
                  size={14}
                  className={clsx(
                    'shrink-0 text-[var(--color-text-muted)] transition-transform',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </span>
              <span className="shrink-0 text-[12px] font-medium text-[var(--color-text-muted)]">
                {formatUploadDate(group.scheduledAt)}
              </span>
            </button>

            {!isCollapsed && (
              <div>
                {group.cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onCardClick?.(card)}
                    className="flex w-full items-center justify-between gap-4 border-t border-[var(--color-border-soft)] px-7 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                  >
                    <span className="min-w-0 truncate text-[13px] font-medium text-[var(--color-text-body)]">
                      {card.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                      {formatUploadDate(getScheduleValue(card))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
