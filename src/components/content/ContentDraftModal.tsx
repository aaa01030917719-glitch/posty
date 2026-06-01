'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { ContentCardDraft } from '@/lib/types'

type ContentDraftModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  onTitleChange: (value: string) => void
  drafts: ContentCardDraft[]
  loading: boolean
  saving: boolean
  deletingId: string | null
  feedback: string | null
  error: string | null
  onSave: () => void
  onLoad: (draft: ContentCardDraft) => void
  onDelete: (draft: ContentCardDraft) => void
}

function formatDraftDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function ContentDraftModal({
  isOpen,
  onClose,
  title,
  onTitleChange,
  drafts,
  loading,
  saving,
  deletingId,
  feedback,
  error,
  onSave,
  onLoad,
  onDelete,
}: ContentDraftModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="임시저장 목록" size="lg">
      <div className="flex max-h-[calc(90vh-96px)] flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1 text-xs font-semibold text-[var(--color-text-body)]">
            <span className="mb-1 block">임시저장 제목</span>
            <input
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="h-10 w-full rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm font-medium text-[var(--color-text-body)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)]"
              placeholder="제목 없음"
            />
          </label>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--color-accent-disabled)]"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            현재 내용 임시저장
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-4 text-sm font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)]"
          >
            닫기
          </button>
        </div>

        {(feedback || error) && (
          <div className="space-y-1">
            {feedback && <p className="text-xs font-medium text-[var(--color-success)]">{feedback}</p>}
            {error && <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p>}
          </div>
        )}

        <div className="min-h-[120px] overflow-hidden rounded-[8px] border border-[var(--color-border-soft)]">
          {loading ? (
            <div className="flex min-h-[120px] items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Loader2 size={16} className="animate-spin" />
              임시저장 목록을 불러오는 중입니다
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center px-4 text-sm text-[var(--color-text-muted)]">
              저장된 임시저장본이 없습니다
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <div className="divide-y divide-[var(--color-border-soft)]">
                {drafts.map((draft) => {
                  const isDeleting = deletingId === draft.id

                  return (
                    <div
                      key={draft.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4"
                    >
                      <div className="min-w-[180px] flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                          {draft.title || '제목 없음'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {formatDraftDate(draft.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onLoad(draft)}
                          className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)]"
                        >
                          불러오기
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(draft)}
                          disabled={isDeleting}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                        >
                          {isDeleting ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
