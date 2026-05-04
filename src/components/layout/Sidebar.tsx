'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  LayoutGrid,
  FileText,
  Lightbulb,
  Network,
  BarChart2,
  LogOut,
} from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/schedule', label: '스케줄', icon: Calendar },
  { href: '/content', label: '콘텐츠', icon: LayoutGrid },
  { href: '/scripts', label: '원고', icon: FileText },
  { href: '/ideas', label: '아이디어', icon: Lightbulb },
  { href: '/mindmap', label: '마인드맵', icon: Network },
  { href: '/dashboard', label: '대시보드', icon: BarChart2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] md:flex">
      {/* Logo */}
      <div className="border-b border-[var(--color-border-default)] px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)]">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="text-base font-bold text-[var(--color-text-primary)]">Posty</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow]',
                'outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                active
                  ? 'bg-[var(--color-bg-accent-soft)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Icon
                size={17}
                className={active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-[var(--color-border-default)] px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-[background-color,color,box-shadow] hover:bg-[var(--color-bg-accent-soft)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
        >
          <LogOut size={17} strokeWidth={1.8} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
