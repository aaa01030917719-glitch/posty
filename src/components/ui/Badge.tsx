import { clsx } from 'clsx'

interface BadgeProps {
  label: string
  color?: string
  className?: string
}

export function Badge({ label, color, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={
        color
          ? {
              backgroundColor: `${color}20`,
              color,
            }
          : {
              backgroundColor: 'var(--color-bg-subtle)',
              color: 'var(--color-text-secondary)',
            }
      }
    >
      {label}
    </span>
  )
}
