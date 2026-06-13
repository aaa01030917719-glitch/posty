'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

type ReferenceAnalyzeButtonProps = {
  referenceId: string
  platform: string
  hasAnalysis: boolean
  activeJobStatus: string | null
  estimatedCredits: {
    min: number
    max: number
  }
}

const ACTIVE_JOB_STATUSES = new Set(['queued', 'processing', 'submitted', 'retry_scheduled'])

function unsupportedMessage(platform: string) {
  if (platform === 'instagram_post') {
    return 'Instagram 게시물은 자동 분석 대상이 아닙니다.'
  }

  return '현재는 Instagram Reel만 Manus 분석을 지원합니다.'
}

export function ReferenceAnalyzeButton({
  referenceId,
  platform,
  hasAnalysis,
  activeJobStatus,
  estimatedCredits,
}: ReferenceAnalyzeButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeJob = activeJobStatus ? ACTIVE_JOB_STATUSES.has(activeJobStatus) : false

  if (hasAnalysis) return null

  if (platform !== 'instagram_reel') {
    return (
      <p className="rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">
        {unsupportedMessage(platform)}
      </p>
    )
  }

  async function submitAnalysis() {
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/references/${referenceId}/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmCost: true }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error ?? '분석 제출에 실패했습니다.')
        setIsSubmitting(false)
        return
      }

      setIsOpen(false)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={activeJob || isSubmitting}
      >
        {activeJob ? '분석 제출 중' : '분석 시작'}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (!isSubmitting) setIsOpen(false)
        }}
        title="Manus 분석을 시작할까요?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            <p>
              Reel 1건 분석에는 예상 약 {estimatedCredits.min}~{estimatedCredits.max} credits가
              사용됩니다.
            </p>
            <p>실제 사용량은 영상 길이와 난이도에 따라 달라질 수 있습니다.</p>
          </div>

          {error ? (
            <p className="rounded-[6px] border border-[color-mix(in_srgb,var(--color-danger)_30%,var(--color-border-default))] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button type="button" size="sm" onClick={submitAnalysis} disabled={isSubmitting}>
              {isSubmitting ? '제출 중' : '확인하고 시작'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
