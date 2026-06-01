import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ContentMediaDownloadLink } from '@/components/content/ContentMediaDownloadLink'
import { SharedMediaCarousel, type SharedMediaCarouselItem } from '@/components/content/SharedMediaCarousel'
import { isAttachmentContentMedia } from '@/lib/content-media-purpose'
import {
  formatContentMediaFileSize,
  getContentMediaTypeLabel,
} from '@/lib/content-media-files'
import { FormattedText, type FormattedTextMediaItem } from '@/lib/text-format'
import type { ChecklistItem, ContentMediaType, Database, ShareSection } from '@/lib/types'

type SharePageProps = {
  params: Promise<{ token: string }>
}

type SharedCard = {
  id: string
  title: string
  memo: string | null
  checklist: ChecklistItem[] | null
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

type SharedMedia = {
  id: string
  storage_path: string
  file_name: string | null
  mime_type: string | null
  media_type: ContentMediaType
  file_size: number | null
  sort_order: number
  created_at: string
}

type SharedMediaItem = {
  id: string
  fileName: string | null
  mimeType: string | null
  mediaType: ContentMediaType
  fileSize: number | null
  signedUrl: string | null
}

type SharedScript = {
  body: string | null
  caption: string | null
  hashtags: string | null
  thumbnail_text: string | null
}

type SharedScene = {
  number: number
  title: string
  body: string
}

type ChecklistLike = Partial<ChecklistItem> & {
  checked?: boolean
}

const MEDIA_BUCKET_NAME = 'content-card-media'
const MEDIA_SIGNED_URL_EXPIRES_IN = 60 * 60 * 12
const SHARE_METADATA_FALLBACK_TITLE = '공유 자료'
const SHARE_METADATA_UNAVAILABLE_TITLE = '공유 링크를 사용할 수 없습니다'
const SHARE_METADATA_FALLBACK_DESCRIPTION = '공유된 콘텐츠 내용을 확인해보세요'
const SHARE_METADATA_DESCRIPTION_LIMIT = 140
const SHARE_SECTION_IDS = {
  body: 'share-section-body',
  script: 'share-section-script',
  caption: 'share-section-caption',
  hashtags: 'share-section-hashtags',
  thumbnail: 'share-section-thumbnail',
  checklist: 'share-section-checklist',
} as const

function getCustomShareSectionAnchorId(index: number) {
  return `share-section-custom-${index + 1}`
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

function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeMetadataText(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/\|/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/[#*_`>[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateMetadataDescription(value: string) {
  const normalizedValue = normalizeMetadataText(value)

  if (normalizedValue.length <= SHARE_METADATA_DESCRIPTION_LIMIT) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, SHARE_METADATA_DESCRIPTION_LIMIT).trim()}...`
}

function normalizeScriptScenes(value: string | null | undefined) {
  const body = normalizeText(value)

  if (!body) return []

  try {
    const parsed = JSON.parse(body) as unknown

    if (!Array.isArray(parsed)) return []

    return parsed
      .map((scene, index) => {
        const entry =
          typeof scene === 'object' && scene !== null
            ? (scene as Partial<SharedScene>)
            : {}
        const title = normalizeText(entry.title)
        const sceneBody = normalizeText(entry.body)

        if (!title && !sceneBody) return null

        return {
          number:
            typeof entry.number === 'number' && Number.isFinite(entry.number)
              ? entry.number
              : index + 1,
          title: title || `Scene ${index + 1}`,
          body: sceneBody,
        }
      })
      .filter((scene): scene is SharedScene => Boolean(scene))
  } catch {
    return []
  }
}

function getPlainScriptBody(value: string | null | undefined) {
  const body = normalizeText(value)

  if (!body) return ''

  try {
    const parsed = JSON.parse(body) as unknown

    if (Array.isArray(parsed)) return ''
  } catch {
    return body
  }

  return body
}

function normalizeChecklist(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => {
      const entry =
        typeof item === 'object' && item !== null ? (item as ChecklistLike) : {}
      const text = normalizeText(entry.text)
      const checked =
        typeof entry.checked === 'boolean'
          ? entry.checked
          : typeof entry.done === 'boolean'
            ? entry.done
            : false

      if (!text) return null

      return {
        key: `checklist-${index + 1}`,
        text,
        checked,
      }
    })
    .filter((item): item is { key: string; text: string; checked: boolean } => Boolean(item))
}

async function createSharedMediaItems(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  rows: SharedMedia[]
): Promise<SharedMediaItem[]> {
  const sortedRows = [...rows].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return Promise.all(
    sortedRows.map(async (row) => {
      const downloadFileName = row.media_type === 'file' ? row.file_name?.trim() ?? '' : ''
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET_NAME)
        .createSignedUrl(
          row.storage_path,
          MEDIA_SIGNED_URL_EXPIRES_IN,
          downloadFileName ? { download: downloadFileName } : undefined
        )

      if (error) {
        console.error('Failed to create shared content media signed URL', error)
      }

      return {
        id: row.id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        mediaType: row.media_type,
        fileSize: row.file_size,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )
}

function isEmbeddableMediaItem(
  item: SharedMediaItem
): item is SharedMediaItem & { mediaType: 'image' | 'video' } {
  return item.mediaType === 'image' || item.mediaType === 'video'
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
        title,
        body,
      }
    })
    .filter((section): section is ShareSection => Boolean(section))
}

function createSharePageMetadata(title: string, description: string): Metadata {
  return {
    title: {
      absolute: title,
    },
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

function getDescriptionFromPublicContent(
  card: SharedCard,
  script: SharedScript | null
) {
  const shareSections = normalizeShareSections(card.share_sections)
  const descriptionSource = [
    card.memo,
    ...shareSections.map((section) => section.body),
    script?.caption,
    getPlainScriptBody(script?.body),
    script?.thumbnail_text,
    script?.hashtags,
  ].find((value) => normalizeMetadataText(value))

  if (!descriptionSource) {
    return SHARE_METADATA_FALLBACK_DESCRIPTION
  }

  return truncateMetadataDescription(descriptionSource)
}

async function fetchShareLinkWithCard(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  token: string
) {
  const { data, error } = await supabase
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
          memo,
          checklist,
          is_deleted,
          share_sections
        )
      `
    )
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch content share link', error)
  }

  return (data as ShareLinkWithCard | null) ?? null
}

