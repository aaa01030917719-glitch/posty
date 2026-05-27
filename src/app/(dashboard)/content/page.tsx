'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { CampaignRowList } from '@/components/content/CampaignRowList'
import { createContentCard } from '@/components/content/createContentCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type {
  ContentCard,
  ContentCardMedia,
  ContentProjectSummary,
  ContentStatus,
  Database,
} from '@/lib/types'

type CampaignInsert = Database['public']['Tables']['content_projects']['Insert']
type ContentCardMediaPreview = ContentCardMedia & { signedUrl?: string | null }
type ContentCardWithMediaPreview = ContentCard & { media?: ContentCardMediaPreview[] }

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
const NO_CAMPAIGNS_TEXT =
  '\uC544\uC9C1 \uC0DD\uC131\uB41C \uCEA0\uD398\uC778\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC0C8 \uCEA0\uD398\uC778\uC744 \uCD94\uAC00\uD574 \uCF58\uD150\uCE20\uB97C \uBB36\uC5B4\uBCF4\uC138\uC694.'
const CAMPAIGN_TITLE_LABEL = '\uCEA0\uD398\uC778 \uC81C\uBAA9'
const CAMPAIGN_TITLE_PLACEHOLDER =
  '\uC608: Posty \uCF58\uD150\uCE20 \uD504\uB85C\uC81D\uD2B8'
const CAMPAIGN_DESCRIPTION_LABEL = '\uC124\uBA85'
const OPTIONAL_PLACEHOLDER = '\uC120\uD0DD \uC0AC\uD56D'
const CANCEL_LABEL = '\uCDE8\uC18C'
const ALL_LABEL = '\uC804\uCCB4'
const MEDIA_BUCKET_NAME = 'content-card-media'

function normalizeCampaignTitle(title: string) {
  return title.trim().toLocaleLowerCase()
}

async function attachMediaPreviewUrls(
  supabase: ReturnType<typeof createClient>,
  contentCards: ContentCard[]
): Promise<ContentCardWithMediaPreview[]> {
  const cardIds = contentCards.map((card) => card.id)

  if (cardIds.length === 0) {
    return contentCards
  }

  const { data, error } = await supabase
    .from('content_card_media')
    .select('id, user_id, card_id, storage_path, file_name, mime_type, media_type, sort_order, created_at')
    .in('card_id', cardIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch content media previews', error)
    return contentCards
  }

  const firstMediaByCard = ((data as ContentCardMedia[] | null) ?? []).reduce<
    Record<string, ContentCardMedia>
  >((acc, media) => {
    if (!acc[media.card_id]) {
      acc[media.card_id] = media
    }

    return acc
  }, {})

  const mediaWithUrls = await Promise.all(
    Object.values(firstMediaByCard).map(async (media) => {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(MEDIA_BUCKET_NAME)
        .createSignedUrl(media.storage_path, 60 * 60)

      if (signedError) {
        console.error('Failed to create content media preview URL', signedError)
      }

      return {
        ...media,
        signedUrl: signedData?.signedUrl ?? null,
      }
    })
  )

  const mediaPreviewByCard = mediaWithUrls.reduce<Record<string, ContentCardMediaPreview[]>>(
    (acc, media) => {
      acc[media.card_id] = [media]
      return acc
    },
    {}
  )

  return contentCards.map((card) => ({
    ...card,
    media: mediaPreviewByCard[card.id] ?? [],
  }))
}

export default function ContentPage() {
  const router = useRouter()
  const [cards, setCards] = useState<ContentCardWithMediaPreview[]>([])
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
  const [activeProjectFilter, setActiveProjectFilter] = useState<string>('all')

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
            .select(
              '*, channel:channels(*), project:content_projects(id,title), scripts(body,caption,hashtags,thumbnail_text)'
            )
            .eq('is_deleted', false)
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

      const nextCards = await attachMediaPreviewUrls(supabase, (cardData as ContentCard[]) ?? [])

      setCards(nextCards)
      setProjects((projectData as ContentProjectSummary[]) ?? [])
      setLoading(false)
    }

    fetchContentData()
  }, [])

  const trimmedSearch = search.trim().toLowerCase()

  const projectCardCounts = useMemo(() => {
    return cards.reduce<Record<string, number>>((acc, card) => {
      if (card.project_id) {
        acc[card.project_id] = (acc[card.project_id] ?? 0) + 1
      }

      return acc
    }, {})
  }, [cards])

  const visibleContentCards = useMemo(() => {
    return cards.filter((card) => {
      const projectTitle = card.project?.title?.toLowerCase() ?? ''
      const matchesStatus = statusFilter === 'all' || card.status === statusFilter
      const matchesProject =
        activeProjectFilter === 'all' || card.project_id === activeProjectFilter
      const matchesSearch =
        trimmedSearch.length === 0 ||
        card.title.toLowerCase().includes(trimmedSearch) ||
        projectTitle.includes(trimmedSearch)

      return matchesStatus && matchesProject && matchesSearch
    })
  }, [activeProjectFilter, cards, statusFilter, trimmedSearch])

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
      const nextProjectId = activeProjectFilter === 'all' ? null : activeProjectFilter
      const nextId = await createContentCard({ projectId: nextProjectId })
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
      setActiveProjectFilter(nextProject.id)
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
    <div className="flex min-h-full flex-col gap-5 bg-white p-5 md:p-6">
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
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-[var(--radius-xl)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {CAMPAIGN_SECTION_TITLE}
                </p>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {projects.length}
                  {CAMPAIGN_COUNT_SUFFIX}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCampaignFormOpen((prev) => !prev)
                  setCampaignRequestError(null)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                aria-label={NEW_CAMPAIGN_LABEL}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setActiveProjectFilter('all')}
                className={clsx(
                  'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  activeProjectFilter === 'all'
                    ? 'bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]'
                )}
              >
                <span className="font-semibold">{ALL_LABEL}</span>
                <span className="text-[var(--color-text-muted)]">{cards.length}</span>
              </button>

              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setActiveProjectFilter(project.id)}
                  className={clsx(
                    'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                    activeProjectFilter === project.id
                      ? 'bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]'
                  )}
                >
                  <span className="min-w-0 truncate font-medium">{project.title}</span>
                  <span className="shrink-0 text-[var(--color-text-muted)]">
                    {projectCardCounts[project.id] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {projects.length === 0 && (
              <p className="mt-3 px-1 text-xs leading-5 text-[var(--color-text-muted)]">
                {NO_CAMPAIGNS_TEXT}
              </p>
            )}
          </aside>

          <section className="min-w-0">
            {cards.length === 0 && projects.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-20 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
                  +
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {EMPTY_STATE_TITLE}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {EMPTY_STATE_DESCRIPTION}
                </p>
                <div className="mt-4 flex justify-center">
                  <Button size="sm" onClick={() => router.push('/content/preview')}>
                    {PREVIEW_LABEL}
                  </Button>
                </div>
              </div>
            ) : visibleContentCards.length === 0 ? (
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-16 text-center">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {EMPTY_FILTERED_TITLE}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {EMPTY_FILTERED_DESCRIPTION}
                </p>
              </div>
            ) : (
              <CampaignRowList cards={visibleContentCards} onCardClick={openDetail} />
            )}
          </section>
        </div>
      )}
    </div>
  )
}
