import { createClient } from '@supabase/supabase-js'
import { CHANNEL_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants'
import type { Channel, ChecklistItem, ContentProjectSummary, ContentStatus, Database } from '@/lib/types'

type SharePageProps = {
  params: Promise<{ token: string }>
}

type SharedCard = {
  id: string
  title: string
  format: string | null
  status: ContentStatus
  scheduled_at: string | null
  published_at: string | null
  memo: string | null
  checklist: ChecklistItem[] | null
  is_deleted: boolean
  project: ContentProjectSummary | null
  channel: Pick<Channel, 'id' | 'name' | 'type'> | null
}

type ShareLinkWithCard = {
  id: string
  card_id: string
  token: string
  is_enabled: boolean
  expires_at: string | null
  card: SharedCard | null
}

type SharedScript = {
  title: string | null
  body: string | null
  caption: string | null
  hashtags: string | null
  thumbnail_text: string | null
  panel_title: string | null
}

type SharedScene = {
  id: string
  number: number
  title: string
  body: string
}

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false

  const expires = new Date(expiresAt)

  if (Number.isNaN(expires.getTime())) {
    return true
  }

  return expires.getTime() <= Date.now()
}

function formatDateTime(value: string | null) {
  if (!value) return '미정'

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
    return '미정'
  }
}

function parseScenes(value: string | null): SharedScene[] | null {
  if (!value?.trim()) return null

  try {
    const parsed = JSON.parse(value) as unknown

    if (!Array.isArray(parsed)) {
      return null
    }

    const scenes = parsed
      .map((item, index) => {
        if (typeof item !== 'object' || item === null) return null

        const scene = item as Partial<SharedScene>
        const body = typeof scene.body === 'string' ? scene.body : ''
        const title = typeof scene.title === 'string' && scene.title.trim()
          ? scene.title
          : `Scene ${index + 1}`

        return {
          id: typeof scene.id === 'string' && scene.id.trim() ? scene.id : `scene-${index + 1}`,
          number: typeof scene.number === 'number' ? scene.number : index + 1,
          title,
          body,
        }
      })
      .filter((scene): scene is SharedScene => Boolean(scene))

    return scenes.length > 0 ? scenes : null
  } catch {
    return null
  }
}

function normalizeChecklist(value: ChecklistItem[] | null) {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id : `check-${index + 1}`,
      text: typeof item.text === 'string' ? item.text : '',
      done: Boolean(item.done),
    }))
    .filter((item) => item.text.trim())
}

function UnavailableSharePage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-canvas)] px-5 py-12 text-[var(--color-text-primary)]">
      <section className="mx-auto max-w-xl">
        <p className="text-xs font-semibold text-[var(--color-danger)]">공유 링크 확인 불가</p>
        <h1 className="mt-2 text-[24px] font-bold tracking-[-0.03em]">
          공유 링크를 사용할 수 없습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
          링크가 만료되었거나 비활성화되었을 수 있습니다.
        </p>
      </section>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-[var(--color-border-soft)] py-6">
      <h2 className="text-[13px] font-bold text-[var(--color-text-primary)]">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-[var(--color-text-body)]">{children}</div>
    </section>
  )
}

function EmptySection() {
  return <p className="text-sm text-[var(--color-text-muted)]">공유된 내용이 없습니다.</p>
}

