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
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        className
      )}
      style={color ? {
        backgroundColor: `${color}20`,
        color: color,
      } : {
        backgroundColor: '#F3F4F6',
        color: '#6B7280',
      }}
    >
      {label}
    </span>
  )
}
