'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { CampaignRowList, type CampaignRowGroup } from '@/components/content/CampaignRowList'
import { createContentCard } from '@/components/content/createContentCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { ContentCard, ContentProjectSummary, ContentStatus, Database } from '@/lib/types'

type CampaignInsert = Database['public']['Tables']['content_projects']['Insert']

const STATUS_FILTERS: Array<ContentStatus | 'all'> = [
  'all',
  'idea',
  'planning',
  'writing',
  'review',
  'scheduled',
  'published',
  'hold',
]

const SEARCH_PLACEHOLDER = '\uCF58\uD150\uCE20 \uAC80\uC0C9...'
const NEW_CONTENT_LABEL = '\uC0C8 \uCF58\uD150\uCE20'
const NEW_CAMPAIGN_LABEL = '\uC0C8 \uCEA0\uD398\uC778'
const CREATING_LABEL = '\uC0DD\uC131 \uC911...'
const CREATING_CAMPAIGN_LABEL = '\uCEA0\uD398\uC778 \uC0DD\uC131 \uC911...'
const PREVIEW_LABEL = '\uC5D0\uB514\uD130 \uBBF8\uB9AC\uBCF4\uAE30'
const CAMPAIGN_SUCCESS_TOAST = '\uCEA0\uD398\uC778\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4'
const NO_CAMPAIGN_GROUP_TITLE = '\uCEA0\uD398\uC778 \uC5C6\uC74C'
const EMPTY_STATE_TITLE = '\uCF58\uD150\uCE20\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const EMPTY_STATE_DESCRIPTION =
  '\uBAA9\uB85D\uC740 \uBE44\uC5B4 \uC788\uC9C0\uB9CC \uAE00 \uC791\uC131 \uD654\uBA74 shell\uC740 \uBC14\uB85C \uBBF8\uB9AC\uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
const EMPTY_FILTERED_TITLE =
  '\uC870\uAC74\uC5D0 \uB9DE\uB294 \uCF58\uD150\uCE20\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const EMPTY_FILTERED_DESCRIPTION =
  '\uAC80\uC0C9\uC5B4\uB098 \uC0C1\uD0DC \uD544\uD130\uB97C \uC870\uC815\uD574\uBCF4\uC138\uC694'
const DUPLICATE_CAMPAIGN_ERROR = '\uC774\uBBF8 \uCD94\uAC00\uB41C \uCEA0\uD398\uC778\uC785\uB2C8\uB2E4'
const CREATE_CONTENT_ERROR =
  '\uC0C8 \uCF58\uD150\uCE20\uB97C \uC0DD\uC131\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
const CREATE_CAMPAIGN_ERROR =
  '\uCEA0\uD398\uC778\uC744 \uC0DD\uC131\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
const CAMPAIGN_SECTION_TITLE = '\uCEA0\uD398\uC778'
const CAMPAIGN_COUNT_SUFFIX = '\uAC1C'
const CAMPAIGN_HELP_TEXT =
  '\uC0DD\uC131\uD55C \uCEA0\uD398\uC778\uC740 \uD558\uC704 \uCF58\uD150\uCE20\uB97C \uD3BC\uCCD0 \uBE60\uB974\uAC8C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
const NO_CAMPAIGNS_TEXT =
  '\uC544\uC9C1 \uC0DD\uC131\uB41C \uCEA0\uD398\uC778\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8 \uCEA0\uD398\uC778\uC744 \uCD94\uAC00\uD574 \uCF58\uD150\uCE20\uB97C \uBB36\uC5B4\uBCF4\uC138\uC694.'
const CAMPAIGN_TITLE_LABEL = '\uCEA0\uD398\uC778 \uC81C\uBAA9'
const CAMPAIGN_TITLE_PLACEHOLDER =
  '\uC608: Posty \uCF58\uD150\uCE20 \uD504\uB85C\uC81D\uD2B8'
const CAMPAIGN_DESCRIPTION_LABEL = '\uC124\uBA85'
const OPTIONAL_PLACEHOLDER = '\uC120\uD0DD \uC0AC\uD56D'
const CANCEL_LABEL = '\uCDE8\uC18C'
const ALL_LABEL = '\uC804\uCCB4'

function normalizeCampaignTitle(title: string) {
  return title.trim().toLocaleLowerCase()
}

