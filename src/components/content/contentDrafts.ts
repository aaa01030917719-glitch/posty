import {
  isAttachmentContentMedia,
  isInlineContentMedia,
} from '@/lib/content-media-purpose'
import type {
  ChecklistItem,
  ContentCard,
  ContentCardDraft,
  ContentCardMedia,
  ContentMediaType,
  ContentStatus,
  Json,
  Priority,
  Script,
  ShareSection,
} from '@/lib/types'

export const CONTENT_DRAFT_SNAPSHOT_VERSION = 1

export type ContentDraftMediaPurpose = 'attachment' | 'inline'

export type ContentDraftMediaSnapshotItem = {
  id: string
  storage_path: string
  file_name: string | null
  mime_type: string | null
  media_type: ContentMediaType
  file_size: number | null
  sort_order: number
  purpose: ContentDraftMediaPurpose
}

export type ContentDraftSnapshot = {
  schema_version: 1
  card: {
    title: string
    project_id: string | null
    channel_id: string | null
    status: ContentStatus
    priority: Priority
    scheduled_at: string | null
    published_at: string | null
    memo: string
    editor_memo: string
    reference_url: string | null
    checklist: ChecklistItem[]
    share_sections: ShareSection[]
  }
  script: {
    title: string | null
    body: string | null
    caption: string | null
    hashtags: string | null
    cta: string | null
    thumbnail_text: string | null
    panel_title: string | null
    is_final: boolean
  }
  media: {
    attachment_ids: string[]
    inline_ids: string[]
    items: ContentDraftMediaSnapshotItem[]
  }
}

type CreateContentDraftSnapshotInput = {
  card: ContentCard
  script: Script | null
  title: string
  projectId: string | null
  scheduledAt: string | null
  memo: string
  editorMemo: string
  checklist: ChecklistItem[]
  shareSections: ShareSection[]
  scriptBody: string | null
  caption: string | null
  hashtags: string | null
  thumbnailText: string | null
  panelTitle: string | null
  mediaItems: ContentCardMedia[]
}

const MEDIA_TOKEN_PATTERN =
  /!\[[^\]]*]\(posty-media:([A-Za-z0-9_-]+)(?:\|size=(?:original|small|medium|large|full))?\)/g

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function getContentDraftTitle(value: string | null | undefined) {
  return value?.trim() || '제목 없음'
}

export function getInlineMediaIdsFromMarkdown(value: string) {
  const ids: string[] = []

  for (const match of value.matchAll(MEDIA_TOKEN_PATTERN)) {
    ids.push(match[1])
  }

  return uniqueStrings(ids)
}

export function createContentDraftSnapshot({
  card,
  script,
  title,
  projectId,
  scheduledAt,
  memo,
  editorMemo,
  checklist,
  shareSections,
  scriptBody,
  caption,
  hashtags,
  thumbnailText,
  panelTitle,
  mediaItems,
}: CreateContentDraftSnapshotInput): ContentDraftSnapshot {
  const attachmentIds = mediaItems.filter(isAttachmentContentMedia).map((item) => item.id)
  const inlineIds = uniqueStrings([
    ...getInlineMediaIdsFromMarkdown(memo),
    ...mediaItems.filter(isInlineContentMedia).map((item) => item.id),
  ])

  return {
    schema_version: CONTENT_DRAFT_SNAPSHOT_VERSION,
    card: {
      title: getContentDraftTitle(title),
      project_id: projectId,
      channel_id: card.channel_id,
      status: card.status,
      priority: card.priority,
      scheduled_at: scheduledAt,
      published_at: card.published_at,
      memo,
      editor_memo: editorMemo,
      reference_url: card.reference_url,
      checklist,
      share_sections: shareSections,
    },
    script: {
      title: getContentDraftTitle(title),
      body: scriptBody,
      caption,
      hashtags,
      cta: script?.cta ?? null,
      thumbnail_text: thumbnailText,
      panel_title: panelTitle,
      is_final: script?.is_final ?? false,
    },
    media: {
      attachment_ids: uniqueStrings(attachmentIds),
      inline_ids: inlineIds,
      items: mediaItems.map((item) => ({
        id: item.id,
        storage_path: item.storage_path,
        file_name: item.file_name,
        mime_type: item.mime_type,
        media_type: item.media_type,
        file_size: item.file_size,
        sort_order: item.sort_order,
        purpose: isInlineContentMedia(item) ? 'inline' : 'attachment',
      })),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asStatus(value: unknown): ContentStatus {
  return value === 'idea' ||
    value === 'planning' ||
    value === 'writing' ||
    value === 'review' ||
    value === 'scheduled' ||
    value === 'published' ||
    value === 'hold'
    ? value
    : 'writing'
}

function asPriority(value: unknown): Priority {
  return value === 'low' || value === 'normal' || value === 'high' ? value : 'normal'
}

function asChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ChecklistItem | null => {
      if (!isRecord(item)) return null
      const text = asString(item.text).trim()
      const id = asString(item.id)
      const done =
        typeof item.done === 'boolean'
          ? item.done
          : typeof item.checked === 'boolean'
            ? item.checked
            : false

      if (!text) return null

      return {
        id: id || `checklist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        done,
      }
    })
    .filter((item): item is ChecklistItem => item !== null)
}

function asShareSections(value: unknown): ShareSection[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ShareSection | null => {
      if (!isRecord(item)) return null
      const title = asString(item.title)
      const body = asString(item.body)

      if (!title.trim() && !body.trim()) return null

      return {
        id: asString(item.id) || `share-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        body,
      }
    })
    .filter((item): item is ShareSection => item !== null)
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? uniqueStrings(value.filter((item): item is string => typeof item === 'string'))
    : []
}

function asMediaSnapshotItems(value: unknown): ContentDraftMediaSnapshotItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ContentDraftMediaSnapshotItem | null => {
      if (!isRecord(item)) return null

      const id = asString(item.id)
      const storagePath = asString(item.storage_path)
      const mediaType =
        item.media_type === 'video'
          ? 'video'
          : item.media_type === 'image'
            ? 'image'
            : item.media_type === 'file'
              ? 'file'
              : null
      const fileSize = typeof item.file_size === 'number' ? item.file_size : null
      const purpose = item.purpose === 'inline' ? 'inline' : 'attachment'
      const sortOrder = typeof item.sort_order === 'number' ? item.sort_order : 0

      if (!id || !storagePath || !mediaType) return null

      return {
        id,
        storage_path: storagePath,
        file_name: asNullableString(item.file_name),
        mime_type: asNullableString(item.mime_type),
        media_type: mediaType,
        file_size: fileSize,
        sort_order: sortOrder,
        purpose,
      }
    })
    .filter((item): item is ContentDraftMediaSnapshotItem => item !== null)
}

