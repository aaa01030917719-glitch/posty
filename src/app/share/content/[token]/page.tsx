import { createClient } from '@supabase/supabase-js'
import type { Database, ShareSection } from '@/lib/types'

type SharePageProps = {
  params: Promise<{ token: string }>
}

type SharedCard = {
  id: string
  title: string
  is_deleted: boolean
  share_sections: ShareSection[] | null
}

type ShareLinkWithCard = {
  id: string
  card_id: string
  token: string
  is_enabled: boolean
  expires_at: string | null
  card: SharedCard | null
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

function normalizeShareSections(value: ShareSection[] | null) {
  if (!Array.isArray(value)) return []

  return value
    .map((section, index) => {
      if (!section || typeof section !== 'object') return null

      const title = typeof section.title === 'string' ? section.title.trim() : ''
      const body = typeof section.body === 'string' ? section.body.trim() : ''

      if (!title && !body) return null

      return {
        id:
          typeof section.id === 'string' && section.id.trim()
            ? section.id
            : `section-${index + 1}`,
        title: title || `섹션 ${index + 1}`,
        body,
      }
    })
    .filter((section): section is ShareSection => Boolean(section))
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
          is_deleted,
          share_sections
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

  const shareSections = normalizeShareSections(card.share_sections)
  const shareTitle = card.title.trim() || '제목 없는 공유 자료'

  return (
    <main className="min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex max-w-3xl flex-col px-5 py-8 md:px-8 md:py-12">
        <header className="pb-6">
          <p className="text-xs font-semibold text-[var(--color-accent)]">Posty</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] md:text-[36px]">
            {shareTitle}
          </h1>
        </header>

        {shareSections.length > 0 ? (
          <div className="space-y-5">
            {shareSections.map((section) => (
              <section
                key={section.id}
                className="rounded-[var(--radius-xl)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-5 py-5"
              >
                <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">
                  {section.title}
                </h2>
                {section.body ? (
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--color-text-body)]">
                    {section.body}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-5 py-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              아직 공개할 자료 내용이 없습니다
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
