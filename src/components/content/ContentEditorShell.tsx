'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Columns2,
  GripVertical,
  Plus,
  Save,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { CHANNEL_COLORS } from '@/lib/constants'
import { recordContentActivityLog } from '@/lib/content-activity-logs'
import { createClient } from '@/lib/supabase/client'
import type {
  ChecklistItem,
  ContentActivityAction,
  ContentCard,
  ContentProjectSummary,
  ContentShareLink,
  Script,
} from '@/lib/types'

interface ContentEditorShellProps {
  cardId: string
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
type PersistedSceneDraft = Pick<SceneDraft, 'id' | 'number' | 'title' | 'body'>
type PersistedChecklistDraft = Partial<ChecklistItem> & {
  checked?: boolean
}

const PREVIEW_IDS = new Set(['preview', 'demo'])
const DEFAULT_PANEL_TITLE = '대본'
const EDITOR_PLACEHOLDER = '원고를 작성해보세요...'
const EMPTY_SECTION_MESSAGE = '아직 입력된 내용이 없습니다.'
const NO_CAMPAIGN_LABEL = '캠페인 없음'
const SECTION_ITEMS: Array<{ value: EditorSection; label: string }> = [
  { value: 'body', label: '원고' },
  { value: 'scenes', label: '대본' },
  { value: 'caption', label: '캡션' },
  { value: 'hashtags', label: '해시태그' },
  { value: 'thumbnail', label: '썸네일 문구' },
  { value: 'checklist', label: '체크리스트' },
  { value: 'memo', label: '메모' },
]

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
  const minutes = `${date.getMinutes()}`.padStart(2, '0')

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  }
}