async function fetchLatestSharedScript(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  cardId: string
) {
  const { data, error } = await supabase
    .from('scripts')
    .select('body, caption, hashtags, thumbnail_text')
    .eq('card_id', cardId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch shared content script', error)
  }

  return (data as SharedScript | null) ?? null
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const unavailableMetadata = createSharePageMetadata(
    SHARE_METADATA_UNAVAILABLE_TITLE,
    SHARE_METADATA_FALLBACK_DESCRIPTION
  )
  const { token } = await params
  const supabase = createServiceClient()

  if (!supabase || !token) {
    return unavailableMetadata
  }

  const link = await fetchShareLinkWithCard(supabase, token)
  const card = link?.card ?? null

  if (!link || !link.is_enabled || isExpired(link.expires_at) || !card || card.is_deleted) {
    return unavailableMetadata
  }

  const script = await fetchLatestSharedScript(supabase, card.id)
  const title = normalizeMetadataText(card.title) || SHARE_METADATA_FALLBACK_TITLE
  const description = getDescriptionFromPublicContent(card, script)

  return createSharePageMetadata(title, description)
}

function SharedContentSection({
  id,
  label,
  children,
}: {
  id?: string
  label?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-5 py-5 md:scroll-mt-8"
    >
      {label ? (
        <p className="mb-3 text-[11px] font-semibold text-[var(--color-text-muted)]">
          {label}
        </p>
      ) : null}
      {children}
    </section>
  )
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

function SharedAttachmentFileList({ items }: { items: SharedMediaItem[] }) {
  if (items.length === 0) return null

  return (
    <SharedContentSection label="첨부파일">
      <div className="divide-y divide-[var(--color-border-soft)]">
        {items.map((item) => {
          const label = getContentMediaTypeLabel(item.mediaType, item.fileName)
          const fileName = item.fileName?.trim() || '첨부파일'

          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                {label}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {fileName}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {label} · {formatContentMediaFileSize(item.fileSize)}
                </p>
              </div>
              {item.signedUrl ? (
                <ContentMediaDownloadLink
                  url={item.signedUrl}
                  fileName={fileName}
                  className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                >
                  다운로드
                </ContentMediaDownloadLink>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">다운로드 불가</span>
              )}
            </div>
          )
        })}
      </div>
    </SharedContentSection>
  )
}

