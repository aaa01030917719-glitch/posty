import type { ReferenceAnalysisStatus } from './referenceTypes'

export const REFERENCE_STATUS_LABELS: Record<ReferenceAnalysisStatus, string> = {
  pending: '수집 완료',
  queued: '분석 대기',
  processing: '분석 중',
  completed: '분석 완료',
  partial: '일부 분석 완료',
  unavailable: '원본 확인 필요',
  failed: '분석 실패',
}

export const REFERENCE_STATUS_CLASSES: Record<ReferenceAnalysisStatus, string> = {
  pending: 'bg-[#f3f4f6] text-[#56606d]',
  queued: 'bg-[#eef6ff] text-[#2563a8]',
  processing: 'bg-[#fff4e3] text-[#9a5c16]',
  completed: 'bg-[#edf8f0] text-[#2f7a4f]',
  partial: 'bg-[#f5f3ff] text-[#6d5fb8]',
  unavailable: 'bg-[#fff8db] text-[#806b16]',
  failed: 'bg-[#fff0f3] text-[#b33f5d]',
}

export function formatReferenceDate(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function compactUrl(value: string, maxLength = 72) {
  if (value.length <= maxLength) return value

  return `${value.slice(0, maxLength - 1).trim()}…`
}

export function getReferenceTitle(title: string | null, canonicalUrl: string) {
  return title?.trim() || compactUrl(canonicalUrl, 58)
}

export function isReferenceAnalysisStatus(value: string): value is ReferenceAnalysisStatus {
  return value in REFERENCE_STATUS_LABELS
}
