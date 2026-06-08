import type { Json } from '@/lib/types'
import { formatReferenceDate } from './referenceFormat'
import type { ReferenceAnalysisData } from './referenceTypes'

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : []
}

function valueToText(value: Json): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(valueToText).filter(Boolean).join(', ')

  const preferred = ['factor', 'evidence', 'confidence', 'title', 'point', 'text', 'summary']
    .map((key) => value[key])
    .filter((item): item is Json => item !== undefined && item !== null)
    .map(valueToText)
    .filter(Boolean)

  if (preferred.length > 0) return preferred.join(' · ')

  return Object.entries(value)
    .map(([key, item]) => `${key}: ${valueToText(item as Json)}`)
    .join(' · ')
}

function AnalysisList({ title, value }: { title: string; value: Json }) {
  const items = asArray(value).map(valueToText).filter(Boolean)

  return (
    <section>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[var(--color-text-secondary)]">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">표시할 내용이 없습니다.</p>
      )}
    </section>
  )
}

export function ReferenceAnalysisSection({
  analysis,
}: {
  analysis: ReferenceAnalysisData | null
}) {
  if (!analysis) {
    return (
      <p className="rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
        분석 대기 중입니다. Manus 분석 연결 후 대본, 자막, 바이럴 요소가 표시됩니다.
      </p>
    )
  }

  return (
    <div className="space-y-5 rounded-[6px] border border-[var(--color-border-soft)] px-4 py-4">
      <p className="text-xs text-[var(--color-text-muted)]">
        완료 {formatReferenceDate(analysis.completed_at)}
      </p>

      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">대본</h3>
        {analysis.transcript ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">
            {analysis.transcript}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">대본이 없습니다.</p>
        )}
      </section>

      <AnalysisList title="자막" value={analysis.captions} />
      <AnalysisList title="바이럴 요소" value={analysis.viral_factors} />
      <AnalysisList title="업무 활용 포인트" value={analysis.business_use_points} />
      <AnalysisList title="콘텐츠 각도" value={analysis.content_angles} />
      <AnalysisList title="주의 사항" value={analysis.risk_notes} />
    </div>
  )
}