export default async function ShareContentPage({ params }: SharePageProps) {
  const { token } = await params
  const supabase = createServiceClient()

  if (!supabase || !token) {
    return <UnavailableSharePage />
  }

  const link = await fetchShareLinkWithCard(supabase, token)
  const card = link?.card ?? null

  if (!link || !link.is_enabled || isExpired(link.expires_at) || !card || card.is_deleted) {
    return <UnavailableSharePage />
  }

  const shareSections = normalizeShareSections(card.share_sections)
  const shareTitle = card.title.trim() || '제목 없는 공유 자료'
  const bodyContent = card.memo?.trim() ?? ''
  const [
    { data: mediaRows, error: mediaError },
    script,
  ] = await Promise.all([
    supabase
      .from('content_card_media')
      .select('id, storage_path, file_name, mime_type, media_type, file_size, sort_order, created_at')
      .eq('card_id', card.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    fetchLatestSharedScript(supabase, card.id),
  ])

  if (mediaError) {
    console.error('Failed to fetch shared content media', mediaError)
  }

  const fetchedMediaRows = (mediaRows as SharedMedia[] | null) ?? []
  const mediaItems = mediaError
    ? []
    : await createSharedMediaItems(supabase, fetchedMediaRows)
  const attachmentMediaIds = new Set(
    fetchedMediaRows.filter(isAttachmentContentMedia).map((row) => row.id)
  )
  const attachmentMediaItems = mediaItems.filter((item) => attachmentMediaIds.has(item.id))
  const embeddableMediaItems: FormattedTextMediaItem[] = mediaItems
    .filter(isEmbeddableMediaItem)
    .map((item) => ({
      id: item.id,
      fileName: item.fileName,
      mediaType: item.mediaType,
      signedUrl: item.signedUrl,
    }))
  const carouselMediaItems: SharedMediaCarouselItem[] = attachmentMediaItems
    .filter(isEmbeddableMediaItem)
    .map((item) => ({
      id: item.id,
      fileName: item.fileName,
      mimeType: item.mimeType,
      mediaType: item.mediaType,
      signedUrl: item.signedUrl,
    }))
  const fileAttachmentItems = attachmentMediaItems.filter((item) => item.mediaType === 'file')
  const scriptScenes = normalizeScriptScenes(script?.body)
  const plainScriptBody = getPlainScriptBody(script?.body)
  const captionContent = normalizeText(script?.caption)
  const hashtagsContent = normalizeText(script?.hashtags)
  const thumbnailContent = normalizeText(script?.thumbnail_text)
  const checklistItems = normalizeChecklist(card.checklist)
  const hasScriptContent = scriptScenes.length > 0 || Boolean(plainScriptBody)
  const hasPublicContent =
    attachmentMediaItems.length > 0 ||
    Boolean(bodyContent) ||
    hasScriptContent ||
    Boolean(captionContent) ||
    Boolean(hashtagsContent) ||
    Boolean(thumbnailContent) ||
    checklistItems.length > 0 ||
    shareSections.length > 0
  const anchorLinks = [
    ...(bodyContent ? [{ id: SHARE_SECTION_IDS.body, label: '원고' }] : []),
    ...(hasScriptContent ? [{ id: SHARE_SECTION_IDS.script, label: '대본' }] : []),
    ...(captionContent ? [{ id: SHARE_SECTION_IDS.caption, label: '캡션' }] : []),
    ...(hashtagsContent ? [{ id: SHARE_SECTION_IDS.hashtags, label: '해시태그' }] : []),
    ...(thumbnailContent ? [{ id: SHARE_SECTION_IDS.thumbnail, label: '썸네일' }] : []),
    ...(checklistItems.length > 0
      ? [{ id: SHARE_SECTION_IDS.checklist, label: '체크리스트' }]
      : []),
    ...shareSections
      .map((section, index) => ({
        id: getCustomShareSectionAnchorId(index),
        label: section.title.trim(),
      }))
      .filter((section) => section.label),
  ]

  return (
    <main className="min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex max-w-3xl flex-col px-5 py-8 md:px-8 md:py-12">
        <header className="pb-6">
          <p className="text-xs font-semibold text-[var(--color-accent)]">Posty</p>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.03em] md:text-[36px]">
            {shareTitle}
          </h1>
        </header>

        <SharedMediaCarousel items={carouselMediaItems} />

        {anchorLinks.length > 0 ? (
          <nav
            aria-label="공유 문서 섹션"
            className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium"
          >
            {anchorLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}

        {hasPublicContent ? (
          <div className="space-y-5">
            <SharedAttachmentFileList items={fileAttachmentItems} />

            {bodyContent ? (
              <SharedContentSection id={SHARE_SECTION_IDS.body} label="원고">
                <FormattedText
                  text={bodyContent}
                  mediaItems={embeddableMediaItems}
                  className="text-sm leading-7 text-[var(--color-text-body)]"
                />
              </SharedContentSection>
            ) : null}

            {hasScriptContent ? (
              <SharedContentSection id={SHARE_SECTION_IDS.script} label="대본">
                {scriptScenes.length > 0 ? (
                  <div className="space-y-4">
                    {scriptScenes.map((scene, index) => (
                      <div key={`scene-${index + 1}`}>
                        <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                          {scene.number}. {scene.title}
                        </p>
                        {scene.body ? (
                          <FormattedText
                            text={scene.body}
                            mediaItems={embeddableMediaItems}
                            className="mt-1 text-sm leading-7 text-[var(--color-text-body)]"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <FormattedText
                    text={plainScriptBody}
                    mediaItems={embeddableMediaItems}
                    className="text-sm leading-7 text-[var(--color-text-body)]"
                  />
                )}
              </SharedContentSection>
            ) : null}

            {captionContent ? (
              <SharedContentSection id={SHARE_SECTION_IDS.caption} label="캡션">
                <FormattedText
                  text={captionContent}
                  mediaItems={embeddableMediaItems}
                  className="text-sm leading-7 text-[var(--color-text-body)]"
                />
              </SharedContentSection>
            ) : null}

            {hashtagsContent ? (
              <SharedContentSection id={SHARE_SECTION_IDS.hashtags} label="해시태그">
                <FormattedText
                  text={hashtagsContent}
                  mediaItems={embeddableMediaItems}
                  className="text-sm leading-7 text-[var(--color-text-body)]"
                />
              </SharedContentSection>
            ) : null}

            {thumbnailContent ? (
              <SharedContentSection id={SHARE_SECTION_IDS.thumbnail} label="썸네일 문구">
                <FormattedText
                  text={thumbnailContent}
                  mediaItems={embeddableMediaItems}
                  className="text-sm leading-7 text-[var(--color-text-body)]"
                />
              </SharedContentSection>
            ) : null}

            {checklistItems.length > 0 ? (
              <SharedContentSection id={SHARE_SECTION_IDS.checklist} label="체크리스트">
                <ul className="space-y-2">
                  {checklistItems.map((item) => (
                    <li key={item.key} className="flex items-start gap-2 text-sm leading-6 text-[var(--color-text-body)]">
                      <span
                        className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-[var(--color-border-default)] text-[10px] font-bold text-[var(--color-accent)]"
                        aria-hidden="true"
                      >
                        {item.checked ? '✓' : ''}
                      </span>
                      <span className={item.checked ? 'text-[var(--color-text-muted)] line-through' : undefined}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </SharedContentSection>
            ) : null}

            {shareSections.map((section, index) => (
              <SharedContentSection key={section.id} id={getCustomShareSectionAnchorId(index)}>
                {section.title.trim() ? (
                  <h2 className="text-[15px] font-bold text-[var(--color-text-primary)]">
                    {section.title}
                  </h2>
                ) : null}
                {section.body ? (
                  <FormattedText
                    text={section.body}
                    mediaItems={embeddableMediaItems}
                    className={
                      section.title.trim()
                        ? 'mt-3 text-sm leading-7 text-[var(--color-text-body)]'
                        : 'text-sm leading-7 text-[var(--color-text-body)]'
                    }
                  />
                ) : null}
              </SharedContentSection>
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
