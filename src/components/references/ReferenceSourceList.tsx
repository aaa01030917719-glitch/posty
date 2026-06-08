import { ExternalLink } from 'lucide-react'
import { formatReferenceDate } from './referenceFormat'
import type { ReferenceSourceData } from './referenceTypes'

export function ReferenceSourceList({ sources }: { sources: ReferenceSourceData[] }) {
  if (sources.length === 0) {
    return (
      <p className="rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
        연결된 Linkko 출처가 없습니다.
      </p>
    )
  }

  return (
    <div className="divide-y divide-[var(--color-border-soft)] rounded-[6px] border border-[var(--color-border-soft)]">
      {sources.map((source) => (
        <div key={source.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {source.source_folder_name ?? '폴더 정보 없음'}
            </p>
            {source.source_deleted_at ? (
              <span className="rounded-full bg-[#fff0f3] px-2 py-0.5 text-[11px] font-semibold text-[#b33f5d]">
                삭제됨
              </span>
            ) : null}
          </div>

          <dl className="mt-2 grid gap-2 text-xs text-[var(--color-text-muted)] md:grid-cols-2">
            <div>
              <dt className="font-semibold text-[var(--color-text-secondary)]">저장 제목</dt>
              <dd>{source.custom_title ?? source.preview_title ?? '-'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--color-text-secondary)]">저장 시각</dt>
              <dd>{formatReferenceDate(source.source_created_at)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--color-text-secondary)]">마지막 확인</dt>
              <dd>{formatReferenceDate(source.last_seen_at)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--color-text-secondary)]">삭제 기록</dt>
              <dd>{formatReferenceDate(source.source_deleted_at)}</dd>
            </div>
          </dl>

          {source.memo ? (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--color-text-secondary)]">
              {source.memo}
            </p>
          ) : null}

          <a
            href={source.raw_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            <ExternalLink size={13} />
            원본 저장 URL 열기
          </a>
        </div>
      ))}
    </div>
  )
}
