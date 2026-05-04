'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  CheckSquare,
  ChevronDown,
  Columns2,
  GripVertical,
  Plus,
  Share2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { CHANNEL_COLORS, STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { ChecklistItem, ContentCard, Script } from '@/lib/types'

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

const PREVIEW_IDS = new Set(['preview', 'demo'])
const DEFAULT_PANEL_TITLE = '대본'
const EDITOR_PLACEHOLDER = '원고를 작성해보세요...'
const EMPTY_SECTION_MESSAGE = '아직 입력된 내용이 없습니다.'

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
  memo: '후킹 문장은 더 짧게 다듬고, 마지막 CTA는 저장 유도형으로 정리합니다.',
  reference_url: 'https://example.com/reference',
  checklist: [
    { id: 'check-1', text: '후킹 문장 확정', done: true },
    { id: 'check-2', text: '썸네일 문구 검토', done: false },
    { id: 'check-3', text: '캡션과 해시태그 정리', done: false },
  ],
  idea_id: null,
  created_at: '2026-05-04T10:00:00+09:00',
  updated_at: '2026-05-04T14:43:00+09:00',
  channel: {
    id: 'preview-channel',
    user_id: 'preview-user',
    name: '인스타그램 릴스',
    type: 'instagram',
    color: CHANNEL_COLORS.instagram,
    created_at: '2026-05-04T10:00:00+09:00',
  },
}

