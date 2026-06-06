'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export type AutoDmRule = {
  id: string
  title: string
  mediaId: string
  mediaType: 'POST' | 'REEL'
  mediaPermalink: string | null
  mediaPreviewUrl: string | null
  keyword: string
  shareLinkId: string | null
  shareMaterialTitle: string | null
  initialPrivateReplyMessage: string
  publicCommentReplyMessage: string
  followRequiredMessage: string
  materialDeliveryMessage: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type ShareLinkOption = {
  shareLinkId: string
  cardId: string
  title: string
}

type InstagramMediaOption = {
  id: string
  mediaType: 'POST' | 'REEL'
  apiMediaType: string | null
  permalink: string | null
  thumbnailUrl: string | null
  captionPreview: string | null
  timestamp: string | null
}

type RuleForm = {
  title: string
  mediaType: 'POST' | 'REEL'
  mediaId: string
  mediaPermalink: string
  mediaPreviewUrl: string
  keyword: string
  shareLinkId: string
  initialPrivateReplyMessage: string
  publicCommentReplyMessage: string
  followRequiredMessage: string
  materialDeliveryMessage: string
  enabled: boolean
}

type ResolveStatus = 'idle' | 'loading' | 'success' | 'error'

const DEFAULT_FORM: RuleForm = {
  title: '',
  mediaType: 'REEL',
  mediaId: '',
  mediaPermalink: '',
  mediaPreviewUrl: '',
  keyword: '',
  shareLinkId: '',
  initialPrivateReplyMessage:
    '자료는 팔로우 확인 후 보내드려요🙂 아래 자료 받기 버튼을 눌러주세요',
  publicCommentReplyMessage: 'DM 보내드렸어요🙂 메시지 요청함도 확인해주세요',
  followRequiredMessage: '계정을 팔로우한 뒤 아래 버튼을 눌러주세요🙂',
  materialDeliveryMessage: '요청하신 자료를 보내드릴게요🙂 {link}',
  enabled: true,
}

type AutoDmRuleModalProps = {
  isOpen: boolean
  rule: AutoDmRule | null
  shareLinks: ShareLinkOption[]
  onClose: () => void
  onSaved: (rule: AutoDmRule) => void
}

