'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/schedule': '스케줄',
  '/content': '콘텐츠',
  '/scripts': '원고',
  '/ideas': '아이디어',
  '/mindmap': '마인드맵',
  '/dashboard': '대시보드',
}

export function Header() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'Posty'

  return (
    <header className="h-14 bg-white border-b border-[#F0F0F0] flex items-center px-6 shrink-0">
      <h1 className="text-base font-semibold text-[#1A1A1A]">{title}</h1>
    </header>
  )
}
