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
        'inline-flex items-center justify-center gap-2 font-medium transition-all rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed',
        {
          'bg-[#E8917E] text-white hover:bg-[#d97d6a] active:bg-[#c8705f]': variant === 'primary',
          'bg-[#F5F5F5] text-[#1A1A1A] hover:bg-[#EBEBEB] border border-[#F0F0F0]': variant === 'secondary',
          'text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]': variant === 'ghost',
          'bg-red-50 text-red-600 hover:bg-red-100': variant === 'danger',
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