export function AutoDmRuleModal({
  isOpen,
  rule,
  shareLinks,
  onClose,
  onSaved,
}: AutoDmRuleModalProps) {
  const [form, setForm] = useState<RuleForm>({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mediaOptions, setMediaOptions] = useState<InstagramMediaOption[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [resolveStatus, setResolveStatus] = useState<ResolveStatus>('idle')
  const [resolveMessage, setResolveMessage] = useState<string | null>(null)
  const [lastResolvedUrl, setLastResolvedUrl] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const nextForm = rule
      ? {
          title: rule.title,
          mediaType: rule.mediaType,
          mediaId: rule.mediaId,
          mediaPermalink: rule.mediaPermalink ?? '',
          mediaPreviewUrl: rule.mediaPreviewUrl ?? '',
          keyword: rule.keyword,
          shareLinkId: rule.shareLinkId ?? '',
          initialPrivateReplyMessage: rule.initialPrivateReplyMessage,
          publicCommentReplyMessage: rule.publicCommentReplyMessage,
          followRequiredMessage: rule.followRequiredMessage,
          materialDeliveryMessage: rule.materialDeliveryMessage,
          enabled: rule.enabled,
        }
      : { ...DEFAULT_FORM }

    setForm(nextForm)
    setError(null)
    setResolveStatus(rule?.mediaId ? 'success' : 'idle')
    setResolveMessage(rule?.mediaId ? '저장된 게시물 정보를 사용합니다' : null)
    setLastResolvedUrl(nextForm.mediaPermalink)
  }, [isOpen, rule])

  useEffect(() => {
    if (!isOpen) return

    void loadMediaOptions()
  }, [isOpen])

  async function loadMediaOptions() {
    setMediaLoading(true)
    setMediaError(null)

    try {
      const response = await fetch('/api/auto-dm/media')
      const data = await response.json() as { media?: InstagramMediaOption[]; error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'Instagram 게시물을 불러오지 못했어요')
      }

      setMediaOptions(data.media ?? [])
    } catch (loadError) {
      setMediaError(loadError instanceof Error ? loadError.message : 'Instagram 게시물을 불러오지 못했어요')
      setMediaOptions([])
    } finally {
      setMediaLoading(false)
    }
  }

  function applyMedia(media: InstagramMediaOption) {
    setForm((current) => ({
      ...current,
      mediaId: media.id,
      mediaType: media.mediaType,
      mediaPermalink: media.permalink ?? '',
      mediaPreviewUrl: media.thumbnailUrl ?? '',
    }))
    setResolveStatus('success')
    setResolveMessage('게시물을 확인했어요')
    setLastResolvedUrl(media.permalink ?? '')
  }

  function handlePermalinkChange(value: string) {
    setForm((current) => ({
      ...current,
      mediaPermalink: value,
      mediaId: '',
      mediaPreviewUrl: '',
    }))
    setResolveStatus(value.trim() ? 'idle' : 'idle')
    setResolveMessage(null)
  }

  async function resolveMediaUrl(url = form.mediaPermalink) {
    const trimmedUrl = url.trim()

    if (!trimmedUrl || resolveStatus === 'loading' || trimmedUrl === lastResolvedUrl) return

    setResolveStatus('loading')
    setResolveMessage('게시물을 확인하고 있어요')
    setError(null)

    try {
      const response = await fetch('/api/auto-dm/media/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      })
      const data = await response.json() as {
        media?: InstagramMediaOption
        error?: string
        searchLimit?: number
      }

      if (!response.ok || !data.media) {
        throw new Error(data.error ?? '연결된 Instagram 계정의 게시물을 찾지 못했어요')
      }

      applyMedia(data.media)
    } catch (resolveError) {
      setResolveStatus('error')
      setResolveMessage(
        resolveError instanceof Error
          ? resolveError.message
          : '연결된 Instagram 계정의 게시물을 찾지 못했어요'
      )
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return

    const mediaId = form.mediaId.trim()
    const keyword = form.keyword.trim()

    if (!mediaId || !keyword) {
      setError('Instagram 게시물 URL을 확인하고 감지 키워드를 입력해주세요')
      return
    }

    if (!form.materialDeliveryMessage.includes('{link}')) {
      setError('자료 발송 문구에 {link}를 포함해주세요')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(rule ? `/api/auto-dm/rules/${rule.id}` : '/api/auto-dm/rules', {
        method: rule ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mediaId, keyword }),
      })
      const data = await response.json() as { rule?: AutoDmRule; error?: string }

      if (!response.ok || !data.rule) {
        throw new Error(data.error ?? '자동 DM 규칙을 저장하지 못했어요')
      }

      onSaved(data.rule)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '자동 DM 규칙을 저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => undefined : onClose}
      title={rule ? '자동 DM 규칙 수정' : '새 자동 DM 만들기'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
        <Field label="규칙명 *">
          <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} />
        </Field>

        <MediaPicker
          rule={rule}
          form={form}
          mediaOptions={mediaOptions}
          mediaLoading={mediaLoading}
          mediaError={mediaError}
          resolveStatus={resolveStatus}
          resolveMessage={resolveMessage}
          onRefresh={loadMediaOptions}
          onResolve={resolveMediaUrl}
          onPermalinkChange={handlePermalinkChange}
          onSelect={applyMedia}
          onChange={setForm}
        />

        <Field label="감지 키워드 1개 *">
          <input required value={form.keyword} onChange={(event) => setForm({ ...form, keyword: event.target.value })} className={inputClass} />
        </Field>
        <Field label="발송할 공유자료 *">
          <select required value={form.shareLinkId} onChange={(event) => setForm({ ...form, shareLinkId: event.target.value })} className={inputClass}>
            <option value="">공유자료 선택</option>
            {shareLinks.map((shareLink) => <option key={shareLink.shareLinkId} value={shareLink.shareLinkId}>{shareLink.title}</option>)}
          </select>
        </Field>
        <MessageField label="최초 Private Reply DM *" value={form.initialPrivateReplyMessage} onChange={(value) => setForm({ ...form, initialPrivateReplyMessage: value })} />
        <MessageField label="공개 대댓글 *" value={form.publicCommentReplyMessage} onChange={(value) => setForm({ ...form, publicCommentReplyMessage: value })} />
        <MessageField label="미팔로우 재안내 *" value={form.followRequiredMessage} onChange={(value) => setForm({ ...form, followRequiredMessage: value })} />
        <MessageField label="자료 발송 문구 *" description="{link} placeholder를 반드시 포함해주세요" value={form.materialDeliveryMessage} onChange={(value) => setForm({ ...form, materialDeliveryMessage: value })} />
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          규칙 활성화
        </label>
        {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-[var(--color-border-default)] pt-4">
          <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onClose}>취소</Button>
          <Button type="submit" size="sm" disabled={saving || shareLinks.length === 0}>{saving ? '저장 중' : '저장'}</Button>
        </div>
      </form>
    </Modal>
  )
}

const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:[box-shadow:var(--focus-ring)]'

