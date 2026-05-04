'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { FileText } from 'lucide-react'
import { ScriptEditor } from '@/components/scripts/ScriptEditor'
import { createClient } from '@/lib/supabase/client'
import type { Script } from '@/lib/types'

const LIST_TITLE = '\uC2A4\uD06C\uB9BD\uD2B8 \uBAA9\uB85D'
const EMPTY_LIST_TITLE = '\uC2A4\uD06C\uB9BD\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'
const EMPTY_LIST_DESCRIPTION = '\uC5F0\uACB0\uB41C \uCF58\uD150\uCE20\uC5D0\uC11C \uC2A4\uD06C\uB9BD\uD2B8\uB97C \uD655\uC778\uD574\uBCF4\uC138\uC694'
const UNTITLED_LABEL = '\uC81C\uBAA9 \uC5C6\uC74C'
const EMPTY_EDITOR_TITLE = '\uC2A4\uD06C\uB9BD\uD2B8\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694'
const EMPTY_EDITOR_DESCRIPTION = '\uC67C\uCABD \uBAA9\uB85D\uC5D0\uC11C \uD3B8\uC9D1\uD560 \uC2A4\uD06C\uB9BD\uD2B8\uB97C \uACE0\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4'

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchScripts = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('scripts')
        .select('*, card:content_cards(title, status)')
        .order('updated_at', { ascending: false })

      setScripts((data as Script[]) ?? [])
      if (data && data.length > 0) {
        setSelectedScript(data[0] as Script)
      }
      setLoading(false)
    }

    fetchScripts()
  }, [])

  const handleSave = (updated: Script) => {
    setScripts((prev) => prev.map((script) => (script.id === updated.id ? updated : script)))
    setSelectedScript(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[var(--color-bg-canvas)] py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 gap-5 bg-[var(--color-bg-canvas)] p-5 md:p-6">
      <aside className="flex w-64 shrink-0 min-h-0 flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        <div className="border-b border-[var(--color-border-default)] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {LIST_TITLE}
          </p>
        </div>

        {scripts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
              <FileText size={18} />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_LIST_TITLE}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{EMPTY_LIST_DESCRIPTION}</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {scripts.map((script) => {
              const active = selectedScript?.id === script.id

              return (
                <button
                  key={script.id}
                  type="button"
                  onClick={() => setSelectedScript(script)}
                  className={clsx(
                    'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                    active
                      ? 'bg-[var(--color-bg-accent-soft)]'
                      : 'hover:bg-[var(--color-bg-canvas)]'
                  )}
                >
                  <FileText
                    size={14}
                    strokeWidth={1.8}
                    className={clsx(
                      'mt-0.5 shrink-0',
                      active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                    )}
                  />

                  <div className="min-w-0">
                    <p
                      className={clsx(
                        'truncate text-sm',
                        active
                          ? 'font-medium text-[var(--color-accent)]'
                          : 'text-[var(--color-text-primary)]'
                      )}
                    >
                      {script.title || script.card?.title || UNTITLED_LABEL}
                    </p>
                    {script.card && (
                      <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                        {(script.card as { title?: string }).title}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selectedScript ? (
          <ScriptEditor script={selectedScript} onSave={handleSave} />
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-24 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-accent-soft)] text-lg font-semibold text-[var(--color-accent)]">
              <FileText size={18} />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{EMPTY_EDITOR_TITLE}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{EMPTY_EDITOR_DESCRIPTION}</p>
          </div>
        )}
      </div>
    </div>
  )
}