const SAMPLE_SCRIPT: Script = {
  id: 'preview-script',
  user_id: 'preview-user',
  card_id: 'preview',
  title: '인스타 릴스 0504 원고',
  body: `요즘 들어 아침마다 더 피곤한 느낌이 있죠.

물 한 잔을 마시면서 오늘 꼭 해야 할 일 세 가지만 정리해 보세요.

해야 할 것, 하면 좋은 것, 하지 않을 것을 먼저 나누면 하루가 훨씬 선명해집니다.

지금 메모장에 세 줄만 적어도 오늘의 집중력이 달라질 수 있어요.`,
  caption:
    '오늘 해야 할 일을 다 적으려 하지 말고, 꼭 끝낼 세 가지만 남겨보세요. 하루의 밀도가 달라집니다.',
  hashtags: '#생산성 #업무관리 #콘텐츠기획 #릴스아이디어',
  cta: '저장해두고 내일 아침에도 다시 꺼내보세요.',
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

function createPreviewState() {
  return {
    card: SAMPLE_CARD,
    script: SAMPLE_SCRIPT,
  }
}

export function ContentEditorShell({ cardId }: ContentEditorShellProps) {
  const [card, setCard] = useState<ContentCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<EditorSection>('scenes')
  const [bodyDraft, setBodyDraft] = useState('')
  const [captionDraft, setCaptionDraft] = useState('')
  const [hashtagsDraft, setHashtagsDraft] = useState('')
  const [thumbnailDraft, setThumbnailDraft] = useState('')
  const [memoDraft, setMemoDraft] = useState('')
  const [panelTitle, setPanelTitle] = useState(DEFAULT_PANEL_TITLE)
  const [sceneDrafts, setSceneDrafts] = useState<SceneDraft[]>(createSceneDrafts(SAMPLE_SCRIPT))

  const isPreview = PREVIEW_IDS.has(cardId)
  const activeSectionLabel =
    useMemo(
      () => SECTION_ITEMS.find((item) => item.value === activeSection)?.label ?? DEFAULT_PANEL_TITLE,
      [activeSection]
    )

  useEffect(() => {
    let cancelled = false

    const applyState = (nextCard: ContentCard | null, nextScript: Script | null) => {
      if (cancelled) return

      setCard(nextCard)
      setBodyDraft(nextScript?.body ?? '')
      setCaptionDraft(nextScript?.caption ?? '')
      setHashtagsDraft(nextScript?.hashtags ?? '')
      setThumbnailDraft(nextScript?.thumbnail_text ?? '')
      setMemoDraft(nextCard?.memo ?? '')
      setPanelTitle(nextScript?.panel_title?.trim() || DEFAULT_PANEL_TITLE)
      setSceneDrafts(createSceneDrafts(nextScript))
      setLoading(false)
    }

    const fetchDetail = async () => {
      setLoading(true)

      if (isPreview) {
        const preview = createPreviewState()
        applyState(preview.card, preview.script)
        return
      }

      const supabase = createClient()
      const [{ data: cardData, error: cardError }, { data: scriptData, error: scriptError }] =
        await Promise.all([
          supabase
            .from('content_cards')
            .select('*, channel:channels(*)')
            .eq('id', cardId)
            .maybeSingle(),
          supabase.from('scripts').select('*').eq('card_id', cardId).maybeSingle(),
        ])

      if (cardError) {
        console.error('Failed to fetch content card', cardError)
      }

      if (scriptError) {
        console.error('Failed to fetch script', scriptError)
      }

      applyState((cardData as ContentCard | null) ?? null, (scriptData as Script | null) ?? null)
    }

    fetchDetail()

    return () => {
      cancelled = true
    }
  }, [cardId, isPreview])

  const checklistItems: ChecklistItem[] = card?.checklist ?? []

  const updateSceneDraft = (sceneId: string, key: 'title' | 'body', value: string) => {
    setSceneDrafts((prev) =>
      prev.map((scene) => (scene.id === sceneId ? { ...scene, [key]: value } : scene))
    )
  }

  const renderPanelBody = () => {
    switch (activeSection) {
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
                  <div className="flex items-center gap-2 border-b border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted-soft)]">
                      씬 {scene.number}
                    </span>
                    <input
                      type="text"
                      value={scene.title}
                      onChange={(event) => updateSceneDraft(scene.id, 'title', event.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] font-semibold text-[var(--color-text-primary)] outline-none"
                    />
                    <GripVertical size={13} className="text-[var(--color-text-muted-soft)]" />
                  </div>
                  <div className="px-3 py-3">
                    <textarea
                      value={scene.body}
                      onChange={(event) => updateSceneDraft(scene.id, 'body', event.target.value)}
                      rows={3}
                      className="min-h-[72px] w-full resize-none border-0 bg-transparent text-[12px] leading-[1.7] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
                      placeholder="씬 내용을 작성해보세요."
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-[var(--color-border-default)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-muted)] disabled:opacity-100"
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
        return checklistItems.length > 0 ? (
          <div className="space-y-2">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 rounded-[7px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-3 py-2.5"
              >
                <CheckSquare
                  size={14}
                  className={clsx(
                    'mt-0.5 shrink-0',
                    item.done ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted-soft)]'
                  )}
                />
                <span
                  className={clsx(
                    'text-[12.5px] leading-5',
                    item.done
                      ? 'text-[var(--color-text-muted)] line-through'
                      : 'text-[var(--color-text-body)]'
                  )}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">{EMPTY_SECTION_MESSAGE}</p>
        )

      case 'memo':
        return (
          <textarea
            value={memoDraft}
            onChange={(event) => setMemoDraft(event.target.value)}
            rows={12}
            className="min-h-[240px] w-full resize-none border-0 bg-transparent text-[13px] leading-[1.75] text-[var(--color-text-body)] outline-none placeholder:text-[var(--color-text-muted-soft)]"
            placeholder="메모를 적어보세요."
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
            목록으로 돌아가거나 에디터 미리보기 화면을 열어 구조를 확인해보세요.
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

  const scheduledAt = card.scheduled_at ?? card.published_at ?? null

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
              <span className="truncate font-medium text-[var(--color-text-body)]">{card.title}</span>
            </div>

            <div className="topbar-actions flex items-center gap-1">
              <button
                type="button"
                disabled
                className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] disabled:opacity-100"
                aria-label="공유 준비 중"
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
            {card.channel && (
              <span
                className="mb-3 inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: `${CHANNEL_COLORS[card.channel.type] ?? '#ff385c'}12`,
                  color: CHANNEL_COLORS[card.channel.type] ?? '#ff385c',
                }}
              >
                {card.channel.name}
              </span>
            )}

            <h1 className="mb-3 text-[24px] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--color-text-primary)]">
              {card.title}
            </h1>

            <div className="mb-4 grid w-fit grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <span className="text-xs text-[var(--color-text-muted-soft)]">상태</span>
              <span className="text-xs text-[var(--color-text-body)]">
                <span
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ backgroundColor: STATUS_COLORS[card.status] }}
                />
                <span className="font-semibold">{STATUS_LABELS[card.status]}</span>
              </span>

              <span className="text-xs text-[var(--color-text-muted-soft)]">작성일</span>
              <span className="text-xs text-[var(--color-text-body)]">{formatDate(card.created_at)}</span>

              <span className="text-xs text-[var(--color-text-muted-soft)]">마지막 수정</span>
              <span className="text-xs text-[var(--color-text-body)]">
                {formatDate(card.updated_at, true)}
              </span>

              <span className="text-xs text-[var(--color-text-muted-soft)]">업로드 예정일</span>
              <span className="text-xs text-[var(--color-text-body)]">{formatDate(scheduledAt)}</span>
            </div>
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
              {['왼쪽', '가운데', '오른쪽', '목록', '번호'].map((label) => (
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
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setSectionMenuOpen((prev) => !prev)}
                  className="flex w-full items-center gap-1.5 rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-left"
                >
                  <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {activeSectionLabel}
                  </span>
                  <ChevronDown
                    size={12}
                    className="ml-auto shrink-0 text-[var(--color-text-muted)]"
                  />
                </button>

                {sectionMenuOpen && (
                  <div className="absolute left-0 top-9 z-20 min-w-[150px] rounded-[7px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1 shadow-[var(--shadow-lg)]">
                    {SECTION_ITEMS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setActiveSection(item.value)
                          setSectionMenuOpen(false)
                        }}
                        className={clsx(
                          'flex w-full items-center rounded-[4px] px-3 py-1.5 text-left text-[12.5px]',
                          activeSection === item.value
                            ? 'bg-[var(--color-bg-accent-soft)] font-semibold text-[var(--color-accent)]'
                            : 'text-[var(--color-text-body)] hover:bg-[var(--color-bg-subtle)]'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
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

            <div className="rp-body flex-1 overflow-y-auto px-3 py-3">{renderPanelBody()}</div>
          </aside>
        )}
      </div>
    </div>
  )
}
