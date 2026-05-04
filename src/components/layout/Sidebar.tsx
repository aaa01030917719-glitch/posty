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
    <aside className="hidden md:flex flex-col w-56 h-full bg-white border-r border-[#F0F0F0] shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-[#E8917E] flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="text-base font-bold text-[#1A1A1A]">Posty</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm transition-all',
                active
                  ? 'bg-[#FDF0ED] text-[#E8917E] font-medium'
                  : 'text-[#6B7280] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]'
              )}
            >
              <Icon
                size={17}
                className={active ? 'text-[#E8917E]' : 'text-[#9CA3AF]'}
                strokeWidth={active ? 2.2 : 1.8}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[#F0F0F0]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-sm text-[#6B7280] hover:bg-[#FFF0EE] hover:text-[#E8917E] transition-all"
        >
          <LogOut size={17} strokeWidth={1.8} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
