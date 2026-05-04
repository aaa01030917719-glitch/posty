import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={clsx(
          'h-10 w-full rounded-[var(--radius-md)] border bg-[var(--color-bg-surface)] px-3 py-2 text-sm',
          'border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
          'outline-none transition-[background-color,border-color,color,box-shadow]',
          'focus-visible:border-[var(--color-accent)] focus-visible:[box-shadow:var(--focus-ring)]',
          'disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-muted)]',
          error && 'border-[var(--color-danger)] focus-visible:border-[var(--color-danger-hover)] focus-visible:[box-shadow:0_0_0_2px_color-mix(in_srgb,var(--color-danger)_16%,transparent)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
