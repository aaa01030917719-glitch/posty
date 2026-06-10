'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ChevronDown,
  Columns2,
  Download,
  FileText,
  GripVertical,
  Plus,
  Save,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { CHANNEL_COLORS, STATUS_LABELS } from '@/lib/constants'
import {
  isAttachmentContentMedia,
  isInlineContentMedia,
  type ContentMediaPurpose,
} from '@/lib/content-media-purpose'
import {
  CONTENT_MEDIA_ATTACHMENT_ACCEPT,
  createContentMediaStoragePath,
  formatContentMediaFileSize,
  getContentMediaTypeFromFile,
  getContentMediaTypeLabel,
  validateContentMediaFile,
} from '@/lib/content-media-files'
import { recordContentActivityLog } from '@/lib/content-activity-logs'
import { createClient } from '@/lib/supabase/client'
import { getMarkdownTableFromClipboard } from '@/lib/table-paste'
import {
  createMediaMarkdownToken,
  MarkdownToolbar,
  type MarkdownToolbarAction,
} from '@/components/content/MarkdownToolbar'
import { ContentMediaDownloadLink } from '@/components/content/ContentMediaDownloadLink'
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorMediaItem,
} from '@/components/content/RichTextEditor'
import { PostyTiptapEditor } from '@/components/content/tiptap/PostyTiptapEditor'
import { ContentDraftModal } from '@/components/content/ContentDraftModal'
import {
  createContentDraftSnapshot,
  getContentDraftSnapshotMediaIds,
  getContentDraftTitle,
  isContentDraftOlderThanCard,
  parseContentDraftSnapshot,
  type ContentDraftMediaSnapshotItem,
  type ContentDraftSnapshot,
} from '@/components/content/contentDrafts'
import { Modal } from '@/components/ui/Modal'
import {
  createTiptapDocEnvelope,
  getPlainTextFromTiptapDoc,
  getTiptapDocForEditor,
} from '@/lib/content-editor-doc'
import type {
  ChecklistItem,
  ContentActivityAction,
  ContentCard,
  ContentCardDraft,
  ContentCardMedia,
  ContentMediaType,
  ContentProjectSummary,
  ContentShareLink,
  Json,
  Script,
} from '@/lib/types'

interface ContentEditorShellProps {
  cardId: string
}

type SidebarContentCard = Pick<
  ContentCard,
  'id' | 'title' | 'project_id' | 'status' | 'scheduled_at' | 'is_deleted'
> & {
  channel?: {
    id: string
    name: string
    type: string
    color: string
  } | null
}

type EditorSection =
  | 'body'
  | 'scenes'
  | 'caption'
  | 'hashtags'
  | 'thumbnail'
  | 'checklist'
  | 'memo'

type SceneDraft = {
  id: string
  number: number
  title: string
  body: string
}

type ChecklistDraft = {
  id: string
  text: string
  checked: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type MediaItem = RichTextEditorMediaItem
type PersistedSceneDraft = Pick<SceneDraft, 'id' | 'number' | 'title' | 'body'>
type PersistedChecklistDraft = Partial<ChecklistItem> & {
  checked?: boolean
}

const PREVIEW_IDS = new Set(['preview', 'demo'])
const MEDIA_BUCKET_NAME = 'content-card-media'
const MEDIA_SIGNED_URL_EXPIRES_IN = 60 * 60
const MEDIA_SECTION_LABEL = '\uCCA8\uBD80 \uBBF8\uB514\uC5B4'
const MEDIA_UPLOAD_LABEL = '\uD30C\uC77C \uCCA8\uBD80'
const MEDIA_UPLOADING_LABEL = '\uC5C5\uB85C\uB4DC \uC911...'
const MEDIA_EMPTY_LABEL = '\uCCA8\uBD80\uB41C \uBBF8\uB514\uC5B4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const MEDIA_DELETE_LABEL = '\uC0AD\uC81C'
const MEDIA_DELETING_LABEL = '\uC0AD\uC81C \uC911'
const MEDIA_UNTITLED_FILE_LABEL = '\uD30C\uC77C\uBA85 \uC5C6\uC74C'
const MEDIA_UPLOAD_ERROR =
  '\uBBF8\uB514\uC5B4\uB97C \uC5C5\uB85C\uB4DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
const MEDIA_DELETE_ERROR =
  '\uBBF8\uB514\uC5B4\uB97C \uC0AD\uC81C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
const MEDIA_STORAGE_DELETE_WARNING =
  '\uCCA8\uBD80 \uBAA9\uB85D\uC5D0\uC11C\uB294 \uC81C\uAC70\uD588\uC9C0\uB9CC \uC800\uC7A5\uC18C \uD30C\uC77C \uC815\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.'
const UNSAVED_LEAVE_MODAL_TITLE =
  '\uC800\uC7A5\uD558\uC9C0 \uC54A\uC740 \uBCC0\uACBD\uC0AC\uD56D'
const UNSAVED_LEAVE_MESSAGE =
  '\uC791\uC131\uB41C \uAE00\uC744 \uC800\uC7A5\uD558\uC9C0 \uC54A\uACE0 \uB098\uAC00\uACA0\uC2B5\uB2C8\uAE4C?'
const CONTINUE_WRITING_LABEL = '\uACC4\uC18D \uC791\uC131'
const LEAVE_WITHOUT_SAVE_LABEL =
  '\uC800\uC7A5\uD558\uC9C0 \uC54A\uACE0 \uB098\uAC00\uAE30'
const DRAFT_LOAD_MODAL_TITLE = '\uC784\uC2DC\uC800\uC7A5 \uBD88\uB7EC\uC624\uAE30'
const DRAFT_LOAD_WARNING_PRIMARY =
  '\uD604\uC7AC \uC791\uC131 \uC911\uC778 \uB0B4\uC6A9\uC774 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4'
const DRAFT_LOAD_WARNING_SECONDARY =
  '\uC784\uC2DC\uC800\uC7A5\uBCF8\uC744 \uBD88\uB7EC\uC624\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'
const DRAFT_OLD_WARNING_MESSAGE =
  '\uD604\uC7AC \uC800\uC7A5\uB41C \uAE00\uBCF4\uB2E4 \uC774\uC804 \uBC84\uC804\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4'
const DRAFT_DELETE_MODAL_TITLE = '\uC784\uC2DC\uC800\uC7A5 \uC0AD\uC81C'
const DRAFT_DELETE_WARNING_MESSAGE =
  '\uC120\uD0DD\uD55C \uC784\uC2DC\uC800\uC7A5\uBCF8\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?'
const DRAFT_SAVE_SUCCESS_MESSAGE =
  '\uC784\uC2DC\uC800\uC7A5\uBCF8\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4'
const DRAFT_LOAD_SUCCESS_MESSAGE =
  '\uC784\uC2DC\uC800\uC7A5\uBCF8\uC744 \uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uC804\uAE4C\uC9C0 \uC6D0\uBCF8\uC5D0\uB294 \uBC18\uC601\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4'
const DRAFT_DELETE_SUCCESS_MESSAGE =
  '\uC784\uC2DC\uC800\uC7A5\uBCF8\uC744 \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4'
const DRAFT_LIST_ERROR_MESSAGE =
  '\uC784\uC2DC\uC800\uC7A5 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4'
const DRAFT_SAVE_ERROR_MESSAGE =
  '\uC784\uC2DC\uC800\uC7A5\uBCF8\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4'
const DRAFT_LOAD_ERROR_MESSAGE =
  '\uC784\uC2DC\uC800\uC7A5\uBCF8\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4'
const DRAFT_DELETE_ERROR_MESSAGE =
  '\uC784\uC2DC\uC800\uC7A5\uBCF8\uC744 \uC0AD\uC81C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4'
const DRAFT_UNTITLED_LABEL = '\uC81C\uBAA9 \uC5C6\uC74C'
const DEFAULT_PANEL_TITLE = '대본'
const EDITOR_PLACEHOLDER = '원고를 작성해보세요...'
const EMPTY_SECTION_MESSAGE = '아직 입력된 내용이 없습니다.'
const CAMPAIGN_SECTION_TITLE = '캠페인'
const ALL_CONTENT_LABEL = '전체'
const UNCATEGORIZED_GROUP_ID = '__uncategorized__'
const UNCATEGORIZED_CONTENT_LABEL = '일반 콘텐츠'
const EMPTY_CAMPAIGN_CONTENTS_LABEL = '콘텐츠 없음'
const RICH_TEXT_PLACEHOLDER = '\uD14D\uC2A4\uD2B8'
const RICH_HEADING_PLACEHOLDER = '\uC81C\uBAA9'
const RICH_SMALL_PLACEHOLDER = '\uC791\uC740\uAE00\uC528'
const RICH_MUTED_PLACEHOLDER = '\uBCF4\uC870\uAE00\uC528'
const RICH_LINK_TEXT_PLACEHOLDER = '\uB9C1\uD06C \uD14D\uC2A4\uD2B8'
const RICH_LINK_URL_PLACEHOLDER = 'https://example.com'
const RICH_LARGE_CLASS = 'text-[30px] font-semibold leading-[1.25] text-[var(--color-text-primary)]'
const RICH_TITLE_CLASS = 'text-[24px] font-semibold leading-[1.3] text-[var(--color-text-primary)]'
const RICH_SMALL_CLASS = 'text-[14px] leading-[1.6] text-[var(--color-text-secondary)]'
const RICH_MUTED_CLASS = 'text-[14px] leading-[1.6] text-[var(--color-text-muted)]'
const RICH_COLOR_OPTIONS = {
  ink: {
    value: '#222222',
    className: 'text-[var(--color-text-primary)]',
    tag: 'posty-color-ink',
  },
  body: {
    value: '#3f3f3f',
    className: 'text-[var(--color-text-body)]',
    tag: 'posty-color-body',
  },
  muted: {
    value: '#6a6a6a',
    className: 'text-[var(--color-text-subtle)]',
    tag: 'posty-color-muted',
  },
  accent: {
    value: '#ff385c',
    className: 'text-[var(--color-accent)]',
    tag: 'posty-color-accent',
  },
  calm: {
    value: '#2f6f66',
    className: 'text-[#2f6f66]',
    tag: 'posty-color-calm',
  },
} as const
type RichColorKey = keyof typeof RICH_COLOR_OPTIONS
type RichSizeKey = 'large' | 'title' | 'small' | 'muted'
const RICH_MEDIA_UNAVAILABLE_LABEL =
  '\uCCA8\uBD80 \uBBF8\uB514\uC5B4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'
const RICH_MEDIA_IMAGE_LABEL = '\uCCA8\uBD80 \uC774\uBBF8\uC9C0'
const RICH_MEDIA_VIDEO_LABEL = '\uCCA8\uBD80 \uC601\uC0C1'
const DEFAULT_UPLOAD_TIME_VALUE = '09:00'
const UPLOAD_TIME_OPTIONS = [
  { label: '오전', value: DEFAULT_UPLOAD_TIME_VALUE },
  { label: '오후', value: '13:00' },
  { label: '저녁', value: '19:00' },
] as const
const SECTION_ITEMS: Array<{ value: EditorSection; label: string }> = [
  { value: 'memo', label: '메모' },
  { value: 'checklist', label: '체크리스트' },
  { value: 'caption', label: '캡션' },
  { value: 'hashtags', label: '해시태그' },
  { value: 'scenes', label: '대본' },
  { value: 'thumbnail', label: '썸네일문구' },
]

const CLOSED_EDITOR_SECTIONS: Record<EditorSection, boolean> = {
  body: false,
  scenes: false,
  caption: false,
  hashtags: false,
  thumbnail: false,
  checklist: false,
  memo: false,
}
const PANEL_STATE_STORAGE_PREFIX = 'posty:content-editor-panels:'

const SAMPLE_CARD: ContentCard = {
  id: 'preview',
  user_id: 'preview-user',
  channel_id: 'preview-channel',
  title: '인스타 릴스 0504',
  format: '릴스',
  status: 'writing',
  priority: 'normal',
  scheduled_at: '2026-05-07T09:00:00+09:00',
  published_at: null,
  editor_memo: '작업 전 체크 포인트와 후킹 문장 후보를 메모해두세요.',
  memo: '후킹 문장을 더 짧게 정리하고 마지막 CTA를 자연스럽게 마무리합니다.',
  reference_url: 'https://example.com/reference',
  checklist: [
    { id: 'check-1', text: '후킹 문장 정리', done: true },
    { id: 'check-2', text: '썸네일 문구 검토', done: false },
    { id: 'check-3', text: '캡션과 해시태그 정리', done: false },
  ],
  share_sections: [],
  content_kind: 'content',
  idea_id: null,
  project_id: null,
  is_deleted: false,
  deleted_at: null,
  deleted_reason: null,
  created_at: '2026-05-04T10:00:00+09:00',
  updated_at: '2026-05-04T14:43:00+09:00',
  channel: {
    id: 'preview-channel',
    user_id: 'preview-user',
    name: '인스타그램',
    type: 'instagram',
    color: CHANNEL_COLORS.instagram,
    created_at: '2026-05-04T10:00:00+09:00',
  },
  project: null,
}

const SAMPLE_SCRIPT: Script = {
  id: 'preview-script',
  user_id: 'preview-user',
  card_id: 'preview',
  title: '인스타 릴스 0504 원고',
  body: `요즘 들어 아침마다 일이 늘어나는 느낌이 있죠.

무엇부터 손대야 할지 막막할 때는 해야 할 일을 세 가지로만 나눠보세요.

무조건 더 열심히 하는 것보다 먼저 하지 않을 것을 정리하면 하루가 훨씬 또렷해집니다.

지금 메모장에 딱 세 줄만 적어도 오늘은 집중력이 달라질 수 있어요.`,
  caption:
    '오늘 해야 할 일을 무작정 늘리지 말고, 꼭 해야 할 세 가지부터 정리해보세요. 하루의 밀도가 달라집니다.',
  hashtags: '#생산성 #업무관리 #콘텐츠기획 #릴스아이디어',
  cta: '저장해두고 오늘 할 일 점검에도 다시 꺼내보세요.',
  thumbnail_text: '오늘 할 일 3가지',
  panel_title: '릴스 대본',
  is_final: false,
  created_at: '2026-05-04T10:00:00+09:00',
  updated_at: '2026-05-04T14:43:00+09:00',
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return '미정'

  try {
    return withTime
      ? new Intl.DateTimeFormat('ko-KR', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(value))
      : new Intl.DateTimeFormat('ko-KR', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(value))
  } catch {
    return '미정'
  }
}

function getUploadTimeValueFromHour(hours: number) {
  if (hours < 12) return '09:00'
  if (hours < 18) return '13:00'
  return '19:00'
}

function normalizeUploadTimeValue(value: string) {
  if (UPLOAD_TIME_OPTIONS.some((option) => option.value === value)) {
    return value
  }

  const [hoursValue] = value.split(':')
  const hours = Number(hoursValue)

  if (!Number.isFinite(hours)) return DEFAULT_UPLOAD_TIME_VALUE

  return getUploadTimeValueFromHour(hours)
}

function splitScheduledFields(value: string | null) {
  if (!value) return { date: '', time: '' }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' }
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')

  return {
    date: `${year}-${month}-${day}`,
    time: getUploadTimeValueFromHour(Number(hours)),
  }
}

function toIsoFromScheduledFields(dateValue: string, timeValue: string) {
  if (!dateValue) return null

  const normalizedTime = normalizeUploadTimeValue(timeValue)
  const date = new Date(`${dateValue}T${normalizedTime}`)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function createSceneDrafts(script: Script | null): SceneDraft[] {
  const body = script?.body?.trim() ?? ''
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return [
    {
      id: 'scene-1',
      number: 1,
      title: '오프닝',
      body: lines[0] ?? '첫 장면에서 후킹 문장과 화면 구성을 정리해보세요.',
    },
    {
      id: 'scene-2',
      number: 2,
      title: '핵심 전달',
      body: lines[1] ?? '핵심 메시지와 예시, 전환 포인트를 정리합니다.',
    },
    {
      id: 'scene-3',
      number: 3,
      title: '마무리 CTA',
      body: lines[2] ?? '마지막 문장과 CTA를 정리해보세요.',
    },
  ]
}

function createEditableSceneDrafts(script: Script | null): SceneDraft[] {
  const defaultScenes = createSceneDrafts(SAMPLE_SCRIPT).map((scene, index) => ({
    id: `scene-${index + 1}`,
    number: index + 1,
    title: scene.title,
    body: '',
  }))
  const body = script?.body?.trim() ?? ''

  if (!body) {
    return defaultScenes
  }

  try {
    const parsed = JSON.parse(body) as unknown

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((parsedScene, index) => {
        const fallback = defaultScenes[index] ?? {
          id: `scene-${index + 1}`,
          number: index + 1,
          title: `Scene ${index + 1}`,
          body: '',
        }
        const scene =
          typeof parsedScene === 'object' && parsedScene !== null
            ? (parsedScene as Partial<PersistedSceneDraft>)
            : {}

        return {
          id: typeof scene.id === 'string' && scene.id.trim() ? scene.id : fallback.id,
          number:
            typeof scene.number === 'number' && Number.isFinite(scene.number)
              ? scene.number
              : fallback.number,
          title:
            typeof scene.title === 'string' && scene.title.trim()
              ? scene.title
              : fallback.title,
          body: typeof scene.body === 'string' ? scene.body : '',
        }
      })
    }
  } catch {
    // Support legacy plain-text script bodies without changing the current UI shape.
  }

  return defaultScenes.map((scene, index) => ({
    ...scene,
    body: index === 0 ? body : '',
  }))
}

function serializeSceneDrafts(sceneDrafts: SceneDraft[]) {
  const defaultScenes = createSceneDrafts(SAMPLE_SCRIPT).map((scene, index) => ({
    id: `scene-${index + 1}`,
    number: index + 1,
    title: scene.title,
    body: '',
  }))
  const normalizedScenes = sceneDrafts.map((scene, index) => ({
    id: scene.id,
    number: scene.number,
    title: scene.title.trim() || defaultScenes[index]?.title || `Scene ${index + 1}`,
    body: scene.body,
  }))
  const hasSceneContent = normalizedScenes.some(
    (scene, index) =>
      normalizedScenes.length !== defaultScenes.length ||
      scene.body.trim().length > 0 ||
      scene.title !== (defaultScenes[index]?.title ?? scene.title)
  )

  return hasSceneContent ? JSON.stringify(normalizedScenes) : null
}

function normalizeChecklistDrafts(checklist: unknown): ChecklistDraft[] {
  if (!Array.isArray(checklist)) {
    return []
  }

  return checklist
    .map((value, index) => {
      const item =
        typeof value === 'object' && value !== null ? (value as PersistedChecklistDraft) : {}
      const text = typeof item.text === 'string' ? item.text : ''
      const checked =
        typeof item.checked === 'boolean'
          ? item.checked
          : typeof item.done === 'boolean'
            ? item.done
            : false

      return {
        id:
          typeof item.id === 'string' && item.id.trim()
            ? item.id
            : `checklist-${index + 1}`,
        text,
        checked,
      }
    })
    .filter((item) => item.text.trim().length > 0 || item.checked)
}

function serializeChecklistDrafts(checklistDrafts: ChecklistDraft[]) {
  return checklistDrafts
    .map((item) => ({
      id: item.id,
      text: item.text.trim(),
      done: item.checked,
      checked: item.checked,
    }))
    .filter((item) => item.text.length > 0)
}

function createContentEditorDirtyKey({
  title,
  scheduledDate,
  scheduledTime,
  body,
  bodyDoc,
  caption,
  hashtags,
  thumbnail,
  memo,
  panelTitle,
  sceneDrafts,
  checklistDrafts,
  selectedProjectId,
  mediaItems,
}: {
  title: string
  scheduledDate: string
  scheduledTime: string
  body: string
  bodyDoc?: Json | null
  caption: string
  hashtags: string
  thumbnail: string
  memo: string
  panelTitle: string
  sceneDrafts: SceneDraft[]
  checklistDrafts: ChecklistDraft[]
  selectedProjectId: string
  mediaItems: MediaItem[]
}) {
  return JSON.stringify({
    title,
    scheduledDate,
    scheduledTime,
    body,
    bodyDoc,
    caption,
    hashtags,
    thumbnail,
    memo,
    panelTitle,
    scenes: serializeSceneDrafts(sceneDrafts),
    checklist: serializeChecklistDrafts(checklistDrafts),
    selectedProjectId,
    media: mediaItems
      .map((item) => ({
        id: item.id,
        storagePath: item.storage_path,
        mediaType: item.media_type,
        sortOrder: item.sort_order,
      }))
      .sort((first, second) => first.id.localeCompare(second.id)),
  })
}

function getInternalNavigationHref(anchor: HTMLAnchorElement) {
  const rawHref = anchor.getAttribute('href')

  if (!rawHref || rawHref.startsWith('#')) return null
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null
  if (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return null

  try {
    const url = new URL(anchor.href, window.location.href)

    if (url.origin !== window.location.origin) return null

    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const nextHref = `${url.pathname}${url.search}${url.hash}`

    return nextHref === currentHref ? null : nextHref
  } catch {
    return null
  }
}

function renumberSceneDrafts(sceneDrafts: SceneDraft[]) {
  return sceneDrafts.map((scene, index) => ({
    ...scene,
    number: index + 1,
  }))
}

function createAddedSceneDraft(number: number): SceneDraft {
  return {
    id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    number,
    title: '새 씬',
    body: '',
  }
}

function getSceneBodyRows(value: string) {
  const rows = value.split('\n').reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / 34))
  }, 0)

  return Math.max(4, rows)
}