function toIsoFromScheduledFields(dateValue: string, timeValue: string) {
  if (!dateValue) return null

  const normalizedTime = timeValue || '00:00'
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

export function ContentEditorShell({ cardId }: ContentEditorShellProps) {
  const router = useRouter()
  const [card, setCard] = useState<ContentCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<EditorSection, boolean>>({
    body: true,
    scenes: true,
    caption: false,
    hashtags: false,
    thumbnail: false,
    checklist: false,
    memo: false,
  })
  const [titleDraft, setTitleDraft] = useState('')
  const [scheduledDateDraft, setScheduledDateDraft] = useState('')
  const [scheduledTimeDraft, setScheduledTimeDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
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
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [scriptRecord, setScriptRecord] = useState<Script | null>(null)
  const [shareLink, setShareLink] = useState<ContentShareLink | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  const isPreview = PREVIEW_IDS.has(cardId)

  const campaignOptions = useMemo(() => {
    if (!card?.project) return projects

    return projects.some((project) => project.id === card.project?.id)
      ? projects
      : [card.project, ...projects]
  }, [card?.project, projects])
  const activeShareLink = shareLink?.is_enabled ? shareLink : null
  const shareUrl = shareLink
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/content/${shareLink.token}`
    : null

  useEffect(() => {
    if (saveState !== 'saved') return

    const timer = window.setTimeout(() => {
      setSaveState('idle')
      setSaveFeedbackLabel(null)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [saveState])

  useEffect(() => {
    if (!shareFeedback) return

    const timer = window.setTimeout(() => {
      setShareFeedback(null)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [shareFeedback])

  useEffect(() => {
    let cancelled = false

    const applyState = (nextCard: ContentCard | null, nextScript: Script | null) => {
      if (cancelled) return

      const nextScheduled = splitScheduledFields(
        nextCard?.scheduled_at ?? nextCard?.published_at ?? null
      )

      setCard(nextCard)
      setScriptRecord(nextScript)
      setTitleDraft(nextCard?.title ?? '')
      setScheduledDateDraft(nextScheduled.date)
      setScheduledTimeDraft(nextScheduled.time)
      setBodyDraft(nextCard?.memo ?? '')
      setCaptionDraft(nextScript?.caption ?? '')
      setHashtagsDraft(nextScript?.hashtags ?? '')
      setThumbnailDraft(nextScript?.thumbnail_text ?? '')
      setMemoDraft(nextCard?.editor_memo ?? '')
      setPanelTitle(nextScript?.panel_title?.trim() || DEFAULT_PANEL_TITLE)
      setSceneDrafts(createEditableSceneDrafts(nextScript))
      setChecklistDrafts(normalizeChecklistDrafts(nextCard?.checklist))
      setSelectedProjectId(nextCard?.project_id ?? '')
      setSaveState('idle')
      setSaveFeedbackLabel(null)
      setLoading(false)
    }

    const fetchDetail = async () => {
      setLoading(true)

      if (isPreview) {
        setProjects([])
        setShareLink(null)
        applyState(SAMPLE_CARD, SAMPLE_SCRIPT)
        return
      }

      const supabase = createClient()
      const [
        { data: cardData, error: cardError },
        { data: scriptData, error: scriptError },
        { data: projectData, error: projectError },
        { data: shareLinkData, error: shareLinkError },
      ] = await Promise.all([
        supabase
          .from('content_cards')
          .select('*, channel:channels(*), project:content_projects(id,title)')
          .eq('id', cardId)
          .maybeSingle(),
        supabase.from('scripts').select('*').eq('card_id', cardId).maybeSingle(),
        supabase.from('content_projects').select('id, title').order('created_at', { ascending: false }),
        supabase
          .from('content_share_links')
          .select('*')
          .eq('card_id', cardId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
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

      if (shareLinkError) {
        console.error('Failed to fetch content share link', shareLinkError)
      }

      setProjects((projectData as ContentProjectSummary[] | null) ?? [])
      setShareLink((shareLinkData as ContentShareLink | null) ?? null)
      applyState((cardData as ContentCard | null) ?? null, (scriptData as Script | null) ?? null)
    }

    fetchDetail()

    return () => {
      cancelled = true
    }
  }, [cardId, isPreview])

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
      const payload = {
        /*
        title: titleDraft.trim() || '새 콘텐츠',
        */
        title: titleDraft.trim() || 'Untitled content',
        status: nextStatus,
        scheduled_at: toIsoFromScheduledFields(scheduledDateDraft, scheduledTimeDraft),
        memo: bodyDraft.trim() ? bodyDraft : null,
        editor_memo: memoDraft.trim() ? memoDraft : null,
        checklist: nextChecklist,
        project_id: selectedProjectId || null,
      }

      const { data, error } = await supabase
        .from('content_cards')
        .update(payload)
        .eq('id', card.id)
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
      setTitleDraft(nextCard.title)
      setScheduledDateDraft(nextScheduled.date)
      setScheduledTimeDraft(nextScheduled.time)
      setBodyDraft(nextCard.memo ?? '')
      setCaptionDraft(nextScript.caption ?? '')
      setHashtagsDraft(nextScript.hashtags ?? '')
      setThumbnailDraft(nextScript.thumbnail_text ?? '')
      setMemoDraft(nextCard.editor_memo ?? '')
      setPanelTitle(nextScript.panel_title?.trim() || DEFAULT_PANEL_TITLE)
      setSceneDrafts(createEditableSceneDrafts(nextScript))
      setChecklistDrafts(normalizeChecklistDrafts(nextCard.checklist))
      setSelectedProjectId(nextCard.project_id ?? '')
      setSaveFeedbackLabel(
        nextStatus === 'writing' ? '임시저장되었습니다' : '저장되었습니다'
      )
      setSaveState('saved')
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      router.push('/content')
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

  const togglePanelSection = (section: EditorSection) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
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

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--color-bg-subtle)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-[var(--color-bg-subtle)] px-6">
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
      </div>
    )
  }

  if (card.is_deleted) {
    const deletedTitle = card.title?.trim() || 'Untitled content'
    const projectTitle = card.project?.title?.trim()

    return (
      <div className="flex min-h-full flex-1 bg-[var(--color-bg-surface)] px-5 py-8 md:px-8">
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
      </div>
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

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-[var(--color-bg-surface)]">
      <div className="flex min-w-0 flex-1 overflow-hidden bg-[var(--color-bg-surface)]">
        <div className="editor-wrap flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg-surface)]">
          <div className="topbar flex items-center justify-between border-b border-[var(--color-border-soft)] px-5 py-3">
            <div className="breadcrumb flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Link href="/content" className="transition-colors hover:text-[var(--color-text-body)]">
                콘텐츠
              </Link>
              <span className="text-[var(--color-border-strong)]">/</span>
              <span className="truncate font-medium text-[var(--color-text-body)]">{titleDraft}</span>
            </div>

            <div className="topbar-actions flex items-center gap-1.5">
              {saveLabel && (
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                  {saveLabel}
                </span>
              )}

              <button
                type="button"
                onClick={() => handlePersist('writing')}
                disabled={isPreview || saveState === 'saving' || deleting}
                className="inline-flex h-7 items-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-[12px] font-semibold text-[var(--color-text-body)] transition-[background-color,color,border-color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={() => handlePersist('published')}
                disabled={isPreview || saveState === 'saving' || deleting}
                className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-[12px] font-semibold text-[var(--color-text-body)] transition-[background-color,color,border-color] hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
              >
                <Save size={13} />
                저장
              </button>
              <button
                type="button"
                onClick={handleSoftDelete}
                disabled={isPreview || saveState === 'saving' || deleting}
                className="inline-flex h-7 items-center gap-1 rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 text-[12px] font-semibold text-[var(--color-danger)] transition-[background-color,color,border-color] hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
              >
                <Trash2 size={13} />
                {deleting ? '\uc0ad\uc81c \uc911' : '\uc0ad\uc81c'}
              </button>
              <button
                type="button"
                onClick={activeShareLink ? handleCopyShareLink : handleCreateShareLink}
                disabled={isPreview || shareBusy}
                className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-[background-color,color,border-color] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                aria-label={activeShareLink ? '공유 링크 복사' : '공유 링크 생성'}
              >
                <Share2 size={14} />
              </button>
              <button
                type="button"
                disabled
                className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] disabled:opacity-100"
                aria-label="추가 준비 중"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen((prev) => !prev)}
                className={clsx(
                  'flex h-7 w-7 items-center justify-center rounded-[5px] border transition-[background-color,border-color,color]',
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

          <div className="content-header shrink-0 px-11 pt-5">
            {card.channel && channelBadgeLabel && (
              <span
                className="mb-3 inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: `${CHANNEL_COLORS[card.channel.type] ?? '#ff385c'}12`,
                  color: CHANNEL_COLORS[card.channel.type] ?? '#ff385c',
                }}
              >
                {channelBadgeLabel}
              </span>
            )}

            <input
              type="text"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              className="mb-3 w-full max-w-[720px] border-0 bg-transparent p-0 text-[24px] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--color-text-primary)] outline-none"
              placeholder="콘텐츠 제목"
            />

            <div className="mb-4 grid w-full max-w-[680px] grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <span className="pt-2 text-xs text-[var(--color-text-muted-soft)]">작성일</span>
              <span className="flex h-9 items-center text-xs text-[var(--color-text-body)]">
                {formatDate(card.created_at)}
              </span>

              <span className="pt-2 text-xs text-[var(--color-text-muted-soft)]">마지막 수정</span>
              <span className="flex h-9 items-center text-xs text-[var(--color-text-body)]">
                {formatDate(card.updated_at, true)}
              </span>

              <span className="pt-2 text-xs text-[var(--color-text-muted-soft)]">캠페인</span>
              <div className="flex flex-col gap-1">
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  disabled={isPreview || saveState === 'saving'}
                  className="h-9 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-body)] outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                >
                  <option value="">{NO_CAMPAIGN_LABEL}</option>
                  {campaignOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>

              <span className="pt-2 text-xs text-[var(--color-text-muted-soft)]">업로드 예정일</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  value={scheduledDateDraft}
                  onChange={(event) => setScheduledDateDraft(event.target.value)}
                  className="h-9 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-body)] outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                />
                <input
                  type="time"
                  value={scheduledTimeDraft}
                  onChange={(event) => setScheduledTimeDraft(event.target.value)}
                  className="h-9 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-body)] outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                />
              </div>
            </div>

            {isPreview && (
              <p className="mb-4 text-xs text-[var(--color-text-muted)]">
                미리보기 화면에서는 저장할 수 없습니다.
              </p>
            )}

            {!isPreview && (
              <div className="mb-4 max-w-[680px] border-t border-[var(--color-border-soft)] pt-3">
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
          </div>

          <div className="toolbar-wrap shrink-0 border-y border-[var(--color-border-soft)] px-11">
            <div className="toolbar flex h-9 items-center gap-1 overflow-x-auto">
              <div className="flex items-center gap-2 pr-1">
                <span className="min-w-[28px] text-center text-xs font-medium text-[var(--color-text-body)]">
                  14px
                </span>
              </div>
              <span className="mx-1 h-4 w-px bg-[var(--color-border-soft)]" />
              {['B', 'I', 'U', 'S'].map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-[4px] text-[13px] text-[var(--color-text-secondary)] disabled:opacity-100',
                    label === 'B' && 'font-bold text-[var(--color-text-body)]',
                    label === 'I' && 'italic text-[var(--color-text-body)]',
                    label === 'U' && 'underline text-[var(--color-text-body)]',
                    label === 'S' && 'line-through text-[var(--color-text-body)]'
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--color-border-soft)]" />
              {['좌측', '가운데', '오른쪽', '목록', '번호'].map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className="rounded-[4px] px-2 py-1 text-xs text-[var(--color-text-secondary)] disabled:opacity-100"
                >
                  {label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--color-border-soft)]" />
              <button
                type="button"
                disabled
                className="rounded-[4px] px-2 py-1 text-xs text-[var(--color-text-secondary)] disabled:opacity-100"
              >
                링크
              </button>
              <button
                type="button"
                disabled
                className="rounded-[4px] px-2 py-1 text-xs text-[var(--color-text-secondary)] disabled:opacity-100"
              >
                구분선
              </button>
            </div>
          </div>

          <div className="editor-body-wrap flex-1 overflow-y-auto px-11 py-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted-soft)]">
              원고
            </div>
            <textarea
              value={bodyDraft}
              onChange={(event) => setBodyDraft(event.target.value)}
              rows={16}
              className="min-h-[320px] w-full max-w-[620px] resize-none border-0 bg-transparent text-[14.5px] leading-[1.85] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
              placeholder={EDITOR_PLACEHOLDER}
            />
          </div>
        </div>

        {panelOpen && (
          <aside className="right-panel flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] xl:w-[340px]">
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

            <div className="rp-body flex-1 overflow-y-auto px-3">
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
                      className="flex w-full items-center gap-2 py-3 text-left transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
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
                      <div className="pb-4">
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
    </div>
  )
}
