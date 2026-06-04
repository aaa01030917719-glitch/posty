'use client'

import { useState } from 'react'
import { History, MessageCircle, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'

const TABS = [
  { id: 'rules', label: '자동 DM 규칙' },
  { id: 'history', label: '발송 이력' },
] as const

type TabId = (typeof TABS)[number]['id']

const EMPTY_CONTENT = {
  rules: {
    icon: MessageCircle,
    title: '등록된 자동 DM 규칙이 없습니다',
    description: 'Instagram 계정을 연결한 뒤 영상별 키워드와 공유자료를 등록할 수 있습니다',
  },
  history: {
    icon: History,
    title: '발송 이력이 없습니다',
    description: '자동 DM이 실행되면 처리 결과가 여기에 표시됩니다',
  },
} as const

export default function AutoDmPage() {
  const [activeTab, setActiveTab] = useState<TabId>('rules')
  const emptyContent = EMPTY_CONTENT[activeTab]
  const EmptyIcon = emptyContent.icon

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <section className="space-y-1">
        <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
          자동 DM
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          댓글 키워드를 감지해 공유자료를 자동으로 전달합니다
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
            <MessageCircle size={18} />
          </span>
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
              연결되지 않음
            </span>
            <h2 className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
              Instagram 계정을 연결해주세요
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              자동 DM을 사용하려면 Instagram 프로페셔널 계정 연결이 필요합니다
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <Button type="button" size="sm" disabled className="w-full sm:w-auto">
            <MessageCircle size={14} />
            Instagram 연결하기
          </Button>
          <span className="text-[11px] text-[var(--color-text-muted-soft)]">연동 기능 준비 중</span>
        </div>
      </section>

      <section className="min-w-0">
        <div
          role="tablist"
          aria-label="자동 DM 보기"
          className="flex gap-1 border-b border-[var(--color-border-default)]"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`auto-dm-${tab.id}-panel`}
                id={`auto-dm-${tab.id}-tab`}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'relative px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:[box-shadow:var(--focus-ring)]',
                  active
                    ? 'text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                )}
              >
                {tab.label}
                <span
                  className={clsx(
                    'absolute inset-x-2 bottom-[-1px] h-0.5 bg-[var(--color-accent)] transition-opacity',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </button>
            )
          })}
        </div>

        <div
          role="tabpanel"
          id={`auto-dm-${activeTab}-panel`}
          aria-labelledby={`auto-dm-${activeTab}-tab`}
          className="pt-4"
        >
          {activeTab === 'rules' ? (
            <div className="mb-4 flex justify-end">
              <Button type="button" size="sm" disabled className="w-full sm:w-auto">
                <Plus size={14} />
                새 자동 DM 만들기
              </Button>
            </div>
          ) : null}

          <div className="flex min-h-56 flex-col items-center justify-center border-y border-[var(--color-border-soft)] px-4 py-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted-soft)]">
              <EmptyIcon size={18} />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
              {emptyContent.title}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-5 text-[var(--color-text-muted)]">
              {emptyContent.description}
            </p>
          </div>
        </div>
      </section>

      <section className="border-l-2 border-[var(--color-border-strong)] pl-4">
        <h2 className="text-xs font-semibold text-[var(--color-text-secondary)]">자동 DM 운영 방식</h2>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--color-text-muted)]">
          <li>영상 1개당 키워드 1개를 등록할 수 있습니다</li>
          <li>댓글 감지 후 DM을 보내고, 성공하면 댓글에도 안내 답글을 남깁니다</li>
          <li>자료는 팔로우 확인 후 전달됩니다</li>
        </ul>
      </section>
    </div>
  )
}
