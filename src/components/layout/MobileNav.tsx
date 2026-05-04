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
  { href: '/schedule', label: '스케줄', icon: Calendar },
  { href: '/content', label: '콘텐츠', icon: LayoutGrid },
  { href: '/scripts', label: '원고', icon: FileText },
  { href: '/ideas', label: '아이디어', icon: Lightbulb },
  { href: '/mindmap', label: '맵', icon: Network },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#F0F0F0] flex items-center z-40 safe-area-bottom">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-all',
              active ? 'text-[#E8917E]' : 'text-[#9CA3AF]'
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
