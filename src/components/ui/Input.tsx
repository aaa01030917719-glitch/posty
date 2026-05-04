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
        <label htmlFor={id} className="text-sm font-medium text-[#1A1A1A]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={clsx(
          'w-full px-3 py-2 text-sm bg-white border rounded-[8px] outline-none transition-all',
          'border-[#F0F0F0] placeholder-[#9CA3AF]',
          'focus:border-[#E8917E] focus:ring-2 focus:ring-[#E8917E]/10',
          error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
