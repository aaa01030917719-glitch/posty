'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar,
  LayoutGrid,
  FileText,
  Share2,
  Library,
  Lightbulb,
  Network,
  History,
  BarChart2,
  LogOut,
  MessageCircle,
  Trash2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/schedule', label: '\uC77C\uC815', icon: Calendar },
  { href: '/content', label: '\uCF58\uD150\uCE20', icon: LayoutGrid },
  { href: '/reels-analytics', label: '\uB9B4\uC2A4 \uBD84\uC11D', icon: BarChart2 },
  { href: '/ideas', label: '\uC544\uC774\uB514\uC5B4', icon: Lightbulb },
  { href: '/share-materials', label: '\uACF5\uC720 \uC790\uB8CC', icon: Share2 },
  { href: '/references', label: '\uB798\uD37C\uB7F0\uC2A4', icon: Library },
  { href: '/auto-dm', label: '\uC790\uB3D9 DM', icon: MessageCircle },
  { href: '/timeline', label: '\uD0C0\uC784\uB77C\uC778', icon: History },
  { href: '/trash', label: '\uD734\uC9C0\uD1B5', icon: Trash2 },
  { href: '/scripts', label: '\uC2A4\uD06C\uB9BD\uD2B8', icon: FileText },
  { href: '/mindmap', label: '\uB9C8\uC778\uB4DC\uB9F5', icon: Network },
  { href: '/dashboard', label: '\uB300\uC2DC\uBCF4\uB4DC', icon: BarChart2 },
]

const LOGOUT_LABEL = '\uB85C\uADF8\uC544\uC6C3'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const avatarText = 'ME'

  return (
    <aside className="hidden h-full w-[168px] shrink-0 flex-col border-r border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] md:flex">
      <div className="px-3 pb-2.5 pt-4">
        <Link
          href="/schedule"
          className="flex items-center gap-2 rounded-[5px] outline-none transition-[background-color,box-shadow] hover:bg-[var(--color-bg-surface-soft)] focus-visible:[box-shadow:var(--focus-ring)]"
          aria-label="Posty 홈으로 이동"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--color-accent)]">
            <span className="text-[11px] font-bold text-[var(--color-on-accent)]">P</span>
          </div>
          <span className="text-sm font-bold tracking-[-0.02em] text-[var(--color-text-primary)]">
            Posty
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')

          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'mb-px flex items-center gap-2 rounded-[5px] px-2 py-1.5 transition-[background-color,color,box-shadow] outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                active
                  ? 'bg-[var(--color-bg-surface-soft)]'
                  : 'hover:bg-[var(--color-bg-surface-soft)]'
              )}
            >
              <Icon
                size={14}
                className={active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted-soft)]'}
                strokeWidth={1.8}
              />
              <span
                className={clsx(
                  'text-[12.5px]',
                  active
                    ? 'font-semibold text-[var(--color-text-primary)]'
                    : 'font-medium text-[var(--color-text-secondary)]'
                )}
              >
                {label}
              </span>
              <span
                className={clsx(
                  'ml-auto h-3 w-[2px] rounded-[1px] bg-[var(--color-accent)]',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--color-bg-surface-strong)] px-2 py-2.5">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-[5px] px-2 py-[7px] text-left transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-surface-soft)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
          aria-label={LOGOUT_LABEL}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-text-body)] text-[9.5px] font-semibold text-[var(--color-on-accent)]">
            {avatarText}
          </span>
          <span className="min-w-0 flex-1 text-[12px] font-medium text-[var(--color-text-body)]">
            {LOGOUT_LABEL}
          </span>
          <LogOut size={14} strokeWidth={1.8} className="shrink-0 text-[var(--color-text-muted-soft)]" />
        </button>
      </div>
    </aside>
  )
}
