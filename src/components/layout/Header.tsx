'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/schedule': '\uC77C\uC815',
  '/content': '\uCF58\uD150\uCE20',
  '/scripts': '\uC2A4\uD06C\uB9BD\uD2B8',
  '/ideas': '\uC544\uC774\uB514\uC5B4',
  '/mindmap': '\uB9C8\uC778\uB4DC\uB9F5',
  '/dashboard': '\uB300\uC2DC\uBCF4\uB4DC',
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
