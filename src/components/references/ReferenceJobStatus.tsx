import { formatReferenceDate } from './referenceFormat'
import type { ReferenceJobData } from './referenceTypes'

export function ReferenceJobStatus({ job }: { job: ReferenceJobData | null }) {
  if (!job) {
    return (
      <p className="rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
        등록된 분석 작업이 없습니다.
      </p>
    )
  }

  const fields = [
    ['작업 유형', job.job_type],
    ['제출 출처', job.submission_source ?? '-'],
    ['상태', job.status],
    ['우선순위', String(job.priority)],
    ['시도 횟수', String(job.attempt_count)],
    ['실패 코드', job.failure_code ?? '-'],
    ['실패 사유', job.failure_reason ?? '-'],
    ['생성', formatReferenceDate(job.created_at)],
    ['수정', formatReferenceDate(job.updated_at)],
  ]

  return (
    <dl className="grid gap-2 rounded-[6px] border border-[var(--color-border-soft)] px-4 py-3 text-xs md:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="font-semibold text-[var(--color-text-secondary)]">{label}</dt>
          <dd className="mt-0.5 break-words text-[var(--color-text-muted)]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