export default function ContentPage() {
  const router = useRouter()
  const [cards, setCards] = useState<ContentCard[]>([])
  const [projects, setProjects] = useState<ContentProjectSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [campaignFormOpen, setCampaignFormOpen] = useState(false)
  const [campaignTitle, setCampaignTitle] = useState('')
  const [campaignDescription, setCampaignDescription] = useState('')
  const [campaignCreating, setCampaignCreating] = useState(false)
  const [campaignRequestError, setCampaignRequestError] = useState<string | null>(null)
  const [campaignToastOpen, setCampaignToastOpen] = useState(false)
  const [campaignToastNonce, setCampaignToastNonce] = useState(0)

  const normalizedCampaignTitle = normalizeCampaignTitle(campaignTitle)
  const campaignTitleError =
    normalizedCampaignTitle.length > 0 &&
    projects.some((project) => normalizeCampaignTitle(project.title) === normalizedCampaignTitle)
      ? DUPLICATE_CAMPAIGN_ERROR
      : undefined

  useEffect(() => {
    if (!campaignToastOpen) return

    const timer = window.setTimeout(() => {
      setCampaignToastOpen(false)
    }, 2800)

    return () => window.clearTimeout(timer)
  }, [campaignToastOpen, campaignToastNonce])

  useEffect(() => {
    const fetchContentData = async () => {
      const supabase = createClient()
      const [{ data: cardData, error: cardError }, { data: projectData, error: projectError }] =
        await Promise.all([
          supabase
            .from('content_cards')
            .select('*, channel:channels(*), project:content_projects(id,title)')
            .order('created_at', { ascending: false }),
          supabase
            .from('content_projects')
            .select('id, title')
            .order('created_at', { ascending: false }),
        ])

      if (cardError) {
        console.error('Failed to fetch content cards', cardError)
      }

      if (projectError) {
        console.error('Failed to fetch content projects', projectError)
      }

      setCards((cardData as ContentCard[]) ?? [])
      setProjects((projectData as ContentProjectSummary[]) ?? [])
      setLoading(false)
    }

    fetchContentData()
  }, [])

  const trimmedSearch = search.trim().toLowerCase()

  const groupedCampaigns = useMemo<CampaignRowGroup[]>(() => {
    const cardsByProjectId = new Map<string, ContentCard[]>()
    const uncategorizedCards: ContentCard[] = []

    cards.forEach((card) => {
      if (card.project_id) {
        const nextCards = cardsByProjectId.get(card.project_id) ?? []
        nextCards.push(card)
        cardsByProjectId.set(card.project_id, nextCards)
        return
      }

      uncategorizedCards.push(card)
    })

    const groups: CampaignRowGroup[] = projects.flatMap((project) => {
      const projectCards = cardsByProjectId.get(project.id) ?? []
      const matchesProjectTitle =
        trimmedSearch.length > 0 && project.title.toLowerCase().includes(trimmedSearch)

      const visibleCards = projectCards.filter((card) => {
        const matchesStatus = statusFilter === 'all' || card.status === statusFilter
        const matchesSearch =
          trimmedSearch.length === 0 ||
          matchesProjectTitle ||
          card.title.toLowerCase().includes(trimmedSearch)

        return matchesStatus && matchesSearch
      })

      const shouldShowEmptyProject =
        projectCards.length === 0 &&
        statusFilter === 'all' &&
        (trimmedSearch.length === 0 || matchesProjectTitle)

      if (!matchesProjectTitle && visibleCards.length === 0 && !shouldShowEmptyProject) {
        return []
      }

      return [
        {
          id: project.id,
          title: project.title,
          cards: visibleCards,
        },
      ]
    })

    const visibleUncategorizedCards = uncategorizedCards.filter((card) => {
      const matchesStatus = statusFilter === 'all' || card.status === statusFilter
      const matchesSearch =
        trimmedSearch.length === 0 || card.title.toLowerCase().includes(trimmedSearch)

      return matchesStatus && matchesSearch
    })

    if (visibleUncategorizedCards.length > 0) {
      groups.push({
        id: 'no-campaign',
        title: NO_CAMPAIGN_GROUP_TITLE,
        cards: visibleUncategorizedCards,
        isVirtual: true,
      })
    }

    return groups
  }, [cards, projects, statusFilter, trimmedSearch])

  const statusCounts = useMemo(() => {
    return cards.reduce<Record<ContentStatus, number>>(
      (acc, card) => {
        acc[card.status] += 1
        return acc
      },
      {
        idea: 0,
        planning: 0,
        writing: 0,
        review: 0,
        scheduled: 0,
        published: 0,
        hold: 0,
      }
    )
  }, [cards])

  const openDetail = (card: ContentCard) => {
    router.push(`/content/${card.id}`)
  }

  const handleCreateContent = async () => {
    if (creating) return

    setCreating(true)

    try {
      const nextId = await createContentCard()
      router.push(`/content/${nextId}`)
    } catch (error) {
      console.error('Failed to create content card', error)
      window.alert(CREATE_CONTENT_ERROR)
    } finally {
      setCreating(false)
    }
  }

  const handleCreateCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedTitle = campaignTitle.trim()

    if (!normalizedTitle || campaignCreating || campaignTitleError) return

    setCampaignCreating(true)
    setCampaignRequestError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error('Authenticated user not found')
      }

      const payload: CampaignInsert = {
        user_id: user.id,
        title: normalizedTitle,
        description: campaignDescription.trim() ? campaignDescription.trim() : null,
        status: 'active',
        start_date: null,
        end_date: null,
      }

      const { data, error } = await supabase
        .from('content_projects')
        .insert(payload)
        .select('id, title')
        .single()

      if (error) {
        throw error
      }

      const nextProject = data as ContentProjectSummary

      setProjects((prev) => [nextProject, ...prev])
      setCampaignTitle('')
      setCampaignDescription('')
      setCampaignFormOpen(false)
      setCampaignToastOpen(true)
      setCampaignToastNonce((prev) => prev + 1)
    } catch (error) {
      console.error('Failed to create campaign', error)
      setCampaignRequestError(CREATE_CAMPAIGN_ERROR)
    } finally {
      setCampaignCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      {campaignToastOpen && (
        <Toast
          message={CAMPAIGN_SUCCESS_TOAST}
          onAction={() => setCampaignToastOpen(false)}
        />
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-sm">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <Input
              type="text"
              value={search}
              placeholder={SEARCH_PLACEHOLDER}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center justify-end gap-2 lg:ml-auto">
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={() => {
                setCampaignFormOpen((prev) => !prev)
                setCampaignRequestError(null)
              }}
            >
              <Plus size={14} />
              {NEW_CAMPAIGN_LABEL}
            </Button>
            <Button size="sm" className="shrink-0" onClick={handleCreateContent} disabled={creating}>
              <Plus size={14} />
              {creating ? CREATING_LABEL : NEW_CONTENT_LABEL}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={clsx(
                'whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                statusFilter === value
                  ? value === 'all'
                    ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-surface)]'
                    : 'text-[var(--color-bg-surface)]'
                  : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border-default)] hover:bg-[var(--color-bg-subtle)]'
              )}
              style={
                statusFilter === value && value !== 'all'
                  ? { backgroundColor: STATUS_COLORS[value as ContentStatus] }
                  : undefined
              }
            >
              {value === 'all' ? ALL_LABEL : STATUS_LABELS[value]}
              {value !== 'all' && <span className="ml-1 opacity-70">{statusCounts[value]}</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {CAMPAIGN_SECTION_TITLE}
              </p>
              <span className="text-xs text-[var(--color-text-muted)]">
                {projects.length}
                {CAMPAIGN_COUNT_SUFFIX}
              </span>
            </div>
            {!campaignFormOpen && !loading && projects.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">{CAMPAIGN_HELP_TEXT}</p>
            )}
          </div>

          {campaignFormOpen && (
            <form
              onSubmit={handleCreateCampaign}
              className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] pt-3"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-start">
                <Input
                  label={CAMPAIGN_TITLE_LABEL}
                  type="text"
                  value={campaignTitle}
                  onChange={(event) => setCampaignTitle(event.target.value)}
                  placeholder={CAMPAIGN_TITLE_PLACEHOLDER}
                  maxLength={120}
                  disabled={campaignCreating}
                  error={campaignTitleError}
                />

                <Input
                  label={CAMPAIGN_DESCRIPTION_LABEL}
                  type="text"
                  value={campaignDescription}
                  onChange={(event) => setCampaignDescription(event.target.value)}
                  placeholder={OPTIONAL_PLACEHOLDER}
                  maxLength={200}
                  disabled={campaignCreating}
                />

                <div className="flex gap-2 lg:pt-6">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={campaignCreating || !campaignTitle.trim() || Boolean(campaignTitleError)}
                  >
                    {campaignCreating ? CREATING_CAMPAIGN_LABEL : NEW_CAMPAIGN_LABEL}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={campaignCreating}
                    onClick={() => {
                      setCampaignFormOpen(false)
                      setCampaignTitle('')
                      setCampaignDescription('')
                      setCampaignRequestError(null)
                    }}
                  >
                    {CANCEL_LABEL}
                  </Button>
                </div>
              </div>
              {campaignRequestError && (
                <p className="text-xs text-[var(--color-danger)]">{campaignRequestError}</p>
              )}
            </form>
          )}

          {!loading && projects.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">{NO_CAMPAIGNS_TEXT}</p>
          )}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : cards.length === 0 && projects.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-20 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
            +
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_STATE_TITLE}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{EMPTY_STATE_DESCRIPTION}</p>
          <div className="mt-4 flex justify-center">
            <Button size="sm" onClick={() => router.push('/content/preview')}>
              {PREVIEW_LABEL}
            </Button>
          </div>
        </div>
      ) : groupedCampaigns.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-16 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_FILTERED_TITLE}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{EMPTY_FILTERED_DESCRIPTION}</p>
        </div>
      ) : (
        <CampaignRowList groups={groupedCampaigns} onCardClick={openDetail} />
      )}
    </div>
  )
}