export default async function ShareContentPage({ params }: SharePageProps) {
  const { token } = await params
  const supabase = createServiceClient()

  if (!supabase || !token) {
    return <UnavailableSharePage />
  }

  const { data: shareLink, error: shareLinkError } = await supabase
    .from('content_share_links')
    .select(
      `
        id,
        card_id,
        token,
        is_enabled,
        expires_at,
        card:content_cards(
          id,
          title,
          format,
          status,
          scheduled_at,
          published_at,
          memo,
          checklist,
          is_deleted,
          project:content_projects(id,title),
          channel:channels(id,name,type)
        )
      `
    )
    .eq('token', token)
    .maybeSingle()

  if (shareLinkError) {
    console.error('Failed to fetch content share link', shareLinkError)
  }

  const link = shareLink as ShareLinkWithCard | null
  const card = link?.card ?? null

  if (!link || !link.is_enabled || isExpired(link.expires_at) || !card || card.is_deleted) {
    return <UnavailableSharePage />
  }

  const { data: scriptData, error: scriptError } = await supabase
    .from('scripts')
    .select('title, body, caption, hashtags, thumbnail_text, panel_title')
    .eq('card_id', link.card_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (scriptError) {
    console.error('Failed to fetch shared script', scriptError)
  }

  const script = (scriptData as SharedScript | null) ?? null
  const scenes = parseScenes(script?.body ?? null)
  const checklist = normalizeChecklist(card.checklist)
  const channelLabel = card.channel
    ? `${card.channel.name} · ${CHANNEL_TYPE_LABELS[card.channel.type]}`
    : '채널 미정'

  return (
    <main className="min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex max-w-4xl flex-col px-5 py-8 md:px-8 md:py-12">
        <header className="pb-6">
          <p className="text-xs font-semibold text-[var(--color-accent)]">Posty 공유 콘텐츠</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] md:text-[36px]">
            {card.title}
          </h1>

          <dl className="mt-5 grid gap-3 text-sm text-[var(--color-text-muted)] sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[var(--color-text-muted-soft)]">
                캠페인
              </dt>
              <dd className="mt-1 text-[var(--color-text-body)]">
                {card.project?.title ?? '캠페인 없음'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[var(--color-text-muted-soft)]">
                채널
              </dt>
              <dd className="mt-1 text-[var(--color-text-body)]">{channelLabel}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[var(--color-text-muted-soft)]">
                상태
              </dt>
              <dd className="mt-1 text-[var(--color-text-body)]">{STATUS_LABELS[card.status]}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-[var(--color-text-muted-soft)]">
                업로드 예정일
              </dt>
              <dd className="mt-1 text-[var(--color-text-body)]">
                {formatDateTime(card.scheduled_at ?? card.published_at)}
              </dd>
            </div>
          </dl>
        </header>

        <Section title="원고">
          {card.memo?.trim() ? (
            <div className="whitespace-pre-wrap">{card.memo}</div>
          ) : (
            <EmptySection />
          )}
        </Section>

        <Section title={script?.panel_title?.trim() || '대본/씬'}>
          {scenes ? (
            <div className="space-y-4">
              {scenes.map((scene) => (
                <article key={scene.id} className="border-l-2 border-[var(--color-border-default)] pl-3">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                    Scene {scene.number}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                    {scene.title}
                  </h3>
                  {scene.body.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap text-[var(--color-text-body)]">
                      {scene.body}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : script?.body?.trim() ? (
            <div className="whitespace-pre-wrap">{script.body}</div>
          ) : (
            <EmptySection />
          )}
        </Section>

        <Section title="캡션">
          {script?.caption?.trim() ? (
            <div className="whitespace-pre-wrap">{script.caption}</div>
          ) : (
            <EmptySection />
          )}
        </Section>

        <Section title="해시태그">
          {script?.hashtags?.trim() ? (
            <div className="whitespace-pre-wrap text-[var(--color-accent)]">{script.hashtags}</div>
          ) : (
            <EmptySection />
          )}
        </Section>

        <Section title="썸네일 문구">
          {script?.thumbnail_text?.trim() ? (
            <p>{script.thumbnail_text}</p>
          ) : (
            <EmptySection />
          )}
        </Section>

        <Section title="체크리스트">
          {checklist.length > 0 ? (
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.done ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]'
                    }`}
                  />
                  <span className={item.done ? 'text-[var(--color-text-muted)] line-through' : ''}>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptySection />
          )}
        </Section>

        <footer className="border-t border-[var(--color-border-soft)] py-5 text-xs text-[var(--color-text-muted)]">
          이 페이지는 읽기 전용 공유 화면입니다.
        </footer>
      </div>
    </main>
  )
}
