'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

type ReferenceSettings = {
  is_auto_analysis_paused: boolean
  daily_submission_limit: number
  timezone: string
  estimated_credit_min: number
  estimated_credit_max: number
}

type LinkkoFolderSetting = {
  id: string
  folder_name: string
  is_enabled: boolean
  auto_analyze_new_links: boolean
}

type SettingsResponse = {
  settings: ReferenceSettings
  todaySubmissionCount: number
  dailySubmissionLimit: number
  estimatedCredits: {
    min: number
    max: number
  }
  folders: LinkkoFolderSetting[]
}

export function ReferenceSettingsPanel() {
  const [data, setData] = useState<SettingsResponse | null>(null)
  const [limitDraft, setLimitDraft] = useState('5')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function loadSettings() {
    setError(null)
    const response = await fetch('/api/references/settings', { cache: 'no-store' })

    if (!response.ok) {
      setError('설정을 불러오지 못했습니다.')
      return
    }

    const payload = await response.json() as SettingsResponse
    setData(payload)
    setLimitDraft(String(payload.settings.daily_submission_limit))
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  function patchSettings(body: Partial<ReferenceSettings>) {
    void (async () => {
      setError(null)
      setIsSaving(true)
      const response = await fetch('/api/references/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error ?? '설정을 저장하지 못했습니다.')
        setIsSaving(false)
        return
      }

      await loadSettings()
      setIsSaving(false)
    })()
  }

  function patchFolder(folderId: string, autoAnalyzeNewLinks: boolean) {
    void (async () => {
      setError(null)
      setIsSaving(true)
      const response = await fetch(`/api/references/settings/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ autoAnalyzeNewLinks }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error ?? '폴더 설정을 저장하지 못했습니다.')
        setIsSaving(false)
        return
      }

      await loadSettings()
      setIsSaving(false)
    })()
  }

  if (!data && !error) {
    return (
      <p className="rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
        설정을 불러오는 중입니다.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-[6px] border border-[color-mix(in_srgb,var(--color-danger)_30%,var(--color-border-default))] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="space-y-3 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  자동 분석 상태
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  링크 수집은 계속되며 Manus 자동 분석만 멈춥니다.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={data.settings.is_auto_analysis_paused}
                  onChange={(event) =>
                    patchSettings({ is_auto_analysis_paused: event.target.checked })
                  }
                  disabled={isSaving}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                자동 분석 일시정지
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                하루 분석 제출 상한
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                비용 보호를 위해 하루 최대 제출 건수를 제한합니다.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                <span className="block">상한</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={limitDraft}
                  onChange={(event) => setLimitDraft(event.target.value)}
                  className="mt-1 h-9 w-32 rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus-visible:[box-shadow:var(--focus-ring)]"
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isSaving}
                onClick={() => patchSettings({ daily_submission_limit: Number(limitDraft) })}
              >
                저장
              </Button>
              <p className="text-sm text-[var(--color-text-muted)]">
                오늘 {data.todaySubmissionCount} / {data.dailySubmissionLimit}건 제출
              </p>
            </div>
          </section>

          <section className="space-y-2 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              예상 credits
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Reel 1건 예상 약 {data.estimatedCredits.min}~{data.estimatedCredits.max} credits
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              실제 사용량은 영상 길이와 난이도에 따라 달라질 수 있습니다.
            </p>
          </section>

          <section className="space-y-3 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                현재 연결된 Linkko 폴더
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                자동 분석은 신규 링크부터 적용됩니다. 기존 링크는 별도의 가져오기 기능으로 분석합니다.
              </p>
            </div>

            {data.folders.length > 0 ? (
              <div className="divide-y divide-[var(--color-border-soft)]">
                {data.folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {folder.folder_name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {folder.is_enabled ? '수집 연결됨' : '수집 해제됨'}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={folder.auto_analyze_new_links}
                        disabled={isSaving || !folder.is_enabled}
                        onChange={(event) => patchFolder(folder.id, event.target.checked)}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                      신규 링크 자동 분석
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-[6px] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)] px-3 py-3 text-sm text-[var(--color-text-muted)]">
                연결된 Linkko 폴더가 없습니다.
              </p>
            )}
          </section>

          <section className="space-y-2 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              기존 링크 가져오기
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              기존 링크 분석은 Backfill 기능 연결 후 사용할 수 있습니다.
            </p>
            <Button type="button" variant="secondary" size="sm" disabled>
              준비 중
            </Button>
          </section>
        </>
      ) : null}
    </div>
  )
}