function createChecklistDraft(): ChecklistDraft {
  return {
    id: `checklist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: '',
    checked: false,
  }
}

function getChannelBadgeLabel(card: ContentCard) {
  if (!card.channel) return null

  switch (card.channel.type) {
    case 'instagram':
      return '인스타그램'
    case 'threads':
      return '스레드'
    case 'youtube':
      return '유튜브'
    case 'blog':
      return '블로그'
    case 'custom':
    default:
      return card.channel.name
  }
}

function getActivityLogAction(nextStatus: 'writing' | 'published'): ContentActivityAction {
  return nextStatus === 'writing' ? 'draft_saved' : 'completed'
}

function getActivityLogDescription(nextStatus: 'writing' | 'published') {
  return nextStatus === 'writing' ? '임시저장했습니다' : '작성 완료했습니다'
}

function normalizeScheduledAtForCompare(value: string | null) {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function createShareToken() {
  const browserCrypto = globalThis.crypto

  if (browserCrypto?.randomUUID) {
    return browserCrypto.randomUUID().replaceAll('-', '')
  }

  const randomValues =
    browserCrypto?.getRandomValues
      ? Array.from(browserCrypto.getRandomValues(new Uint8Array(24)))
      : Array.from({ length: 24 }, () => Math.floor(Math.random() * 256))

  return randomValues.map((value) => value.toString(16).padStart(2, '0')).join('')
}

function sortMediaItems<T extends Pick<ContentCardMedia, 'sort_order' | 'created_at'>>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

async function createSignedMediaItems(
  supabase: ReturnType<typeof createClient>,
  rows: ContentCardMedia[]
): Promise<MediaItem[]> {
  const sortedRows = sortMediaItems(rows)

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
        console.error('Failed to create content media signed URL', error)
      }

      return {
        ...row,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )
}

const EDITOR_MEDIA_TOKEN_PATTERN = /^!\[([^\]]*)\]\(posty-media:([A-Za-z0-9_-]+)\)$/
const EDITOR_INLINE_MEDIA_PATTERN = /!\[([^\]]*)\]\(posty-media:([A-Za-z0-9_-]+)\)/
const EDITOR_LINK_PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/
const EDITOR_BOLD_PATTERN = /\*\*([^*\n]+?)\*\*/
const EDITOR_STRIKE_PATTERN = /~~([^~\n]+?)~~/
const EDITOR_LARGE_PATTERN = /<posty-large>([^<\n]+?)<\/posty-large>/
const EDITOR_TITLE_PATTERN = /<posty-title>([^<\n]+?)<\/posty-title>/
const EDITOR_SMALL_PATTERN = /<small>([^<\n]+?)<\/small>/
const EDITOR_MUTED_PATTERN = /<posty-muted>([^<\n]+?)<\/posty-muted>/
const EDITOR_COLOR_INK_PATTERN = /<posty-color-ink>([^<\n]+?)<\/posty-color-ink>/
const EDITOR_COLOR_BODY_PATTERN = /<posty-color-body>([^<\n]+?)<\/posty-color-body>/
const EDITOR_COLOR_MUTED_PATTERN = /<posty-color-muted>([^<\n]+?)<\/posty-color-muted>/
const EDITOR_COLOR_ACCENT_PATTERN = /<posty-color-accent>([^<\n]+?)<\/posty-color-accent>/
const EDITOR_COLOR_CALM_PATTERN = /<posty-color-calm>([^<\n]+?)<\/posty-color-calm>/
const EDITOR_ITALIC_PATTERN = /\*([^*\n]+?)\*/
const EDITOR_HEADING_PATTERN = /^\s{0,3}#{1,3}\s+(.+)$/
const EDITOR_UNORDERED_LIST_PATTERN = /^\s*[-*]\s+(.+)$/
const EDITOR_ORDERED_LIST_PATTERN = /^\s*\d+\.\s+(.+)$/
const EDITOR_HR_PATTERN = /^\s*-{3,}\s*$/

type EditorInlineMatch =
  | {
      type: 'media'
      index: number
      end: number
      alt: string
      id: string
      priority: number
    }
  | {
      type: 'link'
      index: number
      end: number
      label: string
      href: string
      priority: number
    }
  | {
      type:
        | 'bold'
        | 'italic'
        | 'strike'
        | 'large'
        | 'title'
        | 'small'
        | 'muted'
        | 'colorInk'
        | 'colorBody'
        | 'colorMuted'
        | 'colorAccent'
        | 'colorCalm'
      index: number
      end: number
      value: string
      priority: number
    }

function createMediaItemMap(mediaItems: MediaItem[]) {
  return new Map(mediaItems.map((item) => [item.id, item]))
}

function createEditorMediaNode(
  ownerDocument: Document,
  media: Pick<MediaItem, 'id' | 'media_type' | 'signedUrl' | 'file_name'> | null,
  fallback: { id: string; alt?: string; mediaType?: ContentMediaType }
) {
  const figure = ownerDocument.createElement('figure')
  const mediaType = media?.media_type === 'video' || fallback.mediaType === 'video' ? 'video' : 'image'
  const label = mediaType === 'video' ? RICH_MEDIA_VIDEO_LABEL : RICH_MEDIA_IMAGE_LABEL

  figure.dataset.postyMediaId = media?.id ?? fallback.id
  figure.dataset.postyMediaType = mediaType
  figure.dataset.postyMediaAlt = fallback.alt || media?.file_name || label
  figure.contentEditable = 'false'
  figure.className =
    'my-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)]'

  if (media?.signedUrl && mediaType === 'image') {
    const image = ownerDocument.createElement('img')
    image.src = media.signedUrl
    image.alt = fallback.alt || media.file_name || label
    image.className = 'max-h-[320px] w-full object-contain'
    figure.appendChild(image)
    return figure
  }

  if (media?.signedUrl && mediaType === 'video') {
    const video = ownerDocument.createElement('video')
    video.src = media.signedUrl
    video.controls = true
    video.preload = 'metadata'
    video.className = 'max-h-[320px] w-full object-contain'
    figure.appendChild(video)
    return figure
  }

  const fallbackNode = ownerDocument.createElement('div')
  fallbackNode.className =
    'px-4 py-6 text-center text-xs text-[var(--color-text-muted)]'
  fallbackNode.textContent = RICH_MEDIA_UNAVAILABLE_LABEL
  figure.appendChild(fallbackNode)

  return figure
}

function matchEditorPattern(
  source: string,
  pattern: RegExp,
  priority: number,
  type: EditorInlineMatch['type']
): EditorInlineMatch | null {
  const match = source.match(pattern)

  if (!match || typeof match.index !== 'number') return null

  if (type === 'media') {
    return {
      type,
      index: match.index,
      end: match.index + match[0].length,
      alt: match[1] ?? '',
      id: match[2],
      priority,
    }
  }

  if (type === 'link') {
    return {
      type,
      index: match.index,
      end: match.index + match[0].length,
      label: match[1] ?? '',
      href: match[2] ?? '',
      priority,
    }
  }

  return {
    type,
    index: match.index,
    end: match.index + match[0].length,
    value: match[1] ?? '',
    priority,
  }
}

function getNextEditorInlineMatch(source: string) {
  const matches = [
    matchEditorPattern(source, EDITOR_INLINE_MEDIA_PATTERN, 0, 'media'),
    matchEditorPattern(source, EDITOR_LINK_PATTERN, 1, 'link'),
    matchEditorPattern(source, EDITOR_BOLD_PATTERN, 2, 'bold'),
    matchEditorPattern(source, EDITOR_STRIKE_PATTERN, 3, 'strike'),
    matchEditorPattern(source, EDITOR_LARGE_PATTERN, 4, 'large'),
    matchEditorPattern(source, EDITOR_TITLE_PATTERN, 5, 'title'),
    matchEditorPattern(source, EDITOR_SMALL_PATTERN, 6, 'small'),
    matchEditorPattern(source, EDITOR_MUTED_PATTERN, 7, 'muted'),
    matchEditorPattern(source, EDITOR_COLOR_INK_PATTERN, 8, 'colorInk'),
    matchEditorPattern(source, EDITOR_COLOR_BODY_PATTERN, 9, 'colorBody'),
    matchEditorPattern(source, EDITOR_COLOR_MUTED_PATTERN, 10, 'colorMuted'),
    matchEditorPattern(source, EDITOR_COLOR_ACCENT_PATTERN, 11, 'colorAccent'),
    matchEditorPattern(source, EDITOR_COLOR_CALM_PATTERN, 12, 'colorCalm'),
    matchEditorPattern(source, EDITOR_ITALIC_PATTERN, 13, 'italic'),
  ].filter((match): match is EditorInlineMatch => Boolean(match))

  return matches.sort((a, b) => a.index - b.index || a.priority - b.priority)[0] ?? null
}

function getColorKeyFromEditorMatchType(type: EditorInlineMatch['type']): RichColorKey | null {
  if (type === 'colorInk') return 'ink'
  if (type === 'colorBody') return 'body'
  if (type === 'colorMuted') return 'muted'
  if (type === 'colorAccent') return 'accent'
  if (type === 'colorCalm') return 'calm'

  return null
}

function appendInlineEditorNodes(
  ownerDocument: Document,
  parent: HTMLElement | DocumentFragment,
  source: string,
  mediaById: Map<string, MediaItem>
) {
  let remaining = source

  while (remaining) {
    const match = getNextEditorInlineMatch(remaining)

    if (!match) {
      parent.appendChild(ownerDocument.createTextNode(remaining))
      break
    }

    if (match.index > 0) {
      parent.appendChild(ownerDocument.createTextNode(remaining.slice(0, match.index)))
    }

    if (match.type === 'media') {
      parent.appendChild(
        createEditorMediaNode(ownerDocument, mediaById.get(match.id) ?? null, {
          id: match.id,
          alt: match.alt,
        })
      )
    } else if (match.type === 'link') {
      const link = ownerDocument.createElement('a')
      link.href = match.href
      link.dataset.postyLink = 'true'
      link.target = '_blank'
      link.rel = 'noreferrer noopener'
      link.className =
        'cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700 [&_*]:text-blue-600'
      appendInlineEditorNodes(ownerDocument, link, match.label, mediaById)
      parent.appendChild(link)
    } else {
      const element = ownerDocument.createElement(
        match.type === 'bold'
          ? 'strong'
          : match.type === 'italic'
            ? 'em'
            : match.type === 'strike'
              ? 'del'
              : 'span'
      )

      if (['large', 'title', 'small', 'muted'].includes(match.type)) {
        element.dataset.postySize = match.type
        element.className =
          match.type === 'large'
            ? RICH_LARGE_CLASS
            : match.type === 'title'
              ? RICH_TITLE_CLASS
              : match.type === 'muted'
                ? RICH_MUTED_CLASS
                : RICH_SMALL_CLASS
      }

      const colorKey = getColorKeyFromEditorMatchType(match.type)

      if (colorKey) {
        element.dataset.postyColor = colorKey
        element.className = RICH_COLOR_OPTIONS[colorKey].className
      }

      appendInlineEditorNodes(ownerDocument, element, match.value, mediaById)
      parent.appendChild(element)
    }

    remaining = remaining.slice(match.end)
  }
}

function appendParagraphNode(
  ownerDocument: Document,
  root: HTMLElement,
  text: string,
  mediaById: Map<string, MediaItem>
) {
  const paragraph = ownerDocument.createElement('p')
  paragraph.className = 'my-0 min-h-[1.85em]'

  if (text) {
    appendInlineEditorNodes(ownerDocument, paragraph, text, mediaById)
  } else {
    paragraph.appendChild(ownerDocument.createElement('br'))
  }

  root.appendChild(paragraph)
}

function renderMarkdownIntoEditor(root: HTMLDivElement, markdown: string, mediaItems: MediaItem[]) {
  const ownerDocument = root.ownerDocument
  const mediaById = createMediaItemMap(mediaItems)
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  root.replaceChildren()

  if (!markdown.trim()) return

  for (let index = 0; index < lines.length; ) {
    const line = lines[index]
    const mediaMatch = line.trim().match(EDITOR_MEDIA_TOKEN_PATTERN)
    const headingMatch = line.match(EDITOR_HEADING_PATTERN)

    if (!line.trim()) {
      appendParagraphNode(ownerDocument, root, '', mediaById)
      index += 1
      continue
    }

    if (mediaMatch) {
      root.appendChild(
        createEditorMediaNode(ownerDocument, mediaById.get(mediaMatch[2]) ?? null, {
          id: mediaMatch[2],
          alt: mediaMatch[1],
        })
      )
      index += 1
      continue
    }

    if (EDITOR_HR_PATTERN.test(line)) {
      root.appendChild(ownerDocument.createElement('hr'))
      index += 1
      continue
    }

    if (headingMatch) {
      const heading = ownerDocument.createElement('h2')
      heading.className = 'my-0 text-[30px] font-semibold leading-[1.25] text-[var(--color-text-primary)]'
      appendInlineEditorNodes(ownerDocument, heading, headingMatch[1], mediaById)
      root.appendChild(heading)
      index += 1
      continue
    }

    const unorderedItem = line.match(EDITOR_UNORDERED_LIST_PATTERN)?.[1]
    if (unorderedItem) {
      const list = ownerDocument.createElement('ul')
      list.className = 'my-0 list-disc space-y-0 pl-5'

      while (index < lines.length) {
        const item = lines[index].match(EDITOR_UNORDERED_LIST_PATTERN)?.[1]
        if (!item) break

        const listItem = ownerDocument.createElement('li')
        appendInlineEditorNodes(ownerDocument, listItem, item, mediaById)
        list.appendChild(listItem)
        index += 1
      }

      root.appendChild(list)
      continue
    }

    const orderedItem = line.match(EDITOR_ORDERED_LIST_PATTERN)?.[1]
    if (orderedItem) {
      const list = ownerDocument.createElement('ol')
      list.className = 'my-0 list-decimal space-y-0 pl-5'

      while (index < lines.length) {
        const item = lines[index].match(EDITOR_ORDERED_LIST_PATTERN)?.[1]
        if (!item) break

        const listItem = ownerDocument.createElement('li')
        appendInlineEditorNodes(ownerDocument, listItem, item, mediaById)
        list.appendChild(listItem)
        index += 1
      }

      root.appendChild(list)
      continue
    }

    appendParagraphNode(ownerDocument, root, line, mediaById)
    index += 1
  }
}

function normalizeEditorColorValue(value: string | null | undefined): RichColorKey | null {
  if (!value) return null

  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')

  if (!normalized) return null

  const colorEntries = Object.entries(RICH_COLOR_OPTIONS) as Array<
    [RichColorKey, (typeof RICH_COLOR_OPTIONS)[RichColorKey]]
  >

  for (const [key, option] of colorEntries) {
    if (normalized === option.value || normalized === option.value.toLowerCase()) {
      return key
    }
  }

  const rgbMap: Record<string, RichColorKey> = {
    'rgb(34,34,34)': 'ink',
    'rgb(63,63,63)': 'body',
    'rgb(106,106,106)': 'muted',
    'rgb(255,56,92)': 'accent',
    'rgb(47,111,102)': 'calm',
  }

  return rgbMap[normalized] ?? null
}

function getEditorElementColorKey(node: HTMLElement): RichColorKey | null {
  const datasetColor = node.dataset.postyColor

  if (
    datasetColor === 'ink' ||
    datasetColor === 'body' ||
    datasetColor === 'muted' ||
    datasetColor === 'accent' ||
    datasetColor === 'calm'
  ) {
    return datasetColor
  }

  return (
    normalizeEditorColorValue(node.getAttribute('color')) ??
    normalizeEditorColorValue(node.style.color)
  )
}

function wrapSerializedColor(content: string, colorKey: RichColorKey | null) {
  if (!colorKey) return content

  const tagName = RICH_COLOR_OPTIONS[colorKey].tag

  return `<${tagName}>${content}</${tagName}>`
}

function serializeInlineEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.replace(/\u00a0/g, ' ') ?? ''
  }

  if (!(node instanceof HTMLElement)) return ''

  const mediaId = node.dataset.postyMediaId

  if (mediaId) {
    const mediaType = node.dataset.postyMediaType === 'video' ? 'video' : 'image'
    return createMediaMarkdownToken({ id: mediaId, media_type: mediaType })
  }

  if (node.tagName === 'BR') return '\n'

  const content = Array.from(node.childNodes).map(serializeInlineEditorNode).join('')

  const colorKey = getEditorElementColorKey(node)

  if (node.tagName === 'STRONG' || node.tagName === 'B') {
    return wrapSerializedColor(`**${content}**`, colorKey)
  }
  if (node.tagName === 'EM' || node.tagName === 'I') {
    return wrapSerializedColor(`*${content}*`, colorKey)
  }
  if (node.tagName === 'DEL' || node.tagName === 'S' || node.tagName === 'STRIKE') {
    return wrapSerializedColor(`~~${content}~~`, colorKey)
  }
  if (node.tagName === 'FONT') {
    const fontSize = node.getAttribute('size')

    if (fontSize === '7') {
      return wrapSerializedColor(`<posty-large>${content}</posty-large>`, colorKey)
    }

    if (fontSize === '6') {
      return wrapSerializedColor(`<posty-title>${content}</posty-title>`, colorKey)
    }

    if (fontSize === '2') {
      if (colorKey === 'muted') {
        return `<posty-muted>${content}</posty-muted>`
      }

      return wrapSerializedColor(`<small>${content}</small>`, colorKey)
    }
  }
  if (node.dataset.postySize === 'large') {
    return wrapSerializedColor(`<posty-large>${content}</posty-large>`, colorKey)
  }
  if (node.dataset.postySize === 'title') {
    return wrapSerializedColor(`<posty-title>${content}</posty-title>`, colorKey)
  }
  if (node.dataset.postySize === 'muted') {
    return wrapSerializedColor(`<posty-muted>${content}</posty-muted>`, colorKey)
  }
  if (node.dataset.postySize === 'small' || node.tagName === 'SMALL') {
    return wrapSerializedColor(`<small>${content}</small>`, colorKey)
  }
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') || RICH_LINK_URL_PLACEHOLDER
    return wrapSerializedColor(`[${content || RICH_LINK_TEXT_PLACEHOLDER}](${href})`, colorKey)
  }

  return wrapSerializedColor(content, colorKey)
}

function serializeEditorBlock(node: ChildNode, index: number): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) return ''

  const mediaId = node.dataset.postyMediaId

  if (mediaId) {
    const mediaType = node.dataset.postyMediaType === 'video' ? 'video' : 'image'
    return createMediaMarkdownToken({ id: mediaId, media_type: mediaType })
  }

  if (node.tagName === 'HR') return '---'

  if (node.tagName === 'UL' || node.tagName === 'OL') {
    const ordered = node.tagName === 'OL'

    return Array.from(node.children)
      .filter((child) => child.tagName === 'LI')
      .map((child, itemIndex) => {
        const prefix = ordered ? `${itemIndex + 1}.` : '-'
        return `${prefix} ${serializeInlineEditorNode(child).trim()}`
      })
      .join('\n')
  }

  if (node.tagName === 'H1' || node.tagName === 'H2' || node.tagName === 'H3') {
    return `## ${serializeInlineEditorNode(node).trim()}`
  }

  const value = serializeInlineEditorNode(node)

  return index === 0 ? value.replace(/^\n+/, '') : value
}

