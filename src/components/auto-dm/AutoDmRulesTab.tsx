'use client'

import { useEffect, useState } from 'react'
import { Edit3, LoaderCircle, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AutoDmRuleModal, type AutoDmRule, type ShareLinkOption } from './AutoDmRuleModal'

type AutoDmRulesTabProps = {
  canCreate: boolean
}

export function AutoDmRulesTab({ canCreate }: AutoDmRulesTabProps) {
  const [rules, setRules] = useState<AutoDmRule[]>([])
  const [shareLinks, setShareLinks] = useState<ShareLinkOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<AutoDmRule | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [rulesResponse, shareLinksResponse] = await Promise.all([
          fetch('/api/auto-dm/rules'),
          fetch('/api/auto-dm/share-links'),
        ])
        const rulesData = await rulesResponse.json() as { rules?: AutoDmRule[]; error?: string }
        const shareLinksData = await shareLinksResponse.json() as { shareLinks?: ShareLinkOption[]; error?: string }

        if (!rulesResponse.ok || !shareLinksResponse.ok) {
          throw new Error(rulesData.error ?? shareLinksData.error ?? '자동 DM 규칙을 불러오지 못했습니다')
        }

        if (!cancelled) {
          setRules(rulesData.rules ?? [])
          setShareLinks(shareLinksData.shareLinks ?? [])
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '자동 DM 규칙을 불러오지 못했습니다')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  function openCreate() {
    if (!canCreate) return
    setEditingRule(null)
    setModalOpen(true)
  }

  function openEdit(rule: AutoDmRule) {
    setEditingRule(rule)
    setModalOpen(true)
  }

  function handleSaved(rule: AutoDmRule) {
    setRules((current) => {
      const exists = current.some((item) => item.id === rule.id)
      return exists ? current.map((item) => item.id === rule.id ? rule : item) : [rule, ...current]
    })
  }

  async function toggleRule(rule: AutoDmRule) {
    if (updatingId) return
    setUpdatingId(rule.id)
    setError(null)

    try {
      const response = await fetch(`/api/auto-dm/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      const data = await response.json() as { rule?: AutoDmRule; error?: string }

      if (!response.ok || !data.rule) throw new Error(data.error ?? '규칙 상태를 변경하지 못했습니다')
      handleSaved(data.rule)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : '규칙 상태를 변경하지 못했습니다')
    } finally {
      setUpdatingId(null)
    }
  }

  async function deleteRule(rule: AutoDmRule) {
    if (!window.confirm('규칙을 삭제하면 복구할 수 없습니다. 잠시 멈추려면 비활성화를 이용해주세요')) return
    setUpdatingId(rule.id)
    setError(null)

    try {
      const response = await fetch(`/api/auto-dm/rules/${rule.id}`, { method: 'DELETE' })
      const data = await response.json() as { error?: string }

      if (!response.ok) throw new Error(data.error ?? '자동 DM 규칙을 삭제하지 못했습니다')
      setRules((current) => current.filter((item) => item.id !== rule.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '자동 DM 규칙을 삭제하지 못했습니다')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col items-end gap-1.5">
        <Button type="button" size="sm" disabled={!canCreate} onClick={openCreate} className="w-full sm:w-auto">
          <Plus size={14} />
          새 자동 DM 만들기
        </Button>
        {!canCreate ? <span className="text-[11px] text-[var(--color-text-muted)]">Instagram 계정 연결 후 규칙을 만들 수 있습니다</span> : null}
      </div>

      {error ? <p className="mb-3 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p> : null}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center border-y border-[var(--color-border-soft)] text-[var(--color-text-muted)]">
          <LoaderCircle className="animate-spin" size={18} />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center border-y border-[var(--color-border-soft)] px-4 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted-soft)]"><MessageCircle size={18} /></span>
          <h2 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">등록된 자동 DM 규칙이 없습니다</h2>
          <p className="mt-1 max-w-md text-xs leading-5 text-[var(--color-text-muted)]">Instagram 계정을 연결한 뒤 영상별 키워드와 공유자료를 등록할 수 있습니다</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border-soft)] border-y border-[var(--color-border-soft)]">
          {rules.map((rule) => (
            <article key={rule.id} className="grid gap-3 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <button type="button" role="switch" aria-checked={rule.enabled} disabled={updatingId === rule.id} onClick={() => toggleRule(rule)} className={`h-5 w-9 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] ${rule.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]'}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{rule.title}</h3>
                  <span className="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">{rule.mediaType === 'REEL' ? '릴스' : '게시물'}</span>
                </div>
                <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">미디어 {rule.mediaId} · 키워드 {rule.keyword}</p>
                <p className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">공유자료 {rule.shareMaterialTitle ?? '연결 해제됨'} · 최근 수정 {formatDate(rule.updatedAt)}</p>
              </div>
              <div className="flex gap-1 md:justify-end">
                <Button type="button" variant="ghost" size="sm" disabled={Boolean(updatingId)} onClick={() => openEdit(rule)} aria-label={`${rule.title} 수정`}><Edit3 size={14} /></Button>
                <Button type="button" variant="ghost" size="sm" disabled={Boolean(updatingId)} onClick={() => deleteRule(rule)} aria-label={`${rule.title} 삭제`}><Trash2 size={14} /></Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <AutoDmRuleModal isOpen={modalOpen} rule={editingRule} shareLinks={shareLinks} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
    </>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '확인되지 않음' : new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date)
}