export function parseContentDraftSnapshot(
  value: Json
): { ok: true; snapshot: ContentDraftSnapshot } | { ok: false; message: string } {
  if (!isRecord(value)) {
    return { ok: false, message: '임시저장 데이터 형식이 올바르지 않습니다.' }
  }

  if (value.schema_version !== CONTENT_DRAFT_SNAPSHOT_VERSION) {
    return { ok: false, message: '지원하지 않는 임시저장 버전입니다.' }
  }

  const card = isRecord(value.card) ? value.card : {}
  const script = isRecord(value.script) ? value.script : {}
  const media = isRecord(value.media) ? value.media : {}

  const snapshot: ContentDraftSnapshot = {
    schema_version: CONTENT_DRAFT_SNAPSHOT_VERSION,
    card: {
      title: getContentDraftTitle(asString(card.title)),
      project_id: asNullableString(card.project_id),
      channel_id: asNullableString(card.channel_id),
      status: asStatus(card.status),
      priority: asPriority(card.priority),
      scheduled_at: asNullableString(card.scheduled_at),
      published_at: asNullableString(card.published_at),
      memo: asString(card.memo),
      editor_memo: asString(card.editor_memo),
      reference_url: asNullableString(card.reference_url),
      checklist: asChecklist(card.checklist),
      share_sections: asShareSections(card.share_sections),
    },
    script: {
      title: asNullableString(script.title),
      body: asNullableString(script.body),
      caption: asNullableString(script.caption),
      hashtags: asNullableString(script.hashtags),
      cta: asNullableString(script.cta),
      thumbnail_text: asNullableString(script.thumbnail_text),
      panel_title: asNullableString(script.panel_title),
      is_final: asBoolean(script.is_final),
    },
    media: {
      attachment_ids: asStringArray(media.attachment_ids),
      inline_ids: asStringArray(media.inline_ids),
      items: asMediaSnapshotItems(media.items),
    },
  }

  return { ok: true, snapshot }
}

export function getContentDraftSnapshotMediaIds(snapshot: ContentDraftSnapshot) {
  return uniqueStrings([
    ...snapshot.media.attachment_ids,
    ...snapshot.media.inline_ids,
    ...snapshot.media.items.map((item) => item.id),
    ...getInlineMediaIdsFromMarkdown(snapshot.card.memo),
  ])
}

export function isContentDraftOlderThanCard(
  draft: Pick<ContentCardDraft, 'source_card_updated_at'>,
  cardUpdatedAt: string | null | undefined
) {
  if (!draft.source_card_updated_at || !cardUpdatedAt) return false

  const draftTime = new Date(draft.source_card_updated_at).getTime()
  const cardTime = new Date(cardUpdatedAt).getTime()

  return Number.isFinite(draftTime) && Number.isFinite(cardTime) && draftTime < cardTime
}