function MediaPicker({
  rule,
  form,
  mediaOptions,
  mediaLoading,
  mediaError,
  resolveStatus,
  resolveMessage,
  onRefresh,
  onResolve,
  onPermalinkChange,
  onSelect,
  onChange,
}: {
  rule: AutoDmRule | null
  form: RuleForm
  mediaOptions: InstagramMediaOption[]
  mediaLoading: boolean
  mediaError: string | null
  resolveStatus: ResolveStatus
  resolveMessage: string | null
  onRefresh: () => void
  onResolve: (url?: string) => void
  onPermalinkChange: (value: string) => void
  onSelect: (media: InstagramMediaOption) => void
  onChange: (form: RuleForm) => void
}) {
  return (
    <section className="space-y-3">
      <Field label="Instagram 게시물 URL *">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            required={!form.mediaId}
            type="url"
            value={form.mediaPermalink}
            placeholder="https://www.instagram.com/reel/..."
            onChange={(event) => onPermalinkChange(event.target.value)}
            onBlur={() => onResolve()}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData('text')
              if (pasted) {
                window.setTimeout(() => onResolve(pasted), 0)
              }
            }}
            className={inputClass}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={resolveStatus === 'loading' || !form.mediaPermalink.trim()}
            onClick={() => onResolve()}
            className="shrink-0"
          >
            {resolveStatus === 'loading' ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            확인
          </Button>
        </div>
        {resolveMessage ? (
          <span className={`font-normal ${resolveStatus === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
            {resolveMessage}
          </span>
        ) : null}
        {rule && form.mediaId && resolveStatus !== 'error' ? (
          <span className="font-normal text-[var(--color-text-muted)]">
            기존 게시물이 최근 검색 범위 밖이어도 저장된 값은 유지됩니다
          </span>
        ) : null}
      </Field>

      <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)]">최근 게시물에서 선택</h3>
            <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">
              URL 입력이 어려울 때 연결된 계정의 최근 게시물에서 선택할 수 있습니다.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={mediaLoading} onClick={onRefresh}>
            <RefreshCw size={14} className={mediaLoading ? 'animate-spin' : undefined} />
            새로고침
          </Button>
        </div>

        {mediaLoading ? (
          <div className="flex min-h-36 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-soft)] text-[var(--color-text-muted)]">
            <LoaderCircle className="animate-spin" size={18} />
          </div>
        ) : mediaError ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] px-3 py-2 text-xs leading-5 text-[var(--color-danger)]">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{mediaError}</span>
          </div>
        ) : mediaOptions.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-soft)] px-3 py-6 text-center text-xs leading-5 text-[var(--color-text-muted)]">
            최근 게시물 목록이 없습니다. Instagram에 게시물이 없거나 목록을 불러올 수 없습니다.
          </div>
        ) : (
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {mediaOptions.map((media) => <MediaCard key={media.id} media={media} selected={form.mediaId === media.id} onSelect={onSelect} />)}
          </div>
        )}
      </div>

      <details className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-[var(--color-text-secondary)]">
          문제 해결용 직접 입력
        </summary>
        <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-muted)]">
          최근 검색 범위에서 찾지 못한 게시물을 운영자가 확인해야 할 때만 사용합니다.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="미디어 유형 *">
            <select value={form.mediaType} onChange={(event) => onChange({ ...form, mediaType: event.target.value as RuleForm['mediaType'] })} className={inputClass}>
              <option value="POST">게시물</option>
              <option value="REEL">릴스</option>
            </select>
          </Field>
          <Field label="Instagram 미디어 ID *">
            <input value={form.mediaId} onChange={(event) => onChange({ ...form, mediaId: event.target.value })} className={inputClass} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="썸네일 URL">
            <input type="url" value={form.mediaPreviewUrl} onChange={(event) => onChange({ ...form, mediaPreviewUrl: event.target.value })} className={inputClass} />
          </Field>
        </div>
      </details>
    </section>
  )
}

function MediaCard({
  media,
  selected,
  onSelect,
}: {
  media: InstagramMediaOption
  selected: boolean
  onSelect: (media: InstagramMediaOption) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(media)}
      className={`grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-[var(--radius-md)] border p-2 text-left outline-none transition-colors focus-visible:[box-shadow:var(--focus-ring)] ${selected ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-bg-surface))]' : 'border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface)]'}`}
    >
      <span className="relative flex aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
        {media.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ImageIcon size={18} />
          </span>
        )}
        {selected ? (
          <span className="absolute right-1 top-1 rounded-full bg-[var(--color-accent)] text-white">
            <CheckCircle2 size={16} />
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="inline-flex rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
          {media.mediaType === 'REEL' ? '릴스' : '게시물'}
        </span>
        <span className="mt-1 block truncate text-xs font-medium text-[var(--color-text-primary)]">
          {media.captionPreview ?? '캡션 없는 게시물'}
        </span>
        <span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">
          {formatDate(media.timestamp)}
        </span>
      </span>
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">{label}{children}</label>
}

function MessageField({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <textarea required rows={3} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      {description ? <span className="font-normal text-[var(--color-text-muted)]">{description}</span> : null}
    </Field>
  )
}

function formatDate(value: string | null) {
  if (!value) return '날짜 없음'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? '날짜 없음'
    : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date)
}
