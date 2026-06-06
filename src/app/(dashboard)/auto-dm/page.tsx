'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, MessageCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { AutoDmEventsTab } from '@/components/auto-dm/AutoDmEventsTab'
import { AutoDmRulesTab } from '@/components/auto-dm/AutoDmRulesTab'
import { Button } from '@/components/ui/Button'

const TABS = [
  { id: 'rules', label: '자동 DM 규칙' },
  { id: 'history', label: '발송 이력' },
] as const

type TabId = (typeof TABS)[number]['id']

type InstagramConnectionStatus = {
  configured: boolean
  connected: boolean
  instagramUsername: string | null
  tokenExpiresAt: string | null
  connectedAt: string | null
}

const EMPTY_CONNECTION_STATUS: InstagramConnectionStatus = {
  configured: false,
  connected: false,
  instagramUsername: null,
  tokenExpiresAt: null,
  connectedAt: null,
}

const INSTAGRAM_QUERY_MESSAGES: Record<string, string> = {
  connected: 'Instagram 계정이 연결되었습니다',
  configuration_required: 'Instagram 연동 환경설정이 필요합니다',
  invalid_state: '연결 요청이 만료되었거나 유효하지 않습니다. 다시 시도해주세요',
  connection_failed: 'Instagram 계정을 연결하지 못했습니다. 잠시 후 다시 시도해주세요',
}

export default function AutoDmPage() {
  const [activeTab, setActiveTab] = useState<TabId>('rules')
  const [connection, setConnection] = useState(EMPTY_CONNECTION_STATUS)
  const [isConnectionLoading, setIsConnectionLoading] = useState(true)
  const [connectionLoadFailed, setConnectionLoadFailed] = useState(false)
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null)

  useEffect(() => {
    const instagramStatus = new URLSearchParams(window.location.search).get('instagram')
    setConnectionNotice(instagramStatus ? INSTAGRAM_QUERY_MESSAGES[instagramStatus] ?? null : null)

    let cancelled = false

    async function loadConnection() {
      try {
        const response = await fetch('/api/auto-dm/connection')
        const data = (await response.json()) as Partial<InstagramConnectionStatus>

        if (!response.ok) {
          throw new Error('Connection status request failed')
        }

        if (!cancelled) {
          setConnection({
            configured: data.configured === true,
            connected: data.connected === true,
            instagramUsername:
              typeof data.instagramUsername === 'string' ? data.instagramUsername : null,
            tokenExpiresAt:
              typeof data.tokenExpiresAt === 'string' ? data.tokenExpiresAt : null,
            connectedAt:
              typeof data.connectedAt === 'string' ? data.connectedAt : null,
          })
        }
      } catch {
        if (!cancelled) {
          setConnectionLoadFailed(true)
        }
      } finally {
        if (!cancelled) {
          setIsConnectionLoading(false)
        }
      }
    }

    void loadConnection()

    return () => {
      cancelled = true
    }
  }, [])

  const connectionBadge = isConnectionLoading
    ? '확인 중'
    : connectionLoadFailed
      ? '확인 필요'
      : !connection.configured
      ? '설정 필요'
      : connection.connected
        ? '연결됨'
        : '연결되지 않음'
  const connectionTitle = connectionLoadFailed
    ? 'Instagram 연결 상태를 확인할 수 없습니다'
    : !connection.configured
    ? 'Instagram 연동 설정이 필요합니다'
    : connection.connected
      ? `@${connection.instagramUsername ?? 'Instagram'} 계정이 연결되었습니다`
      : 'Instagram 계정을 연결해주세요'
  const connectionDescription = connectionLoadFailed
    ? '잠시 후 새로고침해 다시 확인해주세요'
    : !connection.configured
    ? '서버 환경설정을 완료하면 Instagram 계정을 연결할 수 있습니다'
    : connection.connected
      ? `연결일 ${formatDateTime(connection.connectedAt)} · 토큰 만료 ${formatDateTime(connection.tokenExpiresAt)}`
      : '자동 DM을 사용하려면 Instagram 프로페셔널 계정 연결이 필요합니다'

  function startInstagramConnection() {
    window.location.assign('/api/meta/instagram/oauth/start')
  }

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

      {connectionNotice ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          {connectionNotice}
        </p>
      ) : null}

      <section className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">
            {isConnectionLoading ? <LoaderCircle className="animate-spin" size={18} /> : <MessageCircle size={18} />}
          </span>
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
              {connectionBadge}
            </span>
            <h2 className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
              {connectionTitle}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              {connectionDescription}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <Button
            type="button"
            size="sm"
            disabled={isConnectionLoading || connectionLoadFailed || !connection.configured}
            onClick={startInstagramConnection}
            className="w-full sm:w-auto"
          >
            <MessageCircle size={14} />
            {connection.connected ? '다시 연결하기' : 'Instagram 연결하기'}
          </Button>
          {!connection.configured && !isConnectionLoading ? (
            <span className="text-[11px] text-[var(--color-text-muted-soft)]">
              Instagram 연동 환경설정이 필요합니다
            </span>
          ) : null}
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
            <AutoDmRulesTab canCreate={connection.connected && !connectionLoadFailed} />
          ) : (
            <AutoDmEventsTab />
          )}
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

function formatDateTime(value: string | null) {
  if (!value) return '확인되지 않음'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '확인되지 않음'

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
  }).format(date)
}