function serializeEditorToMarkdown(root: HTMLDivElement) {
  return Array.from(root.childNodes)
    .map(serializeEditorBlock)
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
}

function isSelectionInsideElement(element: HTMLElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)

  return element.contains(range.commonAncestorContainer)
}

function insertHtmlAtSelection(editor: HTMLDivElement, html: string) {
  editor.focus()

  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0 || !isSelectionInsideElement(editor)) {
    const fallbackRange = editor.ownerDocument.createRange()
    fallbackRange.selectNodeContents(editor)
    fallbackRange.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(fallbackRange)
  }

  document.execCommand('insertHTML', false, html)
}

function getEditableBlockForRange(editor: HTMLElement, range: Range) {
  let node: Node | null = range.commonAncestorContainer

  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode
  }

  while (node && node !== editor) {
    if (node instanceof HTMLElement) {
      if (['P', 'DIV', 'H1', 'H2', 'H3', 'LI'].includes(node.tagName)) {
        return node
      }

      if (node.parentElement === editor) {
        return node
      }
    }

    node = node.parentNode
  }

  return null
}

function unwrapPostySizeElements(root: HTMLElement, options: { includeRoot?: boolean } = {}) {
  const targets: HTMLElement[] = []

  if (options.includeRoot && root.matches('[data-posty-size], small, font[size]')) {
    targets.push(root)
  }

  root.querySelectorAll('[data-posty-size], small, font[size]').forEach((node) => {
    if (node instanceof HTMLElement) targets.push(node)
  })

  targets.forEach((wrapper) => {
    const parent = wrapper?.parentNode

    if (!wrapper || !parent) return

    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper)
    }

    parent.removeChild(wrapper)
  })
}

function normalizeEditorLinks(editor: HTMLElement) {
  editor.querySelectorAll('a').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return

    link.dataset.postyLink = 'true'
    link.target = '_blank'
    link.rel = 'noreferrer noopener'
    link.className =
      'cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700 [&_*]:text-blue-600'
  })
}

function normalizeEditorLists(editor: HTMLElement) {
  editor.querySelectorAll('ul').forEach((list) => {
    if (!(list instanceof HTMLElement)) return
    list.className = 'my-0 list-disc space-y-0 pl-5'
  })

  editor.querySelectorAll('ol').forEach((list) => {
    if (!(list instanceof HTMLElement)) return
    list.className = 'my-0 list-decimal space-y-0 pl-5'
  })

  editor.querySelectorAll('li').forEach((item) => {
    if (!(item instanceof HTMLElement)) return
    item.className = 'min-h-[1.75em] pl-1 leading-[1.75]'
  })
}

function selectCurrentEditableBlockContents(editor: HTMLDivElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return false

  const block = getEditableBlockForRange(editor, selection.getRangeAt(0))

  if (!block) return false

  const range = editor.ownerDocument.createRange()
  range.selectNodeContents(block)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
}

function selectInsertedTextBeforeCaret(placeholder: string) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const node = range.startContainer
  const offset = range.startOffset

  if (node.nodeType !== Node.TEXT_NODE || offset < placeholder.length) return

  const value = node.textContent ?? ''

  if (value.slice(offset - placeholder.length, offset) !== placeholder) return

  range.setStart(node, offset - placeholder.length)
  range.setEnd(node, offset)
  selection.removeAllRanges()
  selection.addRange(range)
}

function normalizeEditorLinkUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return ''
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed

  return `https://${trimmed}`
}

function getPanelStateStorageKey(cardId: string) {
  return `${PANEL_STATE_STORAGE_PREFIX}${cardId}`
}

function normalizePanelState(value: unknown): Record<EditorSection, boolean> {
  const source = value && typeof value === 'object' ? value : {}

  return {
    body: Boolean((source as Partial<Record<EditorSection, unknown>>).body),
    scenes: Boolean((source as Partial<Record<EditorSection, unknown>>).scenes),
    caption: Boolean((source as Partial<Record<EditorSection, unknown>>).caption),
    hashtags: Boolean((source as Partial<Record<EditorSection, unknown>>).hashtags),
    thumbnail: Boolean((source as Partial<Record<EditorSection, unknown>>).thumbnail),
    checklist: Boolean((source as Partial<Record<EditorSection, unknown>>).checklist),
    memo: Boolean((source as Partial<Record<EditorSection, unknown>>).memo),
  }
}

function readPanelState(cardId: string): Record<EditorSection, boolean> {
  if (typeof window === 'undefined') return { ...CLOSED_EDITOR_SECTIONS }

  try {
    const value = window.localStorage.getItem(getPanelStateStorageKey(cardId))

    if (!value) return { ...CLOSED_EDITOR_SECTIONS }

    return normalizePanelState(JSON.parse(value))
  } catch (error) {
    console.warn('Failed to read content editor panel state', error)
    return { ...CLOSED_EDITOR_SECTIONS }
  }
}

function writePanelState(cardId: string, value: Record<EditorSection, boolean>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getPanelStateStorageKey(cardId), JSON.stringify(value))
  } catch (error) {
    console.warn('Failed to save content editor panel state', error)
  }
}

