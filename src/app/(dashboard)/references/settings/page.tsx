import Link from 'next/link'
import { ReferenceSettingsPanel } from '@/components/references/ReferenceSettingsPanel'

export default function ReferenceSettingsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <Link
        href="/references"
        className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        ← 래퍼런스 목록
      </Link>

      <section className="space-y-1">
        <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
          래퍼런스 분석 설정
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Manus 자동 분석 비용 보호와 Linkko 폴더별 신규 링크 분석 여부를 관리합니다.
        </p>
      </section>

      <ReferenceSettingsPanel />
    </div>
  )
}
