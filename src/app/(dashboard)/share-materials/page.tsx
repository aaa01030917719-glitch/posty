'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, FileText, Plus, Save, Share2, Trash2, Upload } from 'lucide-react'
import { clsx } from 'clsx'
import { createContentCard } from '@/components/content/createContentCard'
import {
  RichTextEditor,
  type RichTextEditorMediaItem,
} from '@/components/content/RichTextEditor'
import { MarkdownToolbar, type MarkdownToolbarAction } from '@/components/content/MarkdownToolbar'
import { ContentMediaDownloadLink } from '@/components/content/ContentMediaDownloadLink'
import {
  createSignedMediaItems,
  CONTENT_MEDIA_ATTACHMENT_ACCEPT,
  MEDIA_BUCKET_NAME,
  sortMediaItems,
  uploadContentCardMediaFiles,
} from '@/components/content/contentMedia'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { isAttachmentContentMedia } from '@/lib/content-media-purpose'
import {
  formatContentMediaFileSize,
  getContentMediaTypeLabel,
} from '@/lib/content-media-files'
import { createClient } from '@/lib/supabase/client'
import type { ContentCardMedia, ContentShareLink, Database, ShareSection } from '@/lib/types'

type ShareMaterialCard = {
  id: string
  title: string
  share_sections: ShareSection[] | null
  is_deleted: boolean
  updated_at: string
}

type ShareMaterialLink = ContentShareLink & {
  card: ShareMaterialCard | null
}

type ShareSectionDraft = ShareSection

type ContentCardUpdate = Database['public']['Tables']['content_cards']['Update']

const PAGE_TITLE = '공유 자료'
const PAGE_DESCRIPTION = '릴스 댓글, DM, 상담 답변에 보낼 정보성 자료 링크를 관리합니다.'
const NEW_MATERIAL_TITLE = '새 공유 자료'
const UNTITLED_MATERIAL_TITLE = '제목 없는 공유 자료'
const EMPTY_MESSAGE = '아직 공유 자료가 없습니다.'
const CREATE_ERROR = '공유 자료를 만들지 못했습니다. 잠시 후 다시 시도해주세요.'
const SAVE_ERROR = '공유 자료를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'
const DISABLE_ERROR = '공유를 중지하지 못했습니다. 잠시 후 다시 시도해주세요.'
const COPY_ERROR = '링크를 복사하지 못했습니다. 직접 선택해서 복사해주세요.'

const ATTACHMENT_SECTION_LABEL = '첨부파일'
const ATTACHMENT_UPLOAD_LABEL = '파일 첨부'
const ATTACHMENT_UPLOADING_LABEL = '업로드 중...'
const ATTACHMENT_EMPTY_LABEL = '첨부된 파일이 없습니다'
const ATTACHMENT_OPEN_LABEL = '열기'
const ATTACHMENT_DELETE_LABEL = '삭제'
const ATTACHMENT_DELETING_LABEL = '삭제 중'
const ATTACHMENT_UPLOAD_ERROR =
  '첨부파일을 업로드하지 못했습니다. 파일 형식과 크기를 확인한 뒤 다시 시도해주세요.'
const ATTACHMENT_DELETE_ERROR =
  '첨부파일을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.'
const ATTACHMENT_DELETE_CONFIRM = '선택한 첨부파일을 삭제하시겠습니까?'
const ATTACHMENT_STORAGE_DELETE_WARNING =
  '첨부 목록에서는 제거했지만 저장소 파일 정리에 실패했습니다.'

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

function normalizeShareSections(value: ShareMaterialCard['share_sections']): ShareSectionDraft[] {
  if (!Array.isArray(value)) return []

  return value
    .map((section, index) => {
      if (!section || typeof section !== 'object') return null

      const title = typeof section.title === 'string' ? section.title : ''
      const body = typeof section.body === 'string' ? section.body : ''

      return {
        id:
          typeof section.id === 'string' && section.id.trim()
            ? section.id
            : `section-${index + 1}`,
        title,
        body,
      }
    })
    .filter((section): section is ShareSectionDraft => Boolean(section))
}

function mergeShareSectionsForEditor(value: ShareMaterialCard['share_sections']) {
  return normalizeShareSections(value)
    .map((section) => {
      const title = section.title.trim()
      const body = section.body.trim()

      if (title && body) return `## ${title}\n${body}`
      if (title) return `## ${title}`

      return body
    })
    .filter(Boolean)
    .join('\n\n')
}

