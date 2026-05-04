import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Posty — 콘텐츠 운영 관리',
  description: '스마트한 콘텐츠 운영 관리 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)]">
        {children}
      </body>
    </html>
  )
}
