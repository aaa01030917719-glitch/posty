'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  LayoutGrid,
  FileText,
  Lightbulb,
  Network,
} from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { href: '/schedule', label: '\uC77C\uC815', icon: Calendar },
  { href: '/content', label: '\uCF58\uD150\uCE20', icon: LayoutGrid },
  { href: '/scripts', label: '\uC2A4\uD06C\uB9BD\uD2B8', icon: FileText },
  { href: '/ideas', label: '\uC544\uC774\uB514\uC5B4', icon: Lightbulb },
  { href: '/mindmap', label: '\uB9C8\uC778\uB4DC\uB9F5', icon: Network },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-40 flex items-center gap-1 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 pt-1.5 md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-lg)] px-2 py-2 text-[10px] font-medium transition-[background-color,color,box-shadow]',
              'outline-none focus-visible:[box-shadow:var(--focus-ring)]',
              active
                ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