function serializeUnifiedShareBody(body: string): ShareSection[] {
  const value = body.trim()

  if (!value) return []

  return [
    {
      id: 'section-main',
      title: '',
      body: value,
    },
  ]
}

function getShareUrl(token: string) {
  if (typeof window === 'undefined') return `/share/content/${token}`

  return `${window.location.origin}/share/content/${token}`
}

export default function ShareMaterialsPage() {
  const router = useRouter()
  const sectionTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const [materials, setMaterials] = useState<ShareMaterialLink[]>([])
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({})
  const [bodyDrafts, setBodyDrafts] = useState<Record<string, string>>({})
  const [mediaItemsByCardId, setMediaItemsByCardId] = useState<
    Record<string, RichTextEditorMediaItem[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaDeletingIds, setMediaDeletingIds] = useState<string[]>([])
  const [disablingId, setDisablingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const selectedMaterial = useMemo(() => {
    return materials.find((material) => material.id === selectedLinkId) ?? materials[0] ?? null
  }, [materials, selectedLinkId])

  const selectedCard = selectedMaterial?.card ?? null
  const selectedTitleDraft = selectedCard ? titleDrafts[selectedCard.id] ?? selectedCard.title : ''
  const selectedBodyDraft = selectedCard ? bodyDrafts[selectedCard.id] ?? '' : ''
  const selectedMediaItems = selectedCard ? mediaItemsByCardId[selectedCard.id] ?? [] : []
  const selectedAttachmentItems = useMemo(
    () => selectedMediaItems.filter(isAttachmentContentMedia),
    [selectedMediaItems]
  )
  const selectedSections: ShareSectionDraft[] = []
  const activeShareUrl = selectedMaterial ? getShareUrl(selectedMaterial.token) : ''

  useEffect(() => {
    if (!toastMessage) return

    const timer = window.setTimeout(() => {
      setToastMessage(null)
    }, 2200)

    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    let cancelled = false

    const fetchMaterials = async () => {
      setLoading(true)

      const supabase = createClient()
      const { data, error } = await supabase
        .from('content_share_links')
        .select(
          `
            *,
            card:content_cards!inner(
              id,
              title,
              share_sections,
              is_deleted,
              updated_at
            )
          `
        )
        .eq('card.is_deleted', false)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        console.error('Failed to fetch share materials', error)
        setMaterials([])
        setLoading(false)
        return
      }

      const nextMaterials = (data as ShareMaterialLink[] | null) ?? []
      setMaterials(nextMaterials)
      setSelectedLinkId((prev) => {
        if (prev && nextMaterials.some((material) => material.id === prev)) return prev
        return nextMaterials[0]?.id ?? null
      })
      setBodyDrafts(
        nextMaterials.reduce<Record<string, string>>((acc, material) => {
          if (material.card) {
            acc[material.card.id] = mergeShareSectionsForEditor(material.card.share_sections)
          }
          return acc
        }, {})
      )
      setTitleDrafts(
        nextMaterials.reduce<Record<string, string>>((acc, material) => {
          if (material.card) {
            acc[material.card.id] = material.card.title
          }
          return acc
        }, {})
      )
      setLoading(false)
    }

    fetchMaterials()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedCard || mediaItemsByCardId[selectedCard.id]) return

    let cancelled = false

    const fetchMediaItems = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('content_card_media')
        .select('*')
        .eq('card_id', selectedCard.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (error) {
        console.error('Failed to fetch share material media', error)
        setMediaItemsByCardId((prev) => ({
          ...prev,
          [selectedCard.id]: [],
        }))
        return
      }

      const signedItems = await createSignedMediaItems(
        supabase,
        ((data as ContentCardMedia[] | null) ?? [])
      )

      if (cancelled) return

      setMediaItemsByCardId((prev) => ({
        ...prev,
        [selectedCard.id]: signedItems,
      }))
    }

    fetchMediaItems()

    return () => {
      cancelled = true
    }
  }, [mediaItemsByCardId, selectedCard])

  const handleCreateMaterial = async () => {
    if (creating) return

    setCreating(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Authenticated user not found')

      const cardId = await createContentCard({ title: NEW_MATERIAL_TITLE })
      const { data: shareLink, error: shareLinkError } = await supabase
        .from('content_share_links')
        .insert({
          user_id: user.id,
          card_id: cardId,
          token: createShareToken(),
          is_enabled: true,
          expires_at: null,
        })
        .select(
          `
            *,
            card:content_cards!inner(
              id,
              title,
              share_sections,
              is_deleted,
              updated_at
            )
          `
        )
        .single()

      if (shareLinkError) throw shareLinkError

      const nextMaterial = shareLink as ShareMaterialLink
      setMaterials((prev) => [nextMaterial, ...prev])
      setSelectedLinkId(nextMaterial.id)
      if (nextMaterial.card) {
        setTitleDrafts((prev) => ({
          ...prev,
          [nextMaterial.card!.id]: nextMaterial.card!.title,
        }))
        setBodyDrafts((prev) => ({
          ...prev,
          [nextMaterial.card!.id]: mergeShareSectionsForEditor(
            nextMaterial.card!.share_sections
          ),
        }))
      }
      setToastMessage('공유 자료가 생성되었습니다.')
    } catch (error) {
      console.error('Failed to create share material', error)
      window.alert(CREATE_ERROR)
    } finally {
      setCreating(false)
    }
  }

  const updateBodyDraft = (value: string) => {
    if (!selectedCard) return

    setBodyDrafts((prev) => ({
      ...prev,
      [selectedCard.id]: value,
    }))
  }

  const uploadShareMaterialMedia = async (files: File[]) => {
    if (!selectedCard || mediaUploading) return []

    setMediaUploading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Authenticated user not found')

      const baseSortOrder = selectedMediaItems.reduce(
        (maxSortOrder, item) => Math.max(maxSortOrder, item.sort_order),
        -1
      )
      const uploadedItems = await uploadContentCardMediaFiles({
        supabase,
        userId: user.id,
        cardId: selectedCard.id,
        files,
        baseSortOrder,
        purpose: 'inline',
      })

      if (uploadedItems.length > 0) {
        setMediaItemsByCardId((prev) => ({
          ...prev,
          [selectedCard.id]: sortMediaItems([
            ...(prev[selectedCard.id] ?? []),
            ...uploadedItems,
          ]),
        }))
      }

      return uploadedItems
    } catch (error) {
      console.error('Failed to upload share material media', error)
      window.alert('이미지를 업로드하지 못했습니다. 잠시 후 다시 시도해주세요.')
      return []
    } finally {
      setMediaUploading(false)
    }
  }

  const handleShareMaterialAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])

    if (!selectedCard || mediaUploading || files.length === 0) {
      input.value = ''
      return
    }

    setMediaUploading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) throw new Error('Authenticated user not found')

      const baseSortOrder = selectedMediaItems.reduce(
        (maxSortOrder, item) => Math.max(maxSortOrder, item.sort_order),
        -1
      )
      const uploadedItems = await uploadContentCardMediaFiles({
        supabase,
        userId: user.id,
        cardId: selectedCard.id,
        files,
        baseSortOrder,
        purpose: 'attachment',
      })

      if (uploadedItems.length > 0) {
        setMediaItemsByCardId((prev) => ({
          ...prev,
          [selectedCard.id]: sortMediaItems([
            ...(prev[selectedCard.id] ?? []),
            ...uploadedItems,
          ]),
        }))
      }
    } catch (error) {
      console.error('Failed to upload share material attachments', error)
      window.alert(error instanceof Error && error.message ? error.message : ATTACHMENT_UPLOAD_ERROR)
    } finally {
      setMediaUploading(false)
      input.value = ''
    }
  }

  const handleDeleteShareMaterialAttachment = async (media: RichTextEditorMediaItem) => {
    if (!selectedCard || mediaDeletingIds.includes(media.id)) return
    if (!window.confirm(ATTACHMENT_DELETE_CONFIRM)) return

    setMediaDeletingIds((prev) => [...prev, media.id])

    try {
      const supabase = createClient()
      const { error: storageError } = await supabase.storage
        .from(MEDIA_BUCKET_NAME)
        .remove([media.storage_path])

      if (storageError) {
        console.warn('Failed to remove share material attachment object', storageError)
      }

      const { error: deleteError } = await supabase
        .from('content_card_media')
        .delete()
        .eq('id', media.id)

      if (deleteError) throw deleteError

      setMediaItemsByCardId((prev) => ({
        ...prev,
        [selectedCard.id]: (prev[selectedCard.id] ?? []).filter((item) => item.id !== media.id),
      }))

      if (storageError) {
        window.alert(ATTACHMENT_STORAGE_DELETE_WARNING)
      }
    } catch (error) {
      console.error('Failed to delete share material attachment', error)
      window.alert(ATTACHMENT_DELETE_ERROR)
    } finally {
      setMediaDeletingIds((prev) => prev.filter((mediaId) => mediaId !== media.id))
    }
  }

  const addSection = () => {}
  const removeSection = (_sectionId: string) => {}
  const updateSection = (_sectionId: string, _key: 'title' | 'body', _value: string) => {}
  const handleSectionToolbarAction = (
    _section: ShareSectionDraft,
    _action: MarkdownToolbarAction
  ) => {}
  const handleSectionBodyPaste = (
    _event: ClipboardEvent<HTMLTextAreaElement>,
    _sectionId: string
  ) => {}

  const handleSaveSections = async () => {
    if (!selectedCard || saving) return

    setSaving(true)

    try {
      const supabase = createClient()
      const nextSections = serializeUnifiedShareBody(selectedBodyDraft)
      const nextTitle = selectedTitleDraft.trim() || UNTITLED_MATERIAL_TITLE
      const payload: ContentCardUpdate = {
        title: nextTitle,
        share_sections: nextSections,
      }

      const { data, error } = await supabase
        .from('content_cards')
        .update(payload)
        .eq('id', selectedCard.id)
        .select('id, title, share_sections, is_deleted, updated_at')
        .single()

      if (error) throw error

      const nextCard = data as ShareMaterialCard
      setMaterials((prev) =>
        prev.map((material) =>
          material.card_id === nextCard.id ? { ...material, card: nextCard } : material
        )
      )
      setBodyDrafts((prev) => ({
        ...prev,
        [nextCard.id]: mergeShareSectionsForEditor(nextCard.share_sections),
      }))
      setTitleDrafts((prev) => ({
        ...prev,
        [nextCard.id]: nextCard.title,
      }))
      setToastMessage('공유 자료가 저장되었습니다.')
    } catch (error) {
      console.error('Failed to save share sections', error)
      window.alert(SAVE_ERROR)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyShareLink = async () => {
    if (!activeShareUrl) return

    try {
      await navigator.clipboard.writeText(activeShareUrl)
      setToastMessage('공유 링크가 복사되었습니다.')
    } catch (error) {
      console.error('Failed to copy share material link', error)
      window.alert(COPY_ERROR)
    }
  }

  const handleDisableShare = async (material: ShareMaterialLink) => {
    if (!material.is_enabled || disablingId) return

    const confirmed = window.confirm('공유를 중지하시겠습니까? 이 링크로는 더 이상 접근할 수 없습니다.')

    if (!confirmed) return

    setDisablingId(material.id)

    try {
      const supabase = createClient()
      const disabledAt = new Date().toISOString()
      const { data, error } = await supabase
        .from('content_share_links')
        .update({
          is_enabled: false,
          disabled_at: disabledAt,
        })
        .eq('id', material.id)
        .select('*')
        .single()

      if (error) throw error

      const nextLink = data as ContentShareLink
      setMaterials((prev) =>
        prev.map((item) => (item.id === material.id ? { ...item, ...nextLink } : item))
      )
      setToastMessage('공유가 중지되었습니다.')
    } catch (error) {
      console.error('Failed to disable share material link', error)
      window.alert(DISABLE_ERROR)
    } finally {
      setDisablingId(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 bg-[var(--color-bg-canvas)] p-4 sm:p-5 md:p-6">
      {toastMessage && <Toast message={toastMessage} onAction={() => setToastMessage(null)} />}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {PAGE_TITLE}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{PAGE_DESCRIPTION}</p>
        </div>
        <Button onClick={handleCreateMaterial} disabled={creating} size="sm" className="w-full shrink-0 justify-center sm:w-auto">
          <Plus size={14} />
          {creating ? '생성 중' : '새 공유 자료 만들기'}
        </Button>
      </section>

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-20 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_MESSAGE}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            고객에게 자주 보내는 안내 내용을 섹션으로 만들어 링크로 공유해보세요.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="min-h-0 max-h-64 overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3 xl:max-h-none">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                공유 자료 {materials.length}개
              </p>
            </div>
            <div className="flex flex-col gap-1">
              {materials.map((material) => {
                const active = material.id === selectedMaterial?.id
                const cardId = material.card?.id ?? ''
                const bodyPreview = cardId
                  ? bodyDrafts[cardId] ?? mergeShareSectionsForEditor(material.card?.share_sections ?? [])
                  : ''
                const hasBody = Boolean(bodyPreview.trim())

                return (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => setSelectedLinkId(material.id)}
                    className={clsx(
                      'flex w-full flex-col rounded-[var(--radius-md)] px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                      active
                        ? 'bg-[var(--color-bg-surface-soft)] text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
                    )}
                  >
                    <span className="truncate font-medium">
                      {material.card?.title ?? NEW_MATERIAL_TITLE}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                      <span>{hasBody ? '본문 있음' : '비어 있음'}</span>
                      <span>{material.is_enabled ? '공유 중' : '중지됨'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="min-w-0 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            {selectedMaterial && selectedCard ? (
              <div className="flex min-h-full flex-col">
                <div className="border-b border-[var(--color-border-soft)] px-5 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-accent)]">공유 자료</p>
                      <label className="mt-2 block">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                          자료 제목
                        </span>
                        <input
                          type="text"
                          value={selectedTitleDraft}
                          onChange={(event) =>
                            setTitleDrafts((prev) => ({
                              ...prev,
                              [selectedCard.id]: event.target.value,
                            }))
                          }
                          placeholder={UNTITLED_MATERIAL_TITLE}
                          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-base font-semibold tracking-[-0.01em] text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)]"
                        />
                      </label>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        공개 URL은 기존 /share/content/[token] 형식을 그대로 사용합니다.
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                      {selectedMaterial.is_enabled && (
                        <Button type="button" size="sm" variant="secondary" onClick={handleCopyShareLink}>
                          <Copy size={14} />
                          링크 복사
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push(`/content/${selectedCard.id}`)}
                      >
                        <ExternalLink size={14} />
                        콘텐츠에서 편집
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={!selectedMaterial.is_enabled || disablingId === selectedMaterial.id}
                        onClick={() => handleDisableShare(selectedMaterial)}
                      >
                        <Share2 size={14} />
                        {disablingId === selectedMaterial.id ? '처리 중' : '공유 중지'}
                      </Button>
                    </div>
                  </div>

                  {selectedMaterial.is_enabled && (
                    <input
                      type="text"
                      readOnly
                      value={activeShareUrl}
                      className="mt-3 h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 text-xs text-[var(--color-text-body)] outline-none"
                      aria-label="공유 링크"
                    />
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {ATTACHMENT_SECTION_LABEL}
                      </p>
                      <label
                        className={clsx(
                          'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors',
                          'hover:bg-[var(--color-bg-subtle)] focus-within:[box-shadow:var(--focus-ring)]',
                          mediaUploading && 'cursor-not-allowed text-[var(--color-text-muted)] opacity-70'
                        )}
                      >
                        <Upload size={13} />
                        {mediaUploading ? ATTACHMENT_UPLOADING_LABEL : ATTACHMENT_UPLOAD_LABEL}
                        <input
                          type="file"
                          accept={CONTENT_MEDIA_ATTACHMENT_ACCEPT}
                          multiple
                          disabled={mediaUploading || !selectedCard}
                          onChange={handleShareMaterialAttachmentUpload}
                          className="sr-only"
                          aria-label={ATTACHMENT_UPLOAD_LABEL}
                        />
                      </label>
                    </div>

                    {selectedAttachmentItems.length > 0 ? (
                      <div className="divide-y divide-[var(--color-border-soft)] rounded-[var(--radius-md)] border border-[var(--color-border-soft)]">
                        {selectedAttachmentItems.map((media) => {
                          const typeLabel = getContentMediaTypeLabel(media.media_type, media.file_name)
                          const fileName = media.file_name?.trim() || '첨부파일'
                          const isDeleting = mediaDeletingIds.includes(media.id)

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
                                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                                  {fileName}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                  {typeLabel} · {formatContentMediaFileSize(media.file_size)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {media.signedUrl ? (
                                  media.media_type === 'file' ? (
                                    <ContentMediaDownloadLink
                                      url={media.signedUrl}
                                      fileName={fileName}
                                      className="inline-flex h-8 items-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                                    >
                                      다운로드
                                    </ContentMediaDownloadLink>
                                  ) : (
                                    <a
                                      href={media.signedUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      download={fileName}
                                      className="inline-flex h-8 items-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                                    >
                                      {ATTACHMENT_OPEN_LABEL}
                                    </a>
                                  )
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShareMaterialAttachment(media)}
                                  disabled={isDeleting}
                                  className="inline-flex h-8 items-center rounded-[6px] px-3 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                                >
                                  {isDeleting ? ATTACHMENT_DELETING_LABEL : ATTACHMENT_DELETE_LABEL}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {ATTACHMENT_EMPTY_LABEL}
                      </p>
                    )}
                  </section>

                  <div className="flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)]">
                    <RichTextEditor
                      value={selectedBodyDraft}
                      onChange={updateBodyDraft}
                      mediaItems={selectedMediaItems}
                      onUploadMedia={uploadShareMaterialMedia}
                      uploadDisabled={mediaUploading || !selectedCard}
                      uploadDisabledMessage={'저장된 공유자료에서만 이미지를 본문에 삽입할 수 있습니다.'}
                      placeholder={'공유할 내용을 처음부터 끝까지 이어서 작성해보세요...'}
                      className="flex min-h-0 flex-1 flex-col"
                      bodyClassName="editor-body-wrap flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6"
                      editorClassName="min-h-[460px]"
                    />
                  </div>

                  <div className="flex flex-wrap justify-end border-t border-[var(--color-border-soft)] pt-4">
                    <Button type="button" onClick={handleSaveSections} disabled={saving}>
                      <Save size={14} />
                      {saving ? '저장 중' : '저장'}
                    </Button>
                  </div>

                  <div className="hidden">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">섹션</p>
                    <Button type="button" size="sm" variant="secondary" onClick={addSection}>
                      <Plus size={14} />
                      섹션 추가
                    </Button>
                  </div>

                  {selectedSections.length === 0 ? (
                    <div className="hidden">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        아직 섹션이 없습니다.
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        섹션 추가를 눌러 고객에게 보낼 정보를 작성하세요.
                      </p>
                    </div>
                  ) : (
                    <div className="hidden">
                      {selectedSections.map((section) => (
                        <article
                          key={section.id}
                          className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] p-3 sm:p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => removeSection(section.id)}
                              className="inline-flex h-7 items-center gap-1 rounded-[5px] px-2 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                            >
                              <Trash2 size={13} />
                              삭제
                            </button>
                          </div>
                          <label className="block">
                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                              섹션 이름
                            </span>
                            <input
                              type="text"
                              value={section.title}
                              onChange={(event) =>
                                updateSection(section.id, 'title', event.target.value)
                              }
                              className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)]"
                            />
                          </label>
                          <div className="mt-3">
                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                              내용
                            </span>
                            <MarkdownToolbar
                              onAction={(action) => handleSectionToolbarAction(section, action)}
                              className="mt-1 rounded-t-[var(--radius-md)] border border-[var(--color-border-default)] border-b-0 bg-[var(--color-bg-surface)] px-2"
                              toolbarClassName="flex min-h-10 items-center gap-1 overflow-x-auto py-1"
                            />
                            <textarea
                              ref={(node) => {
                                sectionTextareaRefs.current[section.id] = node
                              }}
                              value={section.body}
                              onChange={(event) =>
                                updateSection(section.id, 'body', event.target.value)
                              }
                              onPaste={(event) => handleSectionBodyPaste(event, section.id)}
                              rows={5}
                              placeholder="고객에게 보낼 안내 내용을 입력하세요."
                              className="min-h-[120px] w-full resize-y rounded-b-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm leading-6 text-[var(--color-text-body)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)]"
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  <div className="hidden">
                    <Button type="button" onClick={handleSaveSections} disabled={saving}>
                      <Save size={14} />
                      {saving ? '저장 중' : '저장'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}
