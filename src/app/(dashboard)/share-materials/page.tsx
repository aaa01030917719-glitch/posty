'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, Plus, Save, Share2, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createContentCard } from '@/components/content/createContentCard'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { ContentShareLink, Database, ShareSection } from '@/lib/types'

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

function createSectionDraft(): ShareSectionDraft {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `section-${Date.now()}-${Math.random().toString(16).slice(2)}`

  return {
    id,
    title: '',
    body: '',
  }
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

function serializeShareSections(sections: ShareSectionDraft[]): ShareSection[] {
  return sections
    .map((section) => ({
      id: section.id,
      title: section.title.trim(),
      body: section.body.trim(),
    }))
    .filter((section) => section.title || section.body)
}

function getShareUrl(token: string) {
  if (typeof window === 'undefined') return `/share/content/${token}`

  return `${window.location.origin}/share/content/${token}`
}

export default function ShareMaterialsPage() {
  const router = useRouter()
  const [materials, setMaterials] = useState<ShareMaterialLink[]>([])
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({})
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, ShareSectionDraft[]>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [disablingId, setDisablingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const selectedMaterial = useMemo(() => {
    return materials.find((material) => material.id === selectedLinkId) ?? materials[0] ?? null
  }, [materials, selectedLinkId])

  const selectedCard = selectedMaterial?.card ?? null
  const selectedTitleDraft = selectedCard ? titleDrafts[selectedCard.id] ?? selectedCard.title : ''
  const selectedSections = selectedCard ? sectionDrafts[selectedCard.id] ?? [] : []
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
      setSectionDrafts(
        nextMaterials.reduce<Record<string, ShareSectionDraft[]>>((acc, material) => {
          if (material.card) {
            acc[material.card.id] = normalizeShareSections(material.card.share_sections)
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
        setSectionDrafts((prev) => ({
          ...prev,
          [nextMaterial.card!.id]: normalizeShareSections(nextMaterial.card!.share_sections),
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

  const updateSection = (sectionId: string, key: 'title' | 'body', value: string) => {
    if (!selectedCard) return

    setSectionDrafts((prev) => ({
      ...prev,
      [selectedCard.id]: selectedSections.map((section) =>
        section.id === sectionId ? { ...section, [key]: value } : section
      ),
    }))
  }

  const addSection = () => {
    if (!selectedCard) return

    setSectionDrafts((prev) => ({
      ...prev,
      [selectedCard.id]: [...selectedSections, createSectionDraft()],
    }))
  }

  const removeSection = (sectionId: string) => {
    if (!selectedCard) return

    setSectionDrafts((prev) => ({
      ...prev,
      [selectedCard.id]: selectedSections.filter((section) => section.id !== sectionId),
    }))
  }

  const handleSaveSections = async () => {
    if (!selectedCard || saving) return

    setSaving(true)

    try {
      const supabase = createClient()
      const nextSections = serializeShareSections(selectedSections)
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
      setSectionDrafts((prev) => ({
        ...prev,
        [nextCard.id]: normalizeShareSections(nextCard.share_sections),
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
    <div className="flex min-h-0 flex-1 flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      {toastMessage && <Toast message={toastMessage} onAction={() => setToastMessage(null)} />}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {PAGE_TITLE}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{PAGE_DESCRIPTION}</p>
        </div>
        <Button onClick={handleCreateMaterial} disabled={creating} size="sm" className="shrink-0">
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
        <div className="grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            <div className="border-b border-[var(--color-border-soft)] px-4 py-3">
              <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                공유 자료 {materials.length}개
              </p>
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-2">
              {materials.map((material) => {
                const active = material.id === selectedMaterial?.id
                const sectionCount = normalizeShareSections(material.card?.share_sections ?? []).length

                return (
                  <button
                    key={material.id}
                    type="button"
                    onClick={() => setSelectedLinkId(material.id)}
                    className={clsx(
                      'mb-1 flex w-full flex-col rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                      active
                        ? 'bg-[var(--color-bg-accent-soft)]'
                        : 'hover:bg-[var(--color-bg-subtle)]'
                    )}
                  >
                    <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {material.card?.title ?? NEW_MATERIAL_TITLE}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                      <span>{sectionCount}개 섹션</span>
                      <span>{material.is_enabled ? '공유 중' : '중지됨'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="min-h-0 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
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
                    <div className="flex flex-wrap gap-2">
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

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">섹션</p>
                    <Button type="button" size="sm" variant="secondary" onClick={addSection}>
                      <Plus size={14} />
                      섹션 추가
                    </Button>
                  </div>

                  {selectedSections.length === 0 ? (
                    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-default)] px-4 py-8 text-center">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        아직 섹션이 없습니다.
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        섹션 추가를 눌러 고객에게 보낼 정보를 작성하세요.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedSections.map((section) => (
                        <article
                          key={section.id}
                          className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] p-4"
                        >
                          <div className="mb-3 flex items-center justify-end gap-3">
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
                          <label className="mt-3 block">
                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                              내용
                            </span>
                            <textarea
                              value={section.body}
                              onChange={(event) =>
                                updateSection(section.id, 'body', event.target.value)
                              }
                              rows={5}
                              placeholder="고객에게 보낼 안내 내용을 입력하세요."
                              className="mt-1 min-h-[120px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm leading-6 text-[var(--color-text-body)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)]"
                            />
                          </label>
                        </article>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end border-t border-[var(--color-border-soft)] pt-4">
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
