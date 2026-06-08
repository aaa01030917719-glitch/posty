import { ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ReferenceStatusBadge } from './ReferenceStatusBadge'
import {
  compactUrl,
  formatReferenceDate,
  getReferenceTitle,
} from './referenceFormat'
import type { ReferenceRowData } from './referenceTypes'

export function ReferenceRow({ reference }: { reference: ReferenceRowData }) {
  const title = getReferenceTitle(reference.title, reference.canonical_url)
  const collectedAt = reference.first_seen_at ?? reference.created_at

  return (
    <article className="grid gap-3 border-b border-[var(--color-border-soft)] px-4 py-3 last:border-b-0 md:grid-cols-[56px_minmax(0,1fr)_180px] md:items-center">
      <div className="flex items-start gap-3 md:block">
        {reference.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reference.thumbnail_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-[6px] border border-[var(--color-border-soft)] object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] text-[10px] font-semibold text-[var(--color-text-muted)]">
            REF
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/references/${reference.id}`}
            className="min-w-0 text-sm font-semibold text-[var(--color-text-primary)] outline-none hover:text-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]"
          >
            {title}
          </Link>
          <ReferenceStatusBadge status={reference.analysis_status} />
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text-secondary)]">
            {reference.platform}
          </span>
          <span>{formatReferenceDate(collectedAt)}</span>
          <span>출처 {reference.sourceCount}</span>
          {reference.latestSourceFolderName ? (
            <span>{reference.latestSourceFolderName}</span>
          ) : null}
          {reference.latestJobStatus ? (
            <span>작업 {reference.latestJobStatus}</span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-[var(--color-text-muted-soft)]">
          {compactUrl(reference.canonical_url)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:justify-end">
        <a
          href={reference.canonical_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-[5px] border border-[var(--color-border-default)] px-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
        >
          <ExternalLink size={13} />
          원본
        </a>
        <Link
          href={`/references/${reference.id}`}
          className="inline-flex h-8 items-center rounded-[5px] bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-[var(--color-bg-surface)] transition-colors hover:bg-[var(--color-text-body)]"
        >
          상세
        </Link>
      </div>
    </article>
  )
}
