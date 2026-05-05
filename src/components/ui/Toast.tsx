interface ToastProps {
  badgeLabel?: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function Toast({
  badgeLabel = 'NEW',
  message,
  actionLabel = '확인',
  onAction,
}: ToastProps) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-50 w-full max-w-fit -translate-x-1/2 px-4">
      <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-[color:color-mix(in_srgb,var(--color-success)_34%,white)] bg-white px-3 py-2 shadow-[0_14px_32px_rgba(20,174,92,0.14)]">
        <span className="inline-flex h-7 items-center rounded-full border border-[color:color-mix(in_srgb,var(--color-success)_22%,white)] bg-[color:color-mix(in_srgb,var(--color-success)_12%,white)] px-2.5 text-[10px] font-bold tracking-[0.08em] text-[var(--color-success)]">
          {badgeLabel}
        </span>
        <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{message}</p>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-7 items-center rounded-full border border-[color:color-mix(in_srgb,var(--color-success)_18%,white)] bg-[color:color-mix(in_srgb,var(--color-success)_8%,white)] px-3 text-[11px] font-semibold text-[var(--color-success)] transition-[background-color,border-color,color,box-shadow] hover:bg-[color:color-mix(in_srgb,var(--color-success)_12%,white)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
