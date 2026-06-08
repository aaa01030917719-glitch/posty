import { clsx } from 'clsx'
import {
  REFERENCE_STATUS_CLASSES,
  REFERENCE_STATUS_LABELS,
  isReferenceAnalysisStatus,
} from './referenceFormat'

export function ReferenceStatusBadge({ status }: { status: string }) {
  const normalized = isReferenceAnalysisStatus(status) ? status : 'pending'

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        REFERENCE_STATUS_CLASSES[normalized]
      )}
    >
      {REFERENCE_STATUS_LABELS[normalized]}
    </span>
  )
}