export function ContentEditorShell({ cardId }: ContentEditorShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const bodyEditorRef = useRef<HTMLDivElement | null>(null)
  const bodyEditorApiRef = useRef<RichTextEditorHandle | null>(null)
  const bodyImageUploadInputRef = useRef<HTMLInputElement | null>(null)
  const bodyEditorSelectionRef = useRef<Range | null>(null)
  const bodyLinkUrlInputRef = useRef<HTMLInputElement | null>(null)
  const lastEditorMarkdownRef = useRef('')
  const lastEditorMediaKeyRef = useRef('')
  const hasUnsavedChangesRef = useRef(false)
  const currentDirtyKeyRef = useRef('')
  const allowNavigationRef = useRef(false)
  const [card, setCard] = useState<ContentCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<EditorSection, boolean>>(
    () => ({ ...CLOSED_EDITOR_SECTIONS })
  )
  const [titleDraft, setTitleDraft] = useState('')
  const [scheduledDateDraft, setScheduledDateDraft] = useState('')
  const [scheduledTimeDraft, setScheduledTimeDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [bodyDocDraft, setBodyDocDraft] = useState<Json | null>(null)
  const [tiptapEditorRevision, setTiptapEditorRevision] = useState(0)
  const [captionDraft, setCaptionDraft] = useState('')
  const [hashtagsDraft, setHashtagsDraft] = useState('')
  const [thumbnailDraft, setThumbnailDraft] = useState('')
  const [memoDraft, setMemoDraft] = useState('')
  const [panelTitle, setPanelTitle] = useState(DEFAULT_PANEL_TITLE)
  const [sceneDrafts, setSceneDrafts] = useState<SceneDraft[]>(
    createEditableSceneDrafts(SAMPLE_SCRIPT)
  )
  const [checklistDrafts, setChecklistDrafts] = useState<ChecklistDraft[]>(
    normalizeChecklistDrafts(SAMPLE_CARD.checklist)
  )
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveFeedbackLabel, setSaveFeedbackLabel] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [projects, setProjects] = useState<ContentProjectSummary[]>([])
  const [sidebarCards, setSidebarCards] = useState<SidebarContentCard[]>([])
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<string[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [scriptRecord, setScriptRecord] = useState<Script | null>(null)
  const [shareLink, setShareLink] = useState<ContentShareLink | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftRows, setDraftRows] = useState<ContentCardDraft[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftDeletingId, setDraftDeletingId] = useState<string | null>(null)
  const [draftFeedback, setDraftFeedback] = useState<string | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [pendingDraftLoad, setPendingDraftLoad] = useState<ContentCardDraft | null>(null)
  const [pendingDraftDelete, setPendingDraftDelete] = useState<ContentCardDraft | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaDeletingIds, setMediaDeletingIds] = useState<string[]>([])
  const [bodyLinkPopoverOpen, setBodyLinkPopoverOpen] = useState(false)
  const [bodyLinkUrlDraft, setBodyLinkUrlDraft] = useState('')
  const [bodyLinkError, setBodyLinkError] = useState<string | null>(null)
  const [savedDirtyKey, setSavedDirtyKey] = useState<string | null>(null)
  const [baselineSyncNonce, setBaselineSyncNonce] = useState(0)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null)

  const isPreview = PREVIEW_IDS.has(cardId)
  const tiptapOptInRequested = searchParams.get('editor') !== 'legacy' && !isPreview
  const isTiptapEditorEnabled = tiptapOptInRequested && Boolean(card?.id)

  const sidebarCardsByProject = useMemo(() => {
    return sidebarCards.reduce<Record<string, SidebarContentCard[]>>((acc, sidebarCard) => {
      if (!sidebarCard.project_id) return acc

      acc[sidebarCard.project_id] = acc[sidebarCard.project_id] ?? []
      acc[sidebarCard.project_id].push(sidebarCard)
      return acc
    }, {})
  }, [sidebarCards])
  const uncategorizedSidebarCards = useMemo(
    () => sidebarCards.filter((sidebarCard) => !sidebarCard.project_id),
    [sidebarCards]
  )
  const activeSidebarProjectId = selectedProjectId || null
  const selectedCampaignProject = useMemo(() => {
    if (!selectedProjectId) return null

    const projectFromList = projects.find((project) => project.id === selectedProjectId)
    if (projectFromList) return projectFromList

    return card?.project?.id === selectedProjectId ? card.project : null
  }, [card?.project, projects, selectedProjectId])
  const selectedCampaignLabel = selectedCampaignProject?.title?.trim() || '캠페인 선택'
  const activeShareLink = shareLink?.is_enabled ? shareLink : null
  const shareUrl = shareLink
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/content/${shareLink.token}`
    : null
  const createdDateLabel = card ? formatDate(card.created_at) : ''
  const selectedUploadTimeValue = normalizeUploadTimeValue(scheduledTimeDraft)
  const mediaRenderKey = useMemo(
    () => mediaItems.map((item) => `${item.id}:${item.signedUrl ?? ''}`).join('|'),
    [mediaItems]
  )
  const attachmentMediaItems = useMemo(
    () => mediaItems.filter(isAttachmentContentMedia),
    [mediaItems]
  )
  const tiptapInlineMediaItems = useMemo(
    () =>
      mediaItems
        .filter(isInlineContentMedia)
        .map((item) => ({
          id: item.id,
          signedUrl: item.signedUrl,
          fileName: item.file_name?.trim() || MEDIA_UNTITLED_FILE_LABEL,
        })),
    [mediaItems]
  )
  const currentDirtyKey = useMemo(
    () =>
      createContentEditorDirtyKey({
        title: titleDraft,
        scheduledDate: scheduledDateDraft,
        scheduledTime: scheduledTimeDraft,
        body: bodyDraft,
        bodyDoc: isTiptapEditorEnabled ? bodyDocDraft : null,
        caption: captionDraft,
        hashtags: hashtagsDraft,
        thumbnail: thumbnailDraft,
        memo: memoDraft,
        panelTitle,
        sceneDrafts,
        checklistDrafts,
        selectedProjectId,
        mediaItems,
      }),
    [
      titleDraft,
      scheduledDateDraft,
      scheduledTimeDraft,
      bodyDraft,
      bodyDocDraft,
      captionDraft,
      hashtagsDraft,
      thumbnailDraft,
      memoDraft,
      panelTitle,
      sceneDrafts,
      checklistDrafts,
      selectedProjectId,
      mediaItems,
      isTiptapEditorEnabled,
    ]
  )
  const hasUnsavedChanges = savedDirtyKey !== null && currentDirtyKey !== savedDirtyKey
  const bodyTiptapDoc = useMemo(
    () => getTiptapDocForEditor(bodyDocDraft, bodyDraft),
    [bodyDocDraft, bodyDraft]
  )

  useEffect(() => {
    currentDirtyKeyRef.current = currentDirtyKey
  }, [currentDirtyKey])

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (baselineSyncNonce === 0) return

    const timer = window.setTimeout(() => {
      setSavedDirtyKey(currentDirtyKeyRef.current)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [baselineSyncNonce])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current || allowNavigationRef.current) return

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChangesRef.current || allowNavigationRef.current) return
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return

      const nextHref = getInternalNavigationHref(anchor)
      if (!nextHref) return

      event.preventDefault()
      event.stopPropagation()
      setPendingNavigationHref(nextHref)
      setLeaveModalOpen(true)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [])

  useEffect(() => {
    if (saveState !== 'saved') return

    const timer = window.setTimeout(() => {
      setSaveState('idle')
      setSaveFeedbackLabel(null)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [saveState])

  useEffect(() => {
    if (!card?.id || isPreview) {
      setExpandedSections({ ...CLOSED_EDITOR_SECTIONS })
      return
    }

    setExpandedSections(readPanelState(card.id))
  }, [card?.id, isPreview])

  useEffect(() => {
    if (!shareFeedback) return

    const timer = window.setTimeout(() => {
      setShareFeedback(null)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [shareFeedback])

  useEffect(() => {
    const editor = bodyEditorRef.current

    if (!editor) return
    if (
      lastEditorMarkdownRef.current === bodyDraft &&
      lastEditorMediaKeyRef.current === mediaRenderKey
    ) {
      return
    }
    if (document.activeElement === editor) return

    renderMarkdownIntoEditor(editor, bodyDraft, mediaItems)
    lastEditorMarkdownRef.current = bodyDraft
    lastEditorMediaKeyRef.current = mediaRenderKey
  }, [bodyDraft, mediaItems, mediaRenderKey])

  useEffect(() => {
    let cancelled = false

    const applyState = (
      nextCard: ContentCard | null,
      nextScript: Script | null,
      nextMediaItems: MediaItem[]
    ) => {
      if (cancelled) return

      const nextScheduled = splitScheduledFields(
        nextCard?.scheduled_at ?? nextCard?.published_at ?? null
      )
      const nextPanelTitle = nextScript?.panel_title?.trim() || DEFAULT_PANEL_TITLE
      const nextSceneDrafts = createEditableSceneDrafts(nextScript)
      const nextChecklistDrafts = normalizeChecklistDrafts(nextCard?.checklist)
      const nextSelectedProjectId = nextCard?.project_id ?? ''
      const shouldUseTiptap = tiptapOptInRequested && Boolean(nextCard?.id)
      const nextBodyDoc = shouldUseTiptap
        ? (createTiptapDocEnvelope(
            getTiptapDocForEditor(nextCard?.memo_doc, nextCard?.memo)
          ) as unknown as Json)
        : null

      setCard(nextCard)
      setScriptRecord(nextScript)
      setTitleDraft(nextCard?.title ?? '')
      setScheduledDateDraft(nextScheduled.date)
      setScheduledTimeDraft(nextScheduled.time)
      setBodyDraft(nextCard?.memo ?? '')
      setBodyDocDraft(nextBodyDoc)
      setCaptionDraft(nextScript?.caption ?? '')
      setHashtagsDraft(nextScript?.hashtags ?? '')
      setThumbnailDraft(nextScript?.thumbnail_text ?? '')
      setMemoDraft(nextCard?.editor_memo ?? '')
      setPanelTitle(nextPanelTitle)
      setSceneDrafts(nextSceneDrafts)
      setChecklistDrafts(nextChecklistDrafts)
      setSelectedProjectId(nextSelectedProjectId)
      setSavedDirtyKey(null)
      setBaselineSyncNonce((prev) => prev + 1)
      setSaveState('idle')
      setSaveFeedbackLabel(null)
      setLoading(false)
    }

    const fetchDetail = async () => {
      setLoading(true)

      if (isPreview) {
        setProjects([])
        setSidebarCards([])
        setExpandedCampaignIds([])
        setShareLink(null)
        setMediaItems([])
        applyState(SAMPLE_CARD, SAMPLE_SCRIPT, [])
        return
      }

      const supabase = createClient()
      const [
        { data: cardData, error: cardError },
        { data: scriptData, error: scriptError },
        { data: projectData, error: projectError },
        { data: sidebarCardData, error: sidebarCardError },
        { data: shareLinkData, error: shareLinkError },
        { data: mediaData, error: mediaError },
      ] = await Promise.all([
        supabase
          .from('content_cards')
          .select('*, channel:channels(*), project:content_projects(id,title)')
          .eq('id', cardId)
          .eq('content_kind', 'content')
          .maybeSingle(),
        supabase.from('scripts').select('*').eq('card_id', cardId).maybeSingle(),
        supabase.from('content_projects').select('id, title').order('created_at', { ascending: false }),
        supabase
          .from('content_cards')
          .select('id, title, project_id, status, scheduled_at, is_deleted, channel:channels(id,name,type,color)')
          .eq('is_deleted', false)
          .eq('content_kind', 'content')
          .order('created_at', { ascending: false }),
        supabase
          .from('content_share_links')
          .select('*')
          .eq('card_id', cardId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('content_card_media')
          .select('id, user_id, card_id, storage_path, file_name, mime_type, media_type, file_size, sort_order, created_at')
          .eq('card_id', cardId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
      ])

      if (cardError) {
        console.error('Failed to fetch content card', cardError)
      }

      if (scriptError) {
        console.error('Failed to fetch script', scriptError)
      }

      if (projectError) {
        console.error('Failed to fetch content projects', projectError)
      }

      if (sidebarCardError) {
        console.error('Failed to fetch content sidebar cards', sidebarCardError)
      }

      if (shareLinkError) {
        console.error('Failed to fetch content share link', shareLinkError)
      }

      if (mediaError) {
        console.error('Failed to fetch content card media', mediaError)
      }

      const nextCard = (cardData as ContentCard | null) ?? null
      const nextMediaItems = mediaError
        ? []
        : await createSignedMediaItems(supabase, (mediaData as ContentCardMedia[] | null) ?? [])
      const nextExpandedIds =
        nextCard && !nextCard.is_deleted
          ? [nextCard.project_id ?? UNCATEGORIZED_GROUP_ID]
          : []

      if (cancelled) return

      setProjects((projectData as ContentProjectSummary[] | null) ?? [])
      setSidebarCards((sidebarCardData as SidebarContentCard[] | null) ?? [])
      setExpandedCampaignIds(nextExpandedIds)
      setShareLink((shareLinkData as ContentShareLink | null) ?? null)
      setMediaItems(nextMediaItems)
      applyState(nextCard, (scriptData as Script | null) ?? null, nextMediaItems)
    }

    fetchDetail()

    return () => {
      cancelled = true
    }
  }, [cardId, isPreview, tiptapOptInRequested])

  const channelBadgeLabel = card ? getChannelBadgeLabel(card) : null

  const updateSceneDraft = (sceneId: string, key: 'title' | 'body', value: string) => {
    setSceneDrafts((prev) =>
      prev.map((scene) => (scene.id === sceneId ? { ...scene, [key]: value } : scene))
    )
  }

  const addSceneDraft = () => {
    setSceneDrafts((prev) => [...prev, createAddedSceneDraft(prev.length + 1)])
  }

  const removeSceneDraft = (sceneId: string) => {
    setSceneDrafts((prev) => {
      if (prev.length <= 1) {
        return prev
      }

      return renumberSceneDrafts(prev.filter((scene) => scene.id !== sceneId))
    })
  }

  const updateChecklistDraft = (
    itemId: string,
    key: keyof Omit<ChecklistDraft, 'id'>,
    value: string | boolean
  ) => {
    setChecklistDrafts((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [key]: value } : item))
    )
  }

  const addChecklistDraft = () => {
    setChecklistDrafts((prev) => [...prev, createChecklistDraft()])
  }

  const removeChecklistDraft = (itemId: string) => {
    setChecklistDrafts((prev) => prev.filter((item) => item.id !== itemId))
  }

  const handlePersist = async (nextStatus: 'writing' | 'published') => {
    if (isPreview || !card || card.is_deleted || saveState === 'saving' || deleting) return

    setSaveState('saving')
    setSaveFeedbackLabel(null)

    try {
      const supabase = createClient()
      const previousScheduledAt = card.scheduled_at
      const nextSceneBody = serializeSceneDrafts(sceneDrafts)
      const nextChecklist = serializeChecklistDrafts(checklistDrafts)
      const nextPanelTitle = panelTitle.trim() || DEFAULT_PANEL_TITLE
      const nextBodyDoc = isTiptapEditorEnabled
        ? createTiptapDocEnvelope(getTiptapDocForEditor(bodyDocDraft, bodyDraft))
        : null
      const nextBodyMemo = isTiptapEditorEnabled
        ? getPlainTextFromTiptapDoc(nextBodyDoc?.doc)
        : bodyDraft
      const payload: {
        title: string
        status: 'writing' | 'published'
        scheduled_at: string | null
        memo: string | null
        memo_doc?: Json | null
        editor_memo: string | null
        checklist: ChecklistItem[]
        project_id: string | null
      } = {
        /*
        title: titleDraft.trim() || '새 콘텐츠',
        */
        title: titleDraft.trim() || 'Untitled content',
        status: nextStatus,
        scheduled_at: toIsoFromScheduledFields(scheduledDateDraft, scheduledTimeDraft),
        memo: nextBodyMemo.trim() ? nextBodyMemo : null,
        editor_memo: memoDraft.trim() ? memoDraft : null,
        checklist: nextChecklist,
        project_id: selectedProjectId || null,
      }
      if (isTiptapEditorEnabled) {
        payload.memo_doc = nextBodyDoc as unknown as Json
      }

      const { data, error } = await supabase
        .from('content_cards')
        .update(payload)
        .eq('id', card.id)
        .eq('content_kind', 'content')
        .select('*, channel:channels(*), project:content_projects(id,title)')
        .single()

      if (error) {
        throw error
      }

      const nextCard = data as ContentCard
      const scriptPayload = {
        user_id: nextCard.user_id,
        card_id: nextCard.id,
        title: nextCard.title?.trim() || 'Untitled content',
        body: nextSceneBody,
        caption: captionDraft.trim() ? captionDraft : null,
        hashtags: hashtagsDraft.trim() ? hashtagsDraft : null,
        thumbnail_text: thumbnailDraft.trim() ? thumbnailDraft : null,
        panel_title: nextPanelTitle,
      }
      const { data: scriptData, error: scriptError } = scriptRecord?.id
        ? await supabase
            .from('scripts')
            .update(scriptPayload)
            .eq('id', scriptRecord.id)
            .select('*')
            .single()
        : await supabase.from('scripts').insert(scriptPayload).select('*').single()

      if (scriptError) {
        throw scriptError
      }

      const nextScript = scriptData as Script
      const nextScheduled = splitScheduledFields(
        nextCard.scheduled_at ?? nextCard.published_at ?? null
      )
      const hasScript =
        Boolean(nextScript.body?.trim()) ||
        Boolean(nextScript.caption?.trim()) ||
        Boolean(nextScript.hashtags?.trim()) ||
        Boolean(nextScript.thumbnail_text?.trim())
      const scheduleChanged =
        normalizeScheduledAtForCompare(previousScheduledAt) !==
        normalizeScheduledAtForCompare(nextCard.scheduled_at)

      try {
        await recordContentActivityLog({
          user_id: nextCard.user_id,
          card_id: nextCard.id,
          project_id: nextCard.project_id ?? null,
          action: getActivityLogAction(nextStatus),
          title: nextCard.title?.trim() || 'Untitled content',
          description: getActivityLogDescription(nextStatus),
          metadata: {
            status: nextStatus,
            scheduled_at: nextCard.scheduled_at,
            project_id: nextCard.project_id,
            has_script: hasScript,
            checklist_count: nextChecklist.length,
          },
        })
      } catch (activityLogError) {
        console.warn('Failed to record content activity log', activityLogError)
      }

      if (scheduleChanged) {
        try {
          await recordContentActivityLog({
            user_id: nextCard.user_id,
            card_id: nextCard.id,
            project_id: nextCard.project_id ?? null,
            action: 'schedule_changed',
            title: nextCard.title?.trim() || 'Untitled content',
            description: '업로드 일정을 변경했습니다',
            metadata: {
              previous_scheduled_at: previousScheduledAt,
              next_scheduled_at: nextCard.scheduled_at,
              status: nextStatus,
              project_id: nextCard.project_id,
              has_script: hasScript,
              checklist_count: nextChecklist.length,
            },
          })
        } catch (activityLogError) {
          console.warn('Failed to record schedule change activity log', activityLogError)
        }
      }

      setCard(nextCard)
      setScriptRecord(nextScript)
      const nextPanelTitleState = nextScript.panel_title?.trim() || DEFAULT_PANEL_TITLE
      const nextSceneDrafts = createEditableSceneDrafts(nextScript)
      const nextChecklistDrafts = normalizeChecklistDrafts(nextCard.checklist)
      const nextSelectedProjectId = nextCard.project_id ?? ''
      const nextBodyDraft = nextCard.memo ?? ''
      const nextBodyDocDraft = isTiptapEditorEnabled
        ? (createTiptapDocEnvelope(
            getTiptapDocForEditor(nextCard.memo_doc, nextCard.memo)
          ) as unknown as Json)
        : null
      const nextCaptionDraft = nextScript.caption ?? ''
      const nextHashtagsDraft = nextScript.hashtags ?? ''
      const nextThumbnailDraft = nextScript.thumbnail_text ?? ''
      const nextMemoDraft = nextCard.editor_memo ?? ''

      setTitleDraft(nextCard.title)
      setScheduledDateDraft(nextScheduled.date)
      setScheduledTimeDraft(nextScheduled.time)
      setBodyDraft(nextBodyDraft)
      setBodyDocDraft(nextBodyDocDraft)
      setCaptionDraft(nextCaptionDraft)
      setHashtagsDraft(nextHashtagsDraft)
      setThumbnailDraft(nextThumbnailDraft)
      setMemoDraft(nextMemoDraft)
      setPanelTitle(nextPanelTitleState)
      setSceneDrafts(nextSceneDrafts)
      setChecklistDrafts(nextChecklistDrafts)
      setSelectedProjectId(nextSelectedProjectId)
      setSavedDirtyKey(
        createContentEditorDirtyKey({
          title: nextCard.title,
          scheduledDate: nextScheduled.date,
          scheduledTime: nextScheduled.time,
          body: nextBodyDraft,
          bodyDoc: isTiptapEditorEnabled ? nextBodyDocDraft : null,
          caption: nextCaptionDraft,
          hashtags: nextHashtagsDraft,
          thumbnail: nextThumbnailDraft,
          memo: nextMemoDraft,
          panelTitle: nextPanelTitleState,
          sceneDrafts: nextSceneDrafts,
          checklistDrafts: nextChecklistDrafts,
          selectedProjectId: nextSelectedProjectId,
          mediaItems,
        })
      )
      writePanelState(nextCard.id, expandedSections)
      setSaveFeedbackLabel(
        nextStatus === 'writing' ? '임시저장되었습니다' : '저장되었습니다'
      )
      setSaveState('saved')
      if (nextStatus === 'writing') {
        await new Promise((resolve) => window.setTimeout(resolve, 250))
        allowNavigationRef.current = true
        router.push('/content')
        window.setTimeout(() => {
          allowNavigationRef.current = false
        }, 1000)
      } else if (cardId !== nextCard.id) {
        allowNavigationRef.current = true
        router.replace(`/content/${nextCard.id}`, { scroll: false })
        window.setTimeout(() => {
          allowNavigationRef.current = false
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to save content card', error)
      setSaveState('error')
      setSaveFeedbackLabel(null)
      window.alert('저장하지 못했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const handleSoftDelete = async () => {
    if (isPreview || !card || card.is_deleted || saveState === 'saving' || deleting) return

    const confirmed = window.confirm(
      '이 콘텐츠를 삭제하시겠습니까? 삭제된 콘텐츠는 휴지통에 보관됩니다.'
    )

    if (!confirmed) return

    setDeleting(true)

    try {
      const supabase = createClient()
      const deletedAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('content_cards')
        .update({
          is_deleted: true,
          deleted_at: deletedAt,
          deleted_reason: null,
        })
        .eq('id', card.id)
        .eq('content_kind', 'content')
        .select('*, channel:channels(*), project:content_projects(id,title)')
        .single()

      if (error) {
        throw error
      }

      const deletedCard = data as ContentCard

      try {
        await recordContentActivityLog(
          {
            user_id: deletedCard.user_id,
            card_id: deletedCard.id,
            project_id: deletedCard.project_id ?? null,
            action: 'deleted',
            title: deletedCard.title?.trim() || 'Untitled content',
            description: '콘텐츠를 삭제했습니다',
            metadata: {
              status: deletedCard.status,
              scheduled_at: deletedCard.scheduled_at,
              project_id: deletedCard.project_id,
              deleted_at: deletedCard.deleted_at ?? deletedAt,
              source: 'content_editor',
            },
          },
          supabase
        )
      } catch (activityLogError) {
        console.warn('Failed to record content delete activity log', activityLogError)
      }

      router.push('/content')
    } catch (error) {
      console.error('Failed to soft delete content card', error)
      window.alert('삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setDeleting(false)
    }
  }

  const handleRestoreDeletedCard = async () => {
    if (!card || restoring) return

    const confirmed = window.confirm('이 콘텐츠를 복구하시겠습니까?')

    if (!confirmed) return

    setRestoring(true)

    try {
      const supabase = createClient()
      const restoredAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('content_cards')
        .update({
          is_deleted: false,
          deleted_at: null,
          deleted_reason: null,
        })
        .eq('id', card.id)
        .eq('content_kind', 'content')
        .select('*, channel:channels(*), project:content_projects(id,title)')
        .single()

      if (error) {
        throw error
      }

      const restoredCard = data as ContentCard

      try {
        await recordContentActivityLog(
          {
            user_id: restoredCard.user_id,
            card_id: restoredCard.id,
            project_id: restoredCard.project_id ?? null,
            action: 'restored',
            title: restoredCard.title?.trim() || 'Untitled content',
            description: '콘텐츠를 복구했습니다',
            metadata: {
              status: restoredCard.status,
              scheduled_at: restoredCard.scheduled_at,
              project_id: restoredCard.project_id,
              restored_at: restoredAt,
              source: 'content_deleted_notice',
            },
          },
          supabase
        )
      } catch (activityLogError) {
        console.warn('Failed to record content restore activity log', activityLogError)
      }

      const nextScheduled = splitScheduledFields(
        restoredCard.scheduled_at ?? restoredCard.published_at ?? null
      )

      setCard(restoredCard)
      setTitleDraft(restoredCard.title)
      setScheduledDateDraft(nextScheduled.date)
      setScheduledTimeDraft(nextScheduled.time)
      setBodyDraft(restoredCard.memo ?? '')
      setMemoDraft(restoredCard.editor_memo ?? '')
      setChecklistDrafts(normalizeChecklistDrafts(restoredCard.checklist))
      setSelectedProjectId(restoredCard.project_id ?? '')
      setSaveState('idle')
      router.refresh()
    } catch (error) {
      console.error('Failed to restore content card', error)
      window.alert('콘텐츠를 복구하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setRestoring(false)
    }
  }

  const handleCreateShareLink = async () => {
    if (isPreview || !card || card.is_deleted || shareBusy) return

    setShareBusy(true)
    setShareFeedback(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('content_share_links')
        .insert({
          user_id: card.user_id,
          card_id: card.id,
          token: createShareToken(),
          is_enabled: true,
          expires_at: null,
        })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      setShareLink(data as ContentShareLink)
      setShareFeedback('공유 링크가 생성되었습니다')
    } catch (error) {
      console.error('Failed to create content share link', error)
      window.alert('공유 링크를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setShareBusy(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareFeedback('링크가 복사되었습니다')
    } catch (error) {
      console.error('Failed to copy content share link', error)
      window.alert('링크를 복사하지 못했습니다. 직접 선택해서 복사해주세요.')
    }
  }

  const handleDisableShareLink = async () => {
    if (!activeShareLink || shareBusy) return

    const confirmed = window.confirm('공유를 중지하시겠습니까? 이 링크로는 더 이상 접근할 수 없습니다.')

    if (!confirmed) return

    setShareBusy(true)
    setShareFeedback(null)

    try {
      const supabase = createClient()
      const disabledAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('content_share_links')
        .update({
          is_enabled: false,
          disabled_at: disabledAt,
        })
        .eq('id', activeShareLink.id)
        .select('*')
        .single()

      if (error) {
        throw error
      }

      setShareLink(data as ContentShareLink)
      setShareFeedback('공유가 중지되었습니다')
    } catch (error) {
      console.error('Failed to disable content share link', error)
      window.alert('공유를 중지하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setShareBusy(false)
    }
  }

  const uploadMediaFiles = async (
    files: File[],
    purpose: ContentMediaPurpose = 'attachment'
  ) => {
    const firstRejection = files
      .map((file) => validateContentMediaFile(file, purpose))
      .find((message): message is string => Boolean(message))

    if (firstRejection) {
      window.alert(firstRejection)
      return []
    }

    const uploadableFiles = files
      .map((file) => ({
        file,
        mediaType: getContentMediaTypeFromFile(file),
      }))
      .filter(
        (entry): entry is { file: File; mediaType: ContentMediaType } =>
          entry.mediaType !== null && (purpose === 'attachment' || entry.mediaType === 'image')
      )

    if (uploadableFiles.length === 0) {
      return []
    }

    if (isPreview || !card || card.is_deleted || mediaUploading) {
      return []
    }

    setMediaUploading(true)

    try {
      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        throw userError ?? new Error('Missing authenticated user')
      }

      const userId = userData.user.id
      const baseSortOrder = mediaItems.reduce(
        (maxSortOrder, item) => Math.max(maxSortOrder, item.sort_order),
        -1
      )
      const uploadedItems: MediaItem[] = []

      for (const [index, { file, mediaType }] of uploadableFiles.entries()) {
        const storagePath = createContentMediaStoragePath({
          userId,
          cardId: card.id,
          file,
          purpose,
        })
        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET_NAME)
          .upload(storagePath, file, {
            contentType: file.type || undefined,
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        const { data: insertedMedia, error: insertError } = await supabase
          .from('content_card_media')
          .insert({
            user_id: userId,
            card_id: card.id,
            storage_path: storagePath,
            file_name: file.name,
            mime_type: file.type || null,
            media_type: mediaType,
            file_size: file.size,
            sort_order: baseSortOrder + index + 1,
          })
          .select('*')
          .single()

        if (insertError) {
          await supabase.storage.from(MEDIA_BUCKET_NAME).remove([storagePath])
          throw insertError
        }

        const [signedItem] = await createSignedMediaItems(supabase, [
          insertedMedia as ContentCardMedia,
        ])
        uploadedItems.push(signedItem)
      }

      setMediaItems((prev) => sortMediaItems([...prev, ...uploadedItems]))
      return uploadedItems
    } catch (error) {
      console.error('Failed to upload content media', error)
      window.alert(MEDIA_UPLOAD_ERROR)
      return []
    } finally {
      setMediaUploading(false)
    }
  }

  const handleMediaUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])

    if (!files.length) {
      input.value = ''
      return
    }

    await uploadMediaFiles(files, 'attachment')
    input.value = ''
  }

  const handleBodyImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const imageFiles = Array.from(input.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    )

    if (!imageFiles.length) {
      input.value = ''
      return
    }

    if (!card || isPreview || card.is_deleted) {
      window.alert('\uC800\uC7A5\uB41C \uCF58\uD150\uCE20\uC5D0\uC11C\uB9CC \uC774\uBBF8\uC9C0\uB97C \uBCF8\uBB38\uC5D0 \uC0BD\uC785\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.')
      input.value = ''
      return
    }

    const uploadedItems = await uploadMediaFiles(imageFiles, 'inline')
    uploadedItems.forEach(insertMediaItemIntoBodyEditor)
    input.value = ''
  }

  const handleDeleteMedia = async (media: MediaItem) => {
    if (isPreview || mediaDeletingIds.includes(media.id)) return

    setMediaDeletingIds((prev) => [...prev, media.id])

    try {
      const supabase = createClient()
      const { error: storageError } = await supabase.storage
        .from(MEDIA_BUCKET_NAME)
        .remove([media.storage_path])

      if (storageError) {
        console.warn('Failed to remove content media object', storageError)
      }

      const { error: deleteError } = await supabase
        .from('content_card_media')
        .delete()
        .eq('id', media.id)

      if (deleteError) {
        throw deleteError
      }

      setMediaItems((prev) => prev.filter((item) => item.id !== media.id))
      if (storageError) {
        window.alert(MEDIA_STORAGE_DELETE_WARNING)
      }
    } catch (error) {
      console.error('Failed to delete content media', error)
      window.alert(MEDIA_DELETE_ERROR)
    } finally {
      setMediaDeletingIds((prev) => prev.filter((mediaId) => mediaId !== media.id))
    }
  }

  const syncBodyDraftFromEditor = () => {
    const editor = bodyEditorRef.current

    if (!editor) return

    const nextValue = serializeEditorToMarkdown(editor)
    lastEditorMarkdownRef.current = nextValue
    setBodyDraft(nextValue)
  }

  const getCurrentDraftTitle = () =>
    getContentDraftTitle(titleDraft || card?.title || DRAFT_UNTITLED_LABEL)

  const loadContentDraftRows = async () => {
    if (isPreview || !card || card.is_deleted) return

    setDraftLoading(true)
    setDraftError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('content_card_drafts')
        .select('*')
        .eq('card_id', card.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setDraftRows((data ?? []) as ContentCardDraft[])
    } catch (error) {
      console.error('Failed to load content card drafts', error)
      setDraftError(DRAFT_LIST_ERROR_MESSAGE)
    } finally {
      setDraftLoading(false)
    }
  }

  const handleOpenDraftModal = () => {
    if (isPreview || !card || card.is_deleted) return

    syncBodyDraftFromEditor()
    setDraftTitle(getCurrentDraftTitle())
    setDraftFeedback(null)
    setDraftError(null)
    setDraftModalOpen(true)
    void loadContentDraftRows()
  }

  const handleCloseDraftModal = () => {
    setDraftModalOpen(false)
    setPendingDraftLoad(null)
    setPendingDraftDelete(null)
  }

  const handleSaveContentDraft = async () => {
    if (isPreview || !card || card.is_deleted || draftSaving) return

    const nextBodyDoc = isTiptapEditorEnabled
      ? (createTiptapDocEnvelope(getTiptapDocForEditor(bodyDocDraft, bodyDraft)) as unknown as Json)
      : null
    const nextBodyDraft = isTiptapEditorEnabled
      ? getPlainTextFromTiptapDoc(getTiptapDocForEditor(nextBodyDoc, bodyDraft))
      : bodyEditorRef.current
        ? serializeEditorToMarkdown(bodyEditorRef.current)
        : bodyDraft
    lastEditorMarkdownRef.current = nextBodyDraft
    setBodyDraft(nextBodyDraft)
    if (isTiptapEditorEnabled) {
      setBodyDocDraft(nextBodyDoc)
    }
    setDraftSaving(true)
    setDraftFeedback(null)
    setDraftError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw userError ?? new Error('Missing authenticated user')
      }

      const nextChecklist = serializeChecklistDrafts(checklistDrafts)
      const nextPanelTitle = panelTitle.trim() || DEFAULT_PANEL_TITLE
      const snapshot = createContentDraftSnapshot({
        card,
        script: scriptRecord,
        title: titleDraft,
        projectId: selectedProjectId || null,
        scheduledAt: toIsoFromScheduledFields(scheduledDateDraft, scheduledTimeDraft),
        memo: nextBodyDraft,
        editorMemo: memoDraft,
        checklist: nextChecklist,
        shareSections: card.share_sections ?? [],
        scriptBody: serializeSceneDrafts(sceneDrafts),
        caption: captionDraft.trim() ? captionDraft : null,
        hashtags: hashtagsDraft.trim() ? hashtagsDraft : null,
        thumbnailText: thumbnailDraft.trim() ? thumbnailDraft : null,
        panelTitle: nextPanelTitle,
        memoDoc: nextBodyDoc,
        mediaItems,
      })
      const nextDraftTitle = getContentDraftTitle(draftTitle || titleDraft)
      const { data, error } = await supabase
        .from('content_card_drafts')
        .insert({
          user_id: user.id,
          card_id: card.id,
          title: nextDraftTitle,
          snapshot: snapshot as unknown as Json,
          source_card_updated_at: card.updated_at,
        })
        .select('*')
        .single()

      if (error) throw error

      setDraftRows((prev) =>
        [data as ContentCardDraft, ...prev].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      )
      setDraftTitle(getCurrentDraftTitle())
      setDraftFeedback(DRAFT_SAVE_SUCCESS_MESSAGE)
    } catch (error) {
      console.error('Failed to save content card draft', error)
      setDraftError(DRAFT_SAVE_ERROR_MESSAGE)
    } finally {
      setDraftSaving(false)
    }
  }

  const createFallbackMediaItem = (item: ContentDraftMediaSnapshotItem): MediaItem => ({
    id: item.id,
    user_id: card?.user_id ?? '',
    card_id: card?.id ?? cardId,
    storage_path: item.storage_path,
    file_name: item.file_name,
    mime_type: item.mime_type,
    media_type: item.media_type,
    file_size: item.file_size,
    sort_order: item.sort_order,
    created_at: '1970-01-01T00:00:00.000Z',
    signedUrl: null,
  })

  const restoreDraftMediaItems = async (snapshot: ContentDraftSnapshot) => {
    const mediaIds = getContentDraftSnapshotMediaIds(snapshot)

    if (!card || mediaIds.length === 0) return []

    const supabase = createClient()
    const { data, error } = await supabase
      .from('content_card_media')
      .select('*')
      .eq('card_id', card.id)
      .in('id', mediaIds)

    if (error) {
      console.warn('Failed to restore draft media rows', error)
      return sortMediaItems(snapshot.media.items.map(createFallbackMediaItem))
    }

    const signedItems = await createSignedMediaItems(
      supabase,
      ((data ?? []) as ContentCardMedia[]).filter((item) => mediaIds.includes(item.id))
    )
    const signedIds = new Set(signedItems.map((item) => item.id))
    const fallbackItems = snapshot.media.items
      .filter((item) => !signedIds.has(item.id))
      .map(createFallbackMediaItem)

    return sortMediaItems([...signedItems, ...fallbackItems])
  }

  const handleRequestLoadDraft = (draft: ContentCardDraft) => {
    setDraftError(null)
    setPendingDraftLoad(draft)
  }

  const handleConfirmLoadDraft = async () => {
    if (!pendingDraftLoad) return

    const draftToLoad = pendingDraftLoad
    const parsed = parseContentDraftSnapshot(draftToLoad.snapshot)

    if (!parsed.ok) {
      setDraftError(parsed.message || DRAFT_LOAD_ERROR_MESSAGE)
      setPendingDraftLoad(null)
      return
    }

    try {
      const nextMediaItems = await restoreDraftMediaItems(parsed.snapshot)
      const nextScheduled = splitScheduledFields(
        parsed.snapshot.card.scheduled_at ?? parsed.snapshot.card.published_at
      )
      const nextBodyDoc = isTiptapEditorEnabled
        ? (createTiptapDocEnvelope(
            getTiptapDocForEditor(parsed.snapshot.card.memo_doc, parsed.snapshot.card.memo)
          ) as unknown as Json)
        : null
      const nextBodyDraft = isTiptapEditorEnabled
        ? getPlainTextFromTiptapDoc(getTiptapDocForEditor(nextBodyDoc, parsed.snapshot.card.memo))
        : parsed.snapshot.card.memo
      const nextPanelTitle = parsed.snapshot.script.panel_title?.trim() || DEFAULT_PANEL_TITLE
      const nextScriptForScenes = {
        ...(scriptRecord ?? SAMPLE_SCRIPT),
        body: parsed.snapshot.script.body,
      } as Script

      setTitleDraft(parsed.snapshot.card.title)
      setScheduledDateDraft(nextScheduled.date)
      setScheduledTimeDraft(nextScheduled.time)
      setBodyDraft(nextBodyDraft)
      setBodyDocDraft(nextBodyDoc)
      if (isTiptapEditorEnabled) {
        setTiptapEditorRevision((prev) => prev + 1)
      }
      lastEditorMarkdownRef.current = nextBodyDraft
      setCaptionDraft(parsed.snapshot.script.caption ?? '')
      setHashtagsDraft(parsed.snapshot.script.hashtags ?? '')
      setThumbnailDraft(parsed.snapshot.script.thumbnail_text ?? '')
      setMemoDraft(parsed.snapshot.card.editor_memo)
      setPanelTitle(nextPanelTitle)
      setSceneDrafts(createEditableSceneDrafts(nextScriptForScenes))
      setChecklistDrafts(normalizeChecklistDrafts(parsed.snapshot.card.checklist))
      setSelectedProjectId(parsed.snapshot.card.project_id ?? '')
      setMediaItems(nextMediaItems)
      setSavedDirtyKey(`draft-loaded-${draftToLoad.id}-${Date.now()}`)
      setDraftFeedback(DRAFT_LOAD_SUCCESS_MESSAGE)
      setDraftError(null)
      setPendingDraftLoad(null)
    } catch (error) {
      console.error('Failed to load content card draft', error)
      setDraftError(DRAFT_LOAD_ERROR_MESSAGE)
      setPendingDraftLoad(null)
    }
  }

  const handleRequestDeleteDraft = (draft: ContentCardDraft) => {
    setDraftError(null)
    setPendingDraftDelete(draft)
  }

  const handleConfirmDeleteDraft = async () => {
    if (!pendingDraftDelete || draftDeletingId) return

    const draftToDelete = pendingDraftDelete

    setDraftDeletingId(draftToDelete.id)
    setDraftFeedback(null)
    setDraftError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('content_card_drafts')
        .delete()
        .eq('id', draftToDelete.id)

      if (error) throw error

      setDraftRows((prev) => prev.filter((draft) => draft.id !== draftToDelete.id))
      setDraftFeedback(DRAFT_DELETE_SUCCESS_MESSAGE)
      setPendingDraftDelete(null)
    } catch (error) {
      console.error('Failed to delete content card draft', error)
      setDraftError(DRAFT_DELETE_ERROR_MESSAGE)
    } finally {
      setDraftDeletingId(null)
    }
  }

  const storeBodyEditorSelection = () => {
    const editor = bodyEditorRef.current
    const selection = window.getSelection()

    if (!editor || !selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)

    if (!editor.contains(range.commonAncestorContainer)) return

    bodyEditorSelectionRef.current = range.cloneRange()
  }

  const restoreBodyEditorSelection = () => {
    const editor = bodyEditorRef.current
    const selection = window.getSelection()
    const range = bodyEditorSelectionRef.current

    if (!editor || !selection) return

    editor.focus()

    if (range && editor.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges()
      selection.addRange(range)
      return
    }

    const fallbackRange = editor.ownerDocument.createRange()
    fallbackRange.selectNodeContents(editor)
    fallbackRange.collapse(false)
    selection.removeAllRanges()
    selection.addRange(fallbackRange)
  }

  const ensureBodyEditorSelectionText = (
    placeholder: string,
    options: { onlyWhenEditorEmpty?: boolean } = {}
  ) => {
    const editor = bodyEditorRef.current
    const selection = window.getSelection()

    if (!editor || !selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)

    if (!range.collapsed) return
    if (options.onlyWhenEditorEmpty && serializeEditorToMarkdown(editor).trim()) return

    document.execCommand('insertText', false, placeholder)
    selectInsertedTextBeforeCaret(placeholder)
  }

  const applyBodyEditorSize = (sizeKey: RichSizeKey, placeholder: string) => {
    const editor = bodyEditorRef.current

    if (!editor) return

    restoreBodyEditorSelection()
    ensureBodyEditorSelectionText(placeholder, { onlyWhenEditorEmpty: true })

    const selection = window.getSelection()

    if (!editor || !selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)

    if (range.collapsed && serializeEditorToMarkdown(editor).trim()) {
      selectCurrentEditableBlockContents(editor)
    }

    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(
      'fontSize',
      false,
      sizeKey === 'large' ? '7' : sizeKey === 'title' ? '6' : '2'
    )

    if (sizeKey === 'muted') {
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('foreColor', false, RICH_COLOR_OPTIONS.muted.value)
    }

    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
  }

  const insertPlainTextIntoBodyEditor = (text: string) => {
    restoreBodyEditorSelection()
    document.execCommand('insertText', false, text)
    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
  }

  const insertMediaItemIntoBodyEditor = (media: MediaItem) => {
    const editor = bodyEditorRef.current

    if (media.media_type === 'file') return
    if (!editor) return

    restoreBodyEditorSelection()
    const mediaNode = createEditorMediaNode(editor.ownerDocument, media, {
      id: media.id,
      mediaType: media.media_type,
      alt: media.file_name ?? undefined,
    })

    insertHtmlAtSelection(editor, mediaNode.outerHTML)
    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
  }

  const applyBodyEditorColor = (colorKey: RichColorKey) => {
    const editor = bodyEditorRef.current

    if (!editor) return

    restoreBodyEditorSelection()
    ensureBodyEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, RICH_COLOR_OPTIONS[colorKey].value)
    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
  }

  const applyBodyEditorParagraph = () => {
    const editor = bodyEditorRef.current

    if (!editor) return

    restoreBodyEditorSelection()
    ensureBodyEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })

    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0) return

    const block = getEditableBlockForRange(editor, selection.getRangeAt(0))

    if (block) {
      unwrapPostySizeElements(block, { includeRoot: true })
    }

    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
  }

  const openBodyLinkPopover = () => {
    const editor = bodyEditorRef.current

    if (!editor) return

    restoreBodyEditorSelection()

    const selection = window.getSelection()
    const range =
      selection && selection.rangeCount > 0 && isSelectionInsideElement(editor)
        ? selection.getRangeAt(0)
        : null

    if (!range || range.collapsed || !selection?.toString().trim()) {
      bodyEditorSelectionRef.current = null
      setBodyLinkError(
        '\uB9C1\uD06C\uB97C \uC801\uC6A9\uD560 \uD14D\uC2A4\uD2B8\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.'
      )
      setBodyLinkUrlDraft('')
      setBodyLinkPopoverOpen(true)
      return
    }

    bodyEditorSelectionRef.current = range.cloneRange()
    setBodyLinkError(null)
    setBodyLinkUrlDraft('')
    setBodyLinkPopoverOpen(true)
    window.setTimeout(() => bodyLinkUrlInputRef.current?.focus(), 0)
  }

  const handleApplyBodyLink = () => {
    const editor = bodyEditorRef.current
    const href = normalizeEditorLinkUrl(bodyLinkUrlDraft)

    if (!editor) return

    if (!href) {
      setBodyLinkError('URL\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.')
      return
    }

    const range = bodyEditorSelectionRef.current

    if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
      setBodyLinkError(
        '\uB9C1\uD06C\uB97C \uC801\uC6A9\uD560 \uD14D\uC2A4\uD2B8\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.'
      )
      return
    }

    restoreBodyEditorSelection()
    document.execCommand('createLink', false, href)
    normalizeEditorLinks(editor)
    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
    setBodyLinkPopoverOpen(false)
    setBodyLinkUrlDraft('')
    setBodyLinkError(null)
  }

  const handleCancelBodyLink = () => {
    setBodyLinkPopoverOpen(false)
    setBodyLinkUrlDraft('')
    setBodyLinkError(null)
    restoreBodyEditorSelection()
  }

  const handleBodyToolbarAction = (action: MarkdownToolbarAction) => {
    const editor = bodyEditorRef.current

    if (!editor || isPreview) return

    if (action === 'media') {
      storeBodyEditorSelection()

      if (!card || card.is_deleted) {
        window.alert('\uC800\uC7A5\uB41C \uCF58\uD150\uCE20\uC5D0\uC11C\uB9CC \uC774\uBBF8\uC9C0\uB97C \uBCF8\uBB38\uC5D0 \uC0BD\uC785\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.')
        return
      }

      bodyImageUploadInputRef.current?.click()
      return
    }

    restoreBodyEditorSelection()

    if (action === 'bold') {
      ensureBodyEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
      document.execCommand('bold')
    } else if (action === 'italic') {
      ensureBodyEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
      document.execCommand('italic')
    } else if (action === 'strike') {
      ensureBodyEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
      document.execCommand('strikeThrough')
    } else if (action === 'bulletList') {
      ensureBodyEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
      document.execCommand('insertUnorderedList')
      normalizeEditorLists(editor)
    } else if (action === 'orderedList') {
      ensureBodyEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
      document.execCommand('insertOrderedList')
      normalizeEditorLists(editor)
    } else if (action === 'link') {
      openBodyLinkPopover()
      return
    } else if (action === 'hr') {
      insertHtmlAtSelection(editor, '<hr>')
    } else if (action === 'largeHeading') {
      applyBodyEditorSize('large', RICH_HEADING_PLACEHOLDER)
      return
    } else if (action === 'heading') {
      applyBodyEditorSize('title', RICH_HEADING_PLACEHOLDER)
      return
    } else if (action === 'paragraph') {
      applyBodyEditorParagraph()
      return
    } else if (action === 'small') {
      applyBodyEditorSize('small', RICH_SMALL_PLACEHOLDER)
      return
    } else if (action === 'muted') {
      applyBodyEditorSize('muted', RICH_MUTED_PLACEHOLDER)
      return
    } else if (action === 'colorInk') {
      applyBodyEditorColor('ink')
      return
    } else if (action === 'colorBody') {
      applyBodyEditorColor('body')
      return
    } else if (action === 'colorMuted') {
      applyBodyEditorColor('muted')
      return
    } else if (action === 'colorAccent') {
      applyBodyEditorColor('accent')
      return
    } else if (action === 'colorCalm') {
      applyBodyEditorColor('calm')
      return
    }

    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
  }

  const handleBodyEditorInput = (_event: FormEvent<HTMLDivElement>) => {
    syncBodyDraftFromEditor()
    storeBodyEditorSelection()
  }

  const handleBodyPaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    )

    if (files.length > 0) {
      event.preventDefault()

      if (!card || isPreview || card.is_deleted) {
        window.alert('저장된 콘텐츠에서만 이미지 붙여넣기를 사용할 수 있습니다.')
        return
      }

      const uploadedItems = await uploadMediaFiles(files, 'inline')
      uploadedItems.forEach(insertMediaItemIntoBodyEditor)
      return
    }

    const markdownTable = getMarkdownTableFromClipboard(event.clipboardData)

    if (markdownTable) {
      event.preventDefault()
      insertPlainTextIntoBodyEditor(markdownTable)
      return
    }

    const plainText = event.clipboardData.getData('text/plain')

    if (!plainText) return

    event.preventDefault()
    insertPlainTextIntoBodyEditor(plainText)
  }

  const togglePanelSection = (section: EditorSection) => {
    setExpandedSections((prev) => {
      const next = {
        ...prev,
        [section]: !prev[section],
      }

      if (card?.id && !isPreview) {
        writePanelState(card.id, next)
      }

      return next
    })
  }

  const toggleCampaignSection = (campaignId: string) => {
    setExpandedCampaignIds((prev) =>
      prev.includes(campaignId)
        ? prev.filter((expandedId) => expandedId !== campaignId)
        : [...prev, campaignId]
    )
  }

  const handleCampaignSelect = (projectId: string) => {
    setSelectedProjectId(projectId)
    setCampaignPickerOpen(false)
  }

  const renderMarkdownToolbar = () => {
    return (
      <MarkdownToolbar
        onAction={handleBodyToolbarAction}
        disabled={isPreview}
        showMediaAction
      />
    )
  }

  const renderBodyLinkPopover = () => {
    if (!bodyLinkPopoverOpen) return null

    return (
      <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-4 py-3 sm:px-6 lg:px-11">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1 text-xs font-semibold text-[var(--color-text-body)]">
            <span className="mb-1 block">{'\uB9C1\uD06C URL'}</span>
            <input
              ref={bodyLinkUrlInputRef}
              type="url"
              value={bodyLinkUrlDraft}
              onChange={(event) => {
                setBodyLinkUrlDraft(event.target.value)
                setBodyLinkError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleApplyBodyLink()
                }

                if (event.key === 'Escape') {
                  event.preventDefault()
                  handleCancelBodyLink()
                }
              }}
              placeholder="https://example.com"
              className="h-9 w-full rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-xs font-medium text-[var(--color-text-body)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)]"
            />
          </label>
          <button
            type="button"
            onClick={handleApplyBodyLink}
            className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[var(--color-accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            {'\uC800\uC7A5'}
          </button>
          <button
            type="button"
            onClick={handleCancelBodyLink}
            className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)]"
          >
            {'\uCDE8\uC18C'}
          </button>
        </div>
        {bodyLinkError && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">{bodyLinkError}</p>
        )}
      </div>
    )
  }

  const handleContinueWriting = () => {
    setLeaveModalOpen(false)
    setPendingNavigationHref(null)
  }

  const handleLeaveWithoutSave = () => {
    const nextHref = pendingNavigationHref

    setLeaveModalOpen(false)
    setPendingNavigationHref(null)

    if (!nextHref) return

    allowNavigationRef.current = true
    router.push(nextHref)
    window.setTimeout(() => {
      allowNavigationRef.current = false
    }, 1000)
  }

  const renderDraftLoadModal = () => {
    const isOlderDraft = pendingDraftLoad
      ? isContentDraftOlderThanCard(pendingDraftLoad, card?.updated_at)
      : false

    return (
      <Modal
        isOpen={Boolean(pendingDraftLoad)}
        onClose={() => setPendingDraftLoad(null)}
        title={DRAFT_LOAD_MODAL_TITLE}
        size="sm"
      >
        <div className="space-y-5">
          <div className="space-y-2 text-sm leading-6 text-[var(--color-text-body)]">
            <p>{DRAFT_LOAD_WARNING_PRIMARY}</p>
            <p>{DRAFT_LOAD_WARNING_SECONDARY}</p>
            {isOlderDraft && (
              <p className="text-sm text-gray-500">
                {DRAFT_OLD_WARNING_MESSAGE}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDraftLoad(null)}
              className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)]"
            >
              {CONTINUE_WRITING_LABEL}
            </button>
            <button
              type="button"
              onClick={handleConfirmLoadDraft}
              className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[var(--color-accent)] px-3 text-xs font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              불러오기
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  const renderDraftDeleteModal = () => (
    <Modal
      isOpen={Boolean(pendingDraftDelete)}
      onClose={() => setPendingDraftDelete(null)}
      title={DRAFT_DELETE_MODAL_TITLE}
      size="sm"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-[var(--color-text-body)]">
          {DRAFT_DELETE_WARNING_MESSAGE}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingDraftDelete(null)}
            disabled={Boolean(draftDeletingId)}
            className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteDraft}
            disabled={Boolean(draftDeletingId)}
            className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[var(--color-danger)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_86%,black)] disabled:cursor-not-allowed disabled:bg-[var(--color-border-strong)]"
          >
            삭제
          </button>
        </div>
      </div>
    </Modal>
  )

  const renderUnsavedLeaveModal = () => (
    <Modal
      isOpen={leaveModalOpen}
      onClose={handleContinueWriting}
      title={UNSAVED_LEAVE_MODAL_TITLE}
      size="sm"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-[var(--color-text-body)]">
          {UNSAVED_LEAVE_MESSAGE}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleContinueWriting}
            className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)]"
          >
            {CONTINUE_WRITING_LABEL}
          </button>
          <button
            type="button"
            onClick={handleLeaveWithoutSave}
            className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#FF385C] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#E73352]"
          >
            {LEAVE_WITHOUT_SAVE_LABEL}
          </button>
        </div>
      </div>
    </Modal>
  )

  const renderShareModal = () => {
    if (!card || card.is_deleted) return null

    return (
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="공유 링크 관리"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--color-text-body)]">
              공유 상태
            </span>
            <span
              className={clsx(
                'rounded-[4px] px-2 py-0.5 text-[11px] font-semibold',
                activeShareLink
                  ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
              )}
            >
              {activeShareLink ? '공유 중' : shareLink ? '비활성화됨' : '없음'}
            </span>
            {shareFeedback && (
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                {shareFeedback}
              </span>
            )}
          </div>

          {activeShareLink && shareUrl ? (
            <div className="space-y-3">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="h-9 w-full rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 text-xs text-[var(--color-text-body)] outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  disabled={shareBusy}
                  className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-[background-color,color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                >
                  복사
                </button>
                <button
                  type="button"
                  onClick={handleDisableShareLink}
                  disabled={shareBusy}
                  className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-danger)] transition-[background-color,color] hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                >
                  {shareBusy ? '처리 중' : '공유 중지'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                공개 확인 페이지에서 볼 수 있는 공유 링크를 생성합니다.
              </p>
              <button
                type="button"
                onClick={handleCreateShareLink}
                disabled={isPreview || shareBusy}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-[background-color,color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
              >
                <Share2 size={13} />
                {shareBusy ? '생성 중' : '공유 링크 생성'}
              </button>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  const renderMediaAttachmentSection = () => {
    if (!card || card.is_deleted) return null

    const uploadDisabled = isPreview || mediaUploading

    return (
      <div className="mb-3 max-w-[680px] pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-body)]">
            {MEDIA_SECTION_LABEL}
          </span>
          <label
            className={clsx(
              'inline-flex h-8 cursor-pointer items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-[background-color,color]',
              'hover:bg-[var(--color-bg-subtle)] focus-within:[box-shadow:var(--focus-ring)]',
              uploadDisabled && 'cursor-not-allowed text-[var(--color-text-muted)] opacity-70'
            )}
          >
            {mediaUploading ? MEDIA_UPLOADING_LABEL : MEDIA_UPLOAD_LABEL}
            <input
              type="file"
              accept={CONTENT_MEDIA_ATTACHMENT_ACCEPT}
              multiple
              disabled={uploadDisabled}
              onChange={handleMediaUpload}
              className="sr-only"
              aria-label={MEDIA_UPLOAD_LABEL}
            />
          </label>
        </div>

        {attachmentMediaItems.length > 0 ? (
          <div className="mt-3 divide-y divide-[var(--color-border-soft)] rounded-[var(--radius-md)] border border-[var(--color-border-soft)]">
            {attachmentMediaItems.map((media) => {
              const isDeleting = mediaDeletingIds.includes(media.id)
              const fileName = media.file_name?.trim() || MEDIA_UNTITLED_FILE_LABEL
              const typeLabel = getContentMediaTypeLabel(media.media_type, media.file_name)

              return (
                <div
                  key={media.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)]">
                    {media.signedUrl && media.media_type === 'image' ? (
                      <img
                        src={media.signedUrl}
                        alt={fileName}
                        className="h-full w-full object-cover"
                      />
                    ) : media.signedUrl && media.media_type === 'video' ? (
                      <video
                        src={media.signedUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText size={18} className="text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                      {fileName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                      {typeLabel} · {formatContentMediaFileSize(media.file_size)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {media.signedUrl ? (
                      media.media_type === 'file' ? (
                        <ContentMediaDownloadLink
                          url={media.signedUrl}
                          fileName={fileName}
                          className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                        >
                          <Download size={13} />
                          다운로드
                        </ContentMediaDownloadLink>
                      ) : (
                        <a
                          href={media.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={fileName}
                          className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                        >
                          <Download size={13} />
                          다운로드
                        </a>
                      )
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(media)}
                      disabled={isPreview || isDeleting}
                      className="inline-flex h-8 items-center rounded-[6px] px-3 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                      aria-label={MEDIA_DELETE_LABEL}
                    >
                      {isDeleting ? MEDIA_DELETING_LABEL : MEDIA_DELETE_LABEL}
                    </button>
                  </div>
                  {isDeleting && (
                    <div className="w-full text-[11px] font-semibold text-[var(--color-text-muted)]">
                      {MEDIA_DELETING_LABEL}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">{MEDIA_EMPTY_LABEL}</p>
        )}
      </div>
    )
  }

  const renderPanelBody = (section: EditorSection) => {
    switch (section) {
      case 'body':
        return (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted-soft)]">
              원고
            </p>
            <textarea
              value={bodyDraft}
              onChange={(event) => setBodyDraft(event.target.value)}
              rows={14}
              className="min-h-[220px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.75] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
              placeholder={EDITOR_PLACEHOLDER}
            />
          </div>
        )

      case 'scenes':
        return (
          <div className="space-y-3">
            <input
              type="text"
              value={panelTitle}
              onChange={(event) => setPanelTitle(event.target.value)}
              className="w-full border-0 bg-transparent text-[14px] font-semibold text-[var(--color-text-primary)] outline-none"
            />

            <div className="space-y-3">
              {sceneDrafts.map((scene) => (
                <div
                  key={scene.id}
                  className="overflow-hidden rounded-[7px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]"
                >
                  <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3.5 py-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted-soft)]">
                      씬 {scene.number}
                    </span>
                    <input
                      type="text"
                      value={scene.title}
                      onChange={(event) => updateSceneDraft(scene.id, 'title', event.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-semibold text-[var(--color-text-primary)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeSceneDraft(scene.id)}
                      disabled={sceneDrafts.length <= 1}
                      className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--color-text-muted-soft)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-body)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`${scene.number}번 씬 삭제`}
                    >
                      <X size={12} />
                    </button>
                    <GripVertical size={13} className="text-[var(--color-text-muted-soft)]" />
                  </div>
                  <div className="px-3.5 py-4">
                    <textarea
                      value={scene.body}
                      onChange={(event) => updateSceneDraft(scene.id, 'body', event.target.value)}
                      rows={getSceneBodyRows(scene.body)}
                      className="min-h-[112px] w-full resize-y overflow-hidden border-0 bg-transparent text-[12.5px] leading-[1.8] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
                      placeholder="씬 내용을 작성해보세요."
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSceneDraft}
              className="flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-[var(--color-border-default)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)]"
            >
              <Plus size={12} />
              씬 추가
            </button>
          </div>
        )

      case 'caption':
        return (
          <textarea
            value={captionDraft}
            onChange={(event) => setCaptionDraft(event.target.value)}
            rows={12}
            className="min-h-[240px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.75] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
            placeholder="캡션을 작성해보세요."
          />
        )

      case 'hashtags':
        return (
          <textarea
            value={hashtagsDraft}
            onChange={(event) => setHashtagsDraft(event.target.value)}
            rows={10}
            className="min-h-[220px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.75] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
            placeholder="#해시태그를 정리해보세요."
          />
        )

      case 'thumbnail':
        return (
          <textarea
            value={thumbnailDraft}
            onChange={(event) => setThumbnailDraft(event.target.value)}
            rows={8}
            className="min-h-[180px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.75] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
            placeholder="썸네일 문구를 작성해보세요."
          />
        )

      case 'checklist':
        return (
          <div className="space-y-3">
            {checklistDrafts.length > 0 ? (
              <div className="space-y-2">
                {checklistDrafts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-[7px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(event) =>
                        updateChecklistDraft(item.id, 'checked', event.target.checked)
                      }
                      className="h-4 w-4 rounded border-[var(--color-border-default)] text-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]"
                      aria-label="체크리스트 완료 여부"
                    />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(event) => updateChecklistDraft(item.id, 'text', event.target.value)}
                      className={clsx(
                        'min-w-0 flex-1 border-0 bg-transparent text-[12.5px] leading-5 outline-none placeholder:text-[var(--color-text-muted-soft)]',
                        item.checked
                          ? 'text-[var(--color-text-muted)] line-through'
                          : 'text-[var(--color-text-body)]'
                      )}
                      placeholder="체크리스트 항목을 입력해보세요."
                    />
                    <button
                      type="button"
                      onClick={() => removeChecklistDraft(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--color-text-muted-soft)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)]"
                      aria-label="체크리스트 항목 삭제"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">체크리스트 항목이 없습니다</p>
            )}

            <button
              type="button"
              onClick={addChecklistDraft}
              className="flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-[var(--color-border-default)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)]"
            >
              <Plus size={12} />
              항목 추가
            </button>
          </div>
        )

      case 'memo':
        return (
          <textarea
            value={memoDraft}
            onChange={(event) => setMemoDraft(event.target.value)}
            rows={12}
            className="min-h-[240px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.75] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
            placeholder="작업 중 참고할 메모를 적어두세요."
          />
        )
    }
  }

  const renderSidebarCardLink = (sidebarCard: SidebarContentCard) => {
    const isActive = sidebarCard.id === cardId
    const scheduledLabel = sidebarCard.scheduled_at ? formatDate(sidebarCard.scheduled_at) : null
    const channelLabel = sidebarCard.channel?.name?.trim()

    return (
      <Link
        key={sidebarCard.id}
        href={`/content/${sidebarCard.id}`}
        aria-current={isActive ? 'page' : undefined}
        className={clsx(
          'block rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
          isActive
            ? 'bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
        )}
      >
        <span className="block truncate text-xs font-semibold">{sidebarCard.title}</span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="truncate">{STATUS_LABELS[sidebarCard.status]}</span>
          {channelLabel && (
            <>
              <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--color-border-default)]" />
              <span className="truncate">{channelLabel}</span>
            </>
          )}
          {scheduledLabel && (
            <>
              <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--color-border-default)]" />
              <span className="shrink-0">{scheduledLabel}</span>
            </>
          )}
        </span>
      </Link>
    )
  }

  const renderCampaignSidebar = () => {
    const hasUncategorizedCards = uncategorizedSidebarCards.length > 0
    const isUncategorizedExpanded = expandedCampaignIds.includes(UNCATEGORIZED_GROUP_ID)
    const isUncategorizedActive = Boolean(card) && activeSidebarProjectId === null && !isPreview

    return (
      <aside className="rounded-[var(--radius-xl)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {CAMPAIGN_SECTION_TITLE}
            </p>
            <span className="text-xs text-[var(--color-text-muted)]">{projects.length}</span>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">{sidebarCards.length}</span>
        </div>

        <div className="flex flex-col gap-1">
          <Link
            href="/content"
            className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          >
            <span>{ALL_CONTENT_LABEL}</span>
            <span className="text-[var(--color-text-muted)]">{sidebarCards.length}</span>
          </Link>

          {hasUncategorizedCards && (
            <div>
              <button
                type="button"
                onClick={() => {
                  handleCampaignSelect('')
                  toggleCampaignSection(UNCATEGORIZED_GROUP_ID)
                }}
                aria-expanded={isUncategorizedExpanded}
                className={clsx(
                  'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  isUncategorizedActive
                    ? 'bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <ChevronDown
                    size={13}
                    className={clsx(
                      'shrink-0 text-[var(--color-text-muted)] transition-transform',
                      !isUncategorizedExpanded && '-rotate-90'
                    )}
                  />
                  <span className="truncate font-medium">{UNCATEGORIZED_CONTENT_LABEL}</span>
                </span>
                <span className="shrink-0 text-[var(--color-text-muted)]">
                  {uncategorizedSidebarCards.length}
                </span>
              </button>

              {isUncategorizedExpanded && (
                <div className="mt-1 space-y-1 pl-4">
                  {uncategorizedSidebarCards.map(renderSidebarCardLink)}
                </div>
              )}
            </div>
          )}

          {projects.map((project) => {
            const projectCards = sidebarCardsByProject[project.id] ?? []
            const isExpanded = expandedCampaignIds.includes(project.id)
            const isActiveProject = activeSidebarProjectId === project.id

            return (
              <div key={project.id}>
                <button
                  type="button"
                  onClick={() => {
                    handleCampaignSelect(project.id)
                    toggleCampaignSection(project.id)
                  }}
                  aria-expanded={isExpanded}
                  className={clsx(
                    'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                    isActiveProject
                      ? 'bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ChevronDown
                      size={13}
                      className={clsx(
                        'shrink-0 text-[var(--color-text-muted)] transition-transform',
                        !isExpanded && '-rotate-90'
                      )}
                    />
                    <span className="truncate font-medium">{project.title}</span>
                  </span>
                  <span className="shrink-0 text-[var(--color-text-muted)]">
                    {projectCards.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-1 space-y-1 pl-4">
                    {projectCards.length > 0 ? (
                      projectCards.map(renderSidebarCardLink)
                    ) : (
                      <p className="px-2.5 py-2 text-xs text-[var(--color-text-muted)]">
                        {EMPTY_CAMPAIGN_CONTENTS_LABEL}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    )
  }

  const renderContentLayout = (children: ReactNode, contentClassName?: string) => (
    <div className="flex h-full min-h-0 w-full items-start justify-center overflow-y-auto bg-[#F3F4F6] p-3 sm:p-4 md:p-6">
      <section
        className={clsx(
          'min-h-full w-full max-w-[1280px] min-w-0 rounded-[var(--radius-xl)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]',
          contentClassName
        )}
      >
        {children}
      </section>
    </div>
  )

  if (loading) {
    return renderContentLayout(
      <div className="flex min-h-[360px] flex-1 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>,
      'flex min-h-[360px]'
    )
  }

  if (!card) {
    return renderContentLayout(
      <div className="flex min-h-[420px] flex-1 items-center justify-center px-6">
        <div className="max-w-md rounded-[12px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-6 py-8 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            콘텐츠를 찾을 수 없습니다.
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            목록으로 돌아가거나 에디터 미리보기 화면에서 구조를 확인해보세요.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link
              href="/content"
              className="inline-flex h-9 items-center rounded-[6px] border border-[var(--color-border-default)] px-4 text-sm font-semibold text-[var(--color-text-body)]"
            >
              콘텐츠 목록
            </Link>
            <Link
              href="/content/preview"
              className="inline-flex h-9 items-center rounded-[6px] bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)]"
            >
              에디터 미리보기
            </Link>
          </div>
        </div>
      </div>,
      'flex min-h-[420px]'
    )
  }

  if (card.is_deleted) {
    const deletedTitle = card.title?.trim() || 'Untitled content'
    const projectTitle = card.project?.title?.trim()

    return renderContentLayout(
      <div className="flex min-h-[520px] flex-1 px-5 py-8 md:px-8">
        <section className="w-full max-w-2xl">
          <p className="text-xs font-semibold text-[var(--color-danger)]">삭제된 콘텐츠입니다</p>
          <h1 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {deletedTitle}
          </h1>
          <div className="mt-4 grid gap-2 border-y border-[var(--color-border-soft)] py-4 text-sm md:grid-cols-2">
            {projectTitle ? (
              <p className="text-[var(--color-text-muted)]">
                캠페인 <span className="font-medium text-[var(--color-text-body)]">{projectTitle}</span>
              </p>
            ) : null}
            <p className="text-[var(--color-text-muted)]">
              삭제일{' '}
              <time className="font-medium text-[var(--color-text-body)]">
                {formatDate(card.deleted_at, true)}
              </time>
            </p>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-body)]">
            이 콘텐츠는 휴지통에 보관되어 있습니다. 복구하기 전에는 편집하거나 저장할 수 없습니다.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDeletedCard}
              disabled={restoring}
              className="inline-flex h-9 items-center rounded-[6px] bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] transition-[background-color] hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-accent-disabled)]"
            >
              {restoring ? '복구 중...' : '복구하기'}
            </button>
            <Link
              href="/trash"
              className="inline-flex h-9 items-center rounded-[6px] border border-[var(--color-border-default)] px-4 text-sm font-semibold text-[var(--color-text-body)] transition-[background-color,color] hover:bg-[var(--color-bg-subtle)]"
            >
              휴지통으로 이동
            </Link>
            <Link
              href="/content"
              className="inline-flex h-9 items-center rounded-[6px] px-4 text-sm font-semibold text-[var(--color-text-muted)] transition-[background-color,color] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)]"
            >
              콘텐츠 목록으로 돌아가기
            </Link>
          </div>
        </section>
      </div>,
      'flex min-h-[520px]'
    )
  }

  const saveLabel =
    deleting
      ? '삭제 중...'
      : saveState === 'saving'
      ? '저장 중...'
      : saveState === 'saved'
        ? saveFeedbackLabel
        : saveState === 'error'
          ? '저장 실패'
          : isPreview
            ? '미리보기 화면에서는 저장할 수 없습니다.'
            : null

  return renderContentLayout(
    <>
      <div className="flex min-h-[620px] w-full flex-col bg-[var(--color-bg-surface)] xl:min-h-[640px] xl:flex-row">
        <div className="editor-wrap flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-bg-surface)]">
          <div className="topbar sticky top-0 z-40 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-4 py-3 sm:px-5">
            <div className="breadcrumb flex min-w-0 flex-1 basis-[220px] items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Link href="/content" className="transition-colors hover:text-[var(--color-text-body)]">
                콘텐츠
              </Link>
              <span className="text-[var(--color-border-strong)]">/</span>
              <span className="truncate font-medium text-[var(--color-text-body)]">{titleDraft}</span>
            </div>

            <div className="topbar-actions flex min-w-0 flex-1 basis-full flex-wrap items-center justify-start gap-1.5 sm:basis-auto sm:flex-none sm:justify-end">
              {saveLabel && (
                <span className="min-w-0 max-w-full text-[11px] font-medium text-[var(--color-text-muted)] sm:max-w-[220px] sm:truncate">
                  {saveLabel}
                </span>
              )}

              <button
                type="button"
                onClick={handleOpenDraftModal}
                disabled={isPreview || saveState === 'saving' || deleting || draftSaving}
                className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 text-[12px] font-semibold text-[var(--color-text-body)] transition-[background-color,color,border-color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] sm:px-3"
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={() => handlePersist('published')}
                disabled={isPreview || saveState === 'saving' || deleting}
                className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 text-[12px] font-semibold text-[var(--color-text-body)] transition-[background-color,color,border-color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] sm:px-3"
              >
                <Save size={13} className="shrink-0" />
                저장
              </button>
              <button
                type="button"
                onClick={handleSoftDelete}
                disabled={isPreview || saveState === 'saving' || deleting}
                className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 text-[12px] font-semibold text-[var(--color-danger)] transition-[background-color,color,border-color] hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
              >
                <Trash2 size={13} className="shrink-0" />
                {deleting ? '\uc0ad\uc81c \uc911' : '\uc0ad\uc81c'}
              </button>
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                disabled={isPreview || shareBusy}
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,color,border-color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]',
                  activeShareLink
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-body)]'
                )}
                aria-label="공유 링크 관리"
              >
                <Share2 size={14} />
              </button>
              <button
                type="button"
                disabled
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] disabled:opacity-100"
                aria-label="추가 준비 중"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen((prev) => !prev)}
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color,color]',
                  panelOpen
                    ? 'border-[var(--color-accent)] bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]'
                )}
                aria-label={panelOpen ? '우측 패널 닫기' : '우측 패널 열기'}
              >
                <Columns2 size={14} />
              </button>
            </div>
          </div>

          <div className="content-header shrink-0 px-4 pt-3 sm:px-6 lg:px-11">
            {card.channel && channelBadgeLabel && (
              <span
                className="hidden"
                style={{
                  backgroundColor: `${CHANNEL_COLORS[card.channel.type] ?? '#ff385c'}12`,
                  color: CHANNEL_COLORS[card.channel.type] ?? '#ff385c',
                }}
              >
                {channelBadgeLabel}
              </span>
            )}

            <div className="relative mb-2 flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-[var(--color-text-muted)]">
              <div className="relative min-w-0">
              <button
                type="button"
                aria-expanded={campaignPickerOpen}
                aria-controls="content-campaign-picker"
                onClick={() => setCampaignPickerOpen((prev) => !prev)}
                disabled={isPreview}
                className={clsx(
                  'inline-flex h-8 max-w-[260px] items-center gap-1 bg-transparent p-0 text-left text-[12px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-body)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  isPreview && 'cursor-not-allowed opacity-60 hover:text-[var(--color-text-muted)]'
                )}
              >
                <span className="min-w-0 truncate">{selectedCampaignLabel}</span>
                <ChevronDown
                  size={14}
                  className={clsx(
                    'shrink-0 transition-transform',
                    campaignPickerOpen && 'rotate-180'
                  )}
                />
              </button>

              {campaignPickerOpen && !isPreview && (
                <div
                  id="content-campaign-picker"
                  className="absolute left-0 top-full z-30 mt-1 min-w-[180px] max-w-[260px] rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] py-1 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => handleCampaignSelect('')}
                    className={clsx(
                      'flex w-full items-center px-2.5 py-2 text-left text-[12px] font-medium transition-colors hover:bg-[var(--color-bg-subtle)]',
                      selectedProjectId
                        ? 'text-[var(--color-text-muted)]'
                        : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-body)]'
                    )}
                  >
                    캠페인 없음
                  </button>
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleCampaignSelect(project.id)}
                      className={clsx(
                        'flex w-full items-center px-2.5 py-2 text-left text-[12px] font-medium transition-colors hover:bg-[var(--color-bg-subtle)]',
                        selectedProjectId === project.id
                          ? 'bg-[var(--color-bg-subtle)] text-[var(--color-text-body)]'
                          : 'text-[var(--color-text-muted)]'
                      )}
                    >
                      <span className="min-w-0 truncate">{project.title}</span>
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <p className="px-2.5 py-2 text-[12px] text-[var(--color-text-muted)]">
                      캠페인이 없습니다
                    </p>
                  )}
                </div>
              )}
            </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">
                <span className="font-semibold">업로드 날짜</span>
                <input
                  type="date"
                  value={scheduledDateDraft}
                  onChange={(event) => setScheduledDateDraft(event.target.value)}
                  disabled={isPreview}
                  aria-label="업로드 날짜"
                  className="h-8 rounded-[5px] border-0 bg-transparent px-0 text-[12px] font-medium text-[var(--color-text-body)] outline-none transition-colors hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)] focus-visible:[box-shadow:var(--focus-ring)]"
                />
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-label="업로드 시간대"
                >
                  {UPLOAD_TIME_OPTIONS.map((option) => {
                    const isSelected = selectedUploadTimeValue === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setScheduledTimeDraft(option.value)}
                        disabled={isPreview}
                        className={clsx(
                          'h-7 rounded-[5px] px-2 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]',
                          isSelected
                            ? 'bg-[var(--color-bg-subtle)] text-[var(--color-text-body)]'
                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)]'
                        )}
                        aria-pressed={isSelected}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mb-2 flex w-full min-w-0 items-center gap-2">
              <input
                type="text"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[22px] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--color-text-primary)] outline-none"
                placeholder="콘텐츠 제목"
              />
              <div className="group relative shrink-0">
                <button
                  type="button"
                  aria-describedby="content-created-date-tooltip"
                  aria-label={'\uC791\uC131\uC77C \uC815\uBCF4'}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-body)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                >
                  ?
                </button>
                <span
                  id="content-created-date-tooltip"
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden whitespace-nowrap rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)] shadow-md group-hover:block group-focus-within:block"
                >
                  {'\uC791\uC131\uC77C '}{createdDateLabel}
                </span>
              </div>
            </div>

            {isPreview && (
              <p className="mb-4 text-xs text-[var(--color-text-muted)]">
                미리보기 화면에서는 저장할 수 없습니다.
              </p>
            )}

            {!isPreview && (
              <div className="hidden">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-body)]">
                    공유 링크
                  </span>
                  <span
                    className={clsx(
                      'rounded-[4px] px-2 py-0.5 text-[11px] font-semibold',
                      activeShareLink
                        ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)]'
                        : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                    )}
                  >
                    {activeShareLink ? '공유 중' : shareLink ? '비활성화됨' : '없음'}
                  </span>
                  {shareFeedback && (
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                      {shareFeedback}
                    </span>
                  )}
                </div>

                {activeShareLink && shareUrl ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="h-9 min-w-0 flex-1 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 text-xs text-[var(--color-text-body)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      disabled={shareBusy}
                      className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-[background-color,color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                    >
                      복사
                    </button>
                    <button
                      type="button"
                      onClick={handleDisableShareLink}
                      disabled={shareBusy}
                      className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-danger)] transition-[background-color,color] hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                    >
                      {shareBusy ? '처리 중' : '공유 중지'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreateShareLink}
                      disabled={shareBusy}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-[background-color,color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                    >
                      <Share2 size={13} />
                      {shareBusy ? '생성 중' : '공유 링크 생성'}
                    </button>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      공개 확인 페이지는 후속 작업에서 연결됩니다.
                    </span>
                  </div>
                )}
              </div>
            )}

            {renderMediaAttachmentSection()}
          </div>

          {isTiptapEditorEnabled ? (
            <div className="flex flex-col gap-3">
              <PostyTiptapEditor
                key={`${card.id}:${tiptapEditorRevision}`}
                value={bodyTiptapDoc}
                onChange={(nextEnvelope, plainText) => {
                  setBodyDocDraft(nextEnvelope as unknown as Json)
                  setBodyDraft(plainText)
                }}
                disabled={isPreview}
                placeholder={EDITOR_PLACEHOLDER}
                inlineMediaItems={tiptapInlineMediaItems}
                onUploadInlineImages={async (files) => {
                  const uploadedItems = await uploadMediaFiles(files, 'inline')

                  return uploadedItems.map((item) => ({
                    id: item.id,
                    signedUrl: item.signedUrl,
                    fileName: item.file_name?.trim() || MEDIA_UNTITLED_FILE_LABEL,
                  }))
                }}
                uploadDisabled={isPreview || mediaUploading || !card || Boolean(card?.is_deleted)}
              />
            </div>
          ) : (
            <RichTextEditor
              ref={bodyEditorApiRef}
              value={bodyDraft}
              onChange={setBodyDraft}
              mediaItems={mediaItems}
              disabled={isPreview}
              placeholder={EDITOR_PLACEHOLDER}
              onUploadMedia={(files) => uploadMediaFiles(files, 'inline')}
              uploadDisabled={isPreview || mediaUploading || !card || Boolean(card?.is_deleted)}
            />
          )}
        </div>

        {panelOpen && (
          <aside className="right-panel flex w-full shrink-0 flex-col overflow-hidden border-t border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] xl:w-[400px] xl:self-stretch xl:border-l xl:border-t-0">
            <div className="rp-head flex items-center gap-[5px] border-b border-[var(--color-border-soft)] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate px-1 text-[13px] font-semibold text-[var(--color-text-primary)]">
                  편집 패널
                </p>
              </div>

              <button
                type="button"
                disabled
                className="flex h-[27px] w-[27px] items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] disabled:opacity-100"
                aria-label="패널 공유 준비 중"
              >
                <Share2 size={13} />
              </button>
              <button
                type="button"
                disabled
                className="flex h-[27px] w-[27px] items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] disabled:opacity-100"
                aria-label="패널 추가 준비 중"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex h-[27px] w-[27px] items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"
                aria-label="우측 패널 닫기"
              >
                <X size={13} />
              </button>
            </div>

            <div className="rp-body flex-1 overflow-y-auto">
              {SECTION_ITEMS.map((item) => {
                const isExpanded = expandedSections[item.value]

                return (
                  <section
                    key={item.value}
                    className="border-b border-[var(--color-border-soft)] last:border-b-0"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => togglePanelSection(item.value)}
                      className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                    >
                      <ChevronDown
                        size={13}
                        className={clsx(
                          'shrink-0 text-[var(--color-text-muted)] transition-transform',
                          !isExpanded && '-rotate-90'
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                        {item.label}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-4">
                        {renderPanelBody(item.value)}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          </aside>
        )}
      </div>
      <ContentDraftModal
        isOpen={draftModalOpen}
        onClose={handleCloseDraftModal}
        title={draftTitle}
        onTitleChange={setDraftTitle}
        drafts={draftRows}
        loading={draftLoading}
        saving={draftSaving}
        deletingId={draftDeletingId}
        feedback={draftFeedback}
        error={draftError}
        onSave={handleSaveContentDraft}
        onLoad={handleRequestLoadDraft}
        onDelete={handleRequestDeleteDraft}
      />
      {renderDraftLoadModal()}
      {renderDraftDeleteModal()}
      {renderShareModal()}
      {renderUnsavedLeaveModal()}
    </>,
    'flex min-h-[640px]'
  )
}
