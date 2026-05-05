'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutGrid, List, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { CardGrid } from '@/components/content/CardGrid'
import { CardList } from '@/components/content/CardList'
import { createContentCard } from '@/components/content/createContentCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { ContentCard, ContentProjectSummary, ContentStatus, Database } from '@/lib/types'

type ViewMode = 'grid' | 'list'
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

function normalizeCampaignTitle(title: string) {
  return title.trim().toLocaleLowerCase()
}

export default function ContentPage() {
  const router = useRouter()
  const [view, setView] = useState<ViewMode>('grid')
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
      ? '이미 추가된 캠페인입니다'
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
          supabase.from('content_projects').select('id, title').order('created_at', { ascending: false }),
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

  const filtered = cards.filter((card) => {
    const matchStatus = statusFilter === 'all' || card.status === statusFilter
    const matchSearch = !search || card.title.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

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
      window.alert('새 콘텐츠를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.')
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
      setCampaignRequestError('캠페인을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.')
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

          <div className="flex items-center justify-between gap-2 lg:ml-auto">
            <div className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-canvas)] p-0.5">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView('grid')}
                className={clsx(
                  'rounded-[var(--radius-sm)] p-1.5 transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  view === 'grid'
                    ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView('list')}
                className={clsx(
                  'rounded-[var(--radius-sm)] p-1.5 transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  view === 'list'
                    ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <List size={15} />
              </button>
            </div>

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
              {value === 'all' ? '\uC804\uCCB4' : STATUS_LABELS[value]}
              {value !== 'all' && (
                <span className="ml-1 opacity-70">
                  {cards.filter((card) => card.status === value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">캠페인</p>
              <span className="text-xs text-[var(--color-text-muted)]">{projects.length}개</span>
            </div>
            {!campaignFormOpen && !loading && projects.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">
                생성한 캠페인은 글 작성 페이지에서 바로 선택할 수 있습니다.
              </p>
            )}
          </div>

          {campaignFormOpen && (
            <form
              onSubmit={handleCreateCampaign}
              className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] pt-3"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-start">
                <Input
                  label="캠페인 제목"
                  type="text"
                  value={campaignTitle}
                  onChange={(event) => setCampaignTitle(event.target.value)}
                  placeholder="예: Posty 콘텐츠 프로젝트"
                  maxLength={120}
                  disabled={campaignCreating}
                  error={campaignTitleError}
                />

                <Input
                  label="설명"
                  type="text"
                  value={campaignDescription}
                  onChange={(event) => setCampaignDescription(event.target.value)}
                  placeholder="선택 사항"
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
                    취소
                  </Button>
                </div>
              </div>
              {campaignRequestError && (
                <p className="text-xs text-[var(--color-danger)]">{campaignRequestError}</p>
              )}
            </form>
          )}

          {!loading && (
            projects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {projects.map((project) => (
                  <span
                    key={project.id}
                    className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-body)]"
                  >
                    {project.title}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">
                아직 생성된 캠페인이 없습니다.
              </p>
            )
          )}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-20 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
            +
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">콘텐츠가 없습니다</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            목록은 비어 있지만, 글 작성 화면 shell은 바로 미리볼 수 있습니다.
          </p>
          <div className="mt-4 flex justify-center">
            <Button size="sm" onClick={() => router.push('/content/preview')}>
              {PREVIEW_LABEL}
            </Button>
          </div>
        </div>
      ) : view === 'grid' ? (
        <CardGrid cards={filtered} onCardClick={openDetail} />
      ) : (
        <CardList cards={filtered} onCardClick={openDetail} />
      )}
    </div>
  )
}
