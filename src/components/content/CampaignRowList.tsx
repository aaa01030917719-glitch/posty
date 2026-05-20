import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, ChevronDown, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Badge } from '@/components/ui/Badge'
import { CHANNEL_COLORS, STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { Channel, ContentCard } from '@/lib/types'

export interface CampaignRowGroup {
  id: string
  title: string
  cards: ContentCard[]
}

interface CampaignRowListProps {
  groups: CampaignRowGroup[]
  ungroupedCards?: ContentCard[]
  onCardClick?: (card: ContentCard) => void
}

const EMPTY_GROUP_MESSAGE = '\uC544\uC9C1 \uCF58\uD150\uCE20\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const EXPANDED_ROWS_STORAGE_KEY = 'posty:content:expanded-campaign-rows'

function getGroupChannels(cards: ContentCard[]) {
  const uniqueChannels = new Map<string, Channel>()

  cards.forEach((card) => {
    if (!card.channel) return

    const key = card.channel.id || `${card.channel.type}:${card.channel.name}`

    if (!uniqueChannels.has(key)) {
      uniqueChannels.set(key, card.channel)
    }
  })

  return Array.from(uniqueChannels.values())
}

function ContentRow({
  card,
  nested = false,
  onCardClick,
}: {
  card: ContentCard
  nested?: boolean
  onCardClick?: (card: ContentCard) => void
}) {
  const scheduled = card.scheduled_at || card.published_at

  return (
    <button
      type="button"
      onClick={() => onCardClick?.(card)}
      className={clsx(
        'group flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
        !nested && 'border-b border-[var(--color-border-soft)] last:border-b-0'
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-normal text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-text-primary)]">
          {card.title}
        </span>
      </span>

      {card.channel && (
        <span className="hidden shrink-0 text-xs text-[var(--color-text-secondary)] sm:block">
          {card.channel.name}
        </span>
      )}

      <span className="shrink-0">
        <Badge label={STATUS_LABELS[card.status]} color={STATUS_COLORS[card.status]} />
      </span>

      {scheduled && (
        <span className="hidden shrink-0 items-center gap-1 text-xs text-[var(--color-text-muted)] lg:flex">
          <Calendar size={11} />
          <span className="font-mono">
            {format(new Date(scheduled), 'M/d(E)', { locale: ko })}
          </span>
        </span>
      )}
    </button>
  )
}

export function CampaignRowList({ groups, ungroupedCards = [], onCardClick }: CampaignRowListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [storageHydrated, setStorageHydrated] = useState(false)

  useEffect(() => {
    if (groups.length === 0) {
      setExpandedGroups({})
      setStorageHydrated(false)
      return
    }

    const availableGroupIds = new Set(groups.map((group) => group.id))
    const expandedGroupIds = new Set<string>()

    try {
      const rawValue = window.localStorage.getItem(EXPANDED_ROWS_STORAGE_KEY)

      if (rawValue) {
        const parsedValue = JSON.parse(rawValue)

        if (Array.isArray(parsedValue)) {
          parsedValue.forEach((value) => {
            if (typeof value !== 'string') return

            const groupId = value

            if (availableGroupIds.has(groupId)) {
              expandedGroupIds.add(groupId)
            }
          })
        }
      }
    } catch (error) {
      console.error('Failed to restore expanded campaign rows', error)
    }

    const next: Record<string, boolean> = {}

    groups.forEach((group) => {
      next[group.id] = expandedGroupIds.has(group.id)
    })

    setExpandedGroups(next)
    setStorageHydrated(true)
  }, [groups])

  useEffect(() => {
    if (!storageHydrated || groups.length === 0) return

    const expandedGroupIds = groups
      .filter((group) => expandedGroups[group.id])
      .map((group) => group.id)

    try {
      window.localStorage.setItem(
        EXPANDED_ROWS_STORAGE_KEY,
        JSON.stringify(expandedGroupIds)
      )
    } catch (error) {
      console.error('Failed to persist expanded campaign rows', error)
    }
  }, [expandedGroups, groups, storageHydrated])

  const groupChannels = useMemo(() => {
    const next = new Map<string, Channel[]>()

    groups.forEach((group) => {
      next.set(group.id, getGroupChannels(group.cards))
    })

    return next
  }, [groups])

  if (groups.length === 0 && ungroupedCards.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const isExpanded = expandedGroups[group.id] ?? false
        const channels = groupChannels.get(group.id) ?? []

        return (
          <section
            key={group.id}
            className="border-b border-[var(--color-border-soft)] last:border-b-0"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedGroups((prev) => ({
                  ...prev,
                  [group.id]: !isExpanded,
                }))
              }
              className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)]">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-[13px] font-medium text-[var(--color-text-primary)]"
                >
                  {group.title}
                </span>
              </span>

              {channels.length > 0 && (
                <span className="flex shrink-0 flex-wrap justify-end gap-2">
                  {channels.map((channel) => (
                    <Badge
                      key={channel.id}
                      label={channel.name}
                      color={CHANNEL_COLORS[channel.type] ?? '#9CA3AF'}
                    />
                  ))}
                </span>
              )}
            </button>

            {isExpanded && (
              group.cards.length > 0 ? (
                <div className="pb-1 pl-10">
                  {group.cards.map((card) => (
                    <ContentRow
                      key={card.id}
                      card={card}
                      nested
                      onCardClick={onCardClick}
                    />
                  ))}
                </div>
              ) : (
                <p className="pb-3 pl-10 text-xs text-[var(--color-text-muted)]">
                  {EMPTY_GROUP_MESSAGE}
                </p>
              )
            )}
          </section>
        )
      })}

      {ungroupedCards.length > 0 && (
        <div className={clsx(groups.length > 0 && 'pt-1')}>
          {ungroupedCards.map((card) => (
            <ContentRow key={card.id} card={card} onCardClick={onCardClick} />
          ))}
        </div>
      )}
    </div>
  )
}
