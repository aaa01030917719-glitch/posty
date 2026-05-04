'use client'

import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium',
        'border border-transparent transition-[background-color,border-color,color,box-shadow]',
        'outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed',
        {
          'bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] disabled:bg-[var(--color-accent-disabled)] disabled:text-[var(--color-on-accent)]': variant === 'primary',
          'border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-strong)] disabled:border-[var(--color-border-soft)] disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-muted)]': variant === 'secondary',
          'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] disabled:text-[var(--color-text-muted)]': variant === 'ghost',
          'bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-bg-surface))] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_16%,var(--color-bg-surface))] disabled:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] disabled:text-[var(--color-danger)] disabled:opacity-60': variant === 'danger',
          'px-3 py-1.5 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
