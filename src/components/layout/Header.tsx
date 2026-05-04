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
    <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6">
      <h1 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h1>
    </header>
  )
}
