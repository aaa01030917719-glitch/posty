'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import type { Script } from '@/lib/types'
import { CheckCircle, Pencil, Save } from 'lucide-react'

interface ScriptEditorProps {
  script: Script
  onSave?: (script: Script) => void
}

type ScriptFormData = {
  title: string
  body: string
  caption: string
  hashtags: string
  cta: string
  thumbnail_text: string
}

type ScriptUpdatePayload = Partial<
  Pick<
    Script,
    'title' | 'body' | 'caption' | 'hashtags' | 'cta' | 'thumbnail_text' | 'panel_title'
  >
>

const DEFAULT_PANEL_TITLE = '대본'
const PANEL_TITLE_MIN_WIDTH = 80
const PANEL_TITLE_MAX_WIDTH = 200

function getInitialFormState(script: Script): ScriptFormData {
  return {
    title: script.title ?? '',
    body: script.body ?? '',
    caption: script.caption ?? '',
    hashtags: script.hashtags ?? '',
    cta: script.cta ?? '',
    thumbnail_text: script.thumbnail_text ?? '',
  }
}

function normalizePanelTitle(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : DEFAULT_PANEL_TITLE
}

export function ScriptEditor({ script, onSave }: ScriptEditorProps) {
  const [data, setData] = useState<ScriptFormData>(() => getInitialFormState(script))
  const [panelTitle, setPanelTitle] = useState(() => normalizePanelTitle(script.panel_title))
  const [panelTitleDraft, setPanelTitleDraft] = useState(() => normalizePanelTitle(script.panel_title))
  const [editingPanelTitle, setEditingPanelTitle] = useState(false)
  const [panelTitleSaving, setPanelTitleSaving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const panelTitleInputRef = useRef<HTMLInputElement>(null)
  const panelTitleMeasureRef = useRef<HTMLSpanElement>(null)
  const committingPanelTitleRef = useRef(false)
  const saveFeedbackTimeoutRef = useRef<number | null>(null)

  const [panelTitleInputWidth, setPanelTitleInputWidth] = useState(PANEL_TITLE_MIN_WIDTH)

  useEffect(() => {
    const nextPanelTitle = normalizePanelTitle(script.panel_title)

    setData(getInitialFormState(script))
    setPanelTitle(nextPanelTitle)
    setPanelTitleDraft(nextPanelTitle)
    setEditingPanelTitle(false)
    setPanelTitleSaving(false)
    setSaved(false)
  }, [script])

  useEffect(() => {
    if (!editingPanelTitle) {
      return
    }

    panelTitleInputRef.current?.focus()
    panelTitleInputRef.current?.select()
  }, [editingPanelTitle])

  useEffect(() => {
    const measure = panelTitleMeasureRef.current

    if (!measure) {
      return
    }

    const nextWidth = Math.min(
      PANEL_TITLE_MAX_WIDTH,
      Math.max(PANEL_TITLE_MIN_WIDTH, Math.ceil(measure.getBoundingClientRect().width + 8))
    )

    setPanelTitleInputWidth(nextWidth)
  }, [editingPanelTitle, panelTitle, panelTitleDraft])

  useEffect(() => {
    return () => {
      if (saveFeedbackTimeoutRef.current) {
        window.clearTimeout(saveFeedbackTimeoutRef.current)
      }
    }
  }, [])

  const persistScript = async (payload: ScriptUpdatePayload) => {
    const supabase = createClient()
    const { data: updated, error } = await supabase
      .from('scripts')
      .update(payload as never)
      .eq('id', script.id)
      .select('*, card:content_cards(title, status)')
      .single()

    if (error) {
      console.error('Failed to update script', error)
      return null
    }

    const nextScript = updated as Script
    onSave?.(nextScript)
    return nextScript
  }

  const handleSave = async () => {
    setSaving(true)

    const updated = await persistScript(data)

    if (updated) {
      setData(getInitialFormState(updated))
      setPanelTitle(normalizePanelTitle(updated.panel_title))
      setPanelTitleDraft(normalizePanelTitle(updated.panel_title))
      setSaved(true)

      if (saveFeedbackTimeoutRef.current) {
        window.clearTimeout(saveFeedbackTimeoutRef.current)
      }

      saveFeedbackTimeoutRef.current = window.setTimeout(() => setSaved(false), 2000)
    }

    setSaving(false)
  }

  const startPanelTitleEdit = () => {
    if (saving || panelTitleSaving) {
      return
    }

    setPanelTitleDraft(panelTitle)
    setEditingPanelTitle(true)
  }

  const cancelPanelTitleEdit = () => {
    setPanelTitleDraft(panelTitle)
    setEditingPanelTitle(false)
  }

  const commitPanelTitle = async () => {
    if (committingPanelTitleRef.current) {
      return
    }

    committingPanelTitleRef.current = true
    setPanelTitleSaving(true)

    const nextPanelTitle = normalizePanelTitle(panelTitleDraft)

    if (nextPanelTitle === panelTitle) {
      setPanelTitleDraft(nextPanelTitle)
      setEditingPanelTitle(false)
      setPanelTitleSaving(false)
      committingPanelTitleRef.current = false
      return
    }

    const updated = await persistScript({ panel_title: nextPanelTitle })

    if (updated) {
      const savedPanelTitle = normalizePanelTitle(updated.panel_title)
      setPanelTitle(savedPanelTitle)
      setPanelTitleDraft(savedPanelTitle)
    } else {
      setPanelTitleDraft(panelTitle)
    }

    setEditingPanelTitle(false)
    setPanelTitleSaving(false)
    committingPanelTitleRef.current = false
  }

  const handlePanelTitleKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      await commitPanelTitle()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelPanelTitleEdit()
    }
  }

  const field = (
    label: string,
    key: keyof ScriptFormData,
    multiline = false,
    rows = 4
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#6B7280]">{label}</label>
      {multiline ? (
        <textarea
          value={data[key]}
          onChange={(event) => setData((prev) => ({ ...prev, [key]: event.target.value }))}
          rows={rows}
          className="w-full rounded-[8px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm outline-none transition-all placeholder-[#9CA3AF] resize-none focus:border-[#E8917E] focus:ring-2 focus:ring-[#E8917E]/10"
          placeholder={`${label} 입력`}
        />
      ) : (
        <input
          type="text"
          value={data[key]}
          onChange={(event) => setData((prev) => ({ ...prev, [key]: event.target.value }))}
          className="w-full rounded-[8px] border border-[#F0F0F0] bg-white px-3 py-2 text-sm outline-none transition-all placeholder-[#9CA3AF] focus:border-[#E8917E] focus:ring-2 focus:ring-[#E8917E]/10"
          placeholder={`${label} 입력`}
        />
      )}
    </div>
  )

  return (
    <section className="overflow-hidden rounded-[16px] border border-[#F0F0F0] bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-[#F0F0F0] px-6 py-4">
        <div className="relative min-w-0">
          <span
            ref={panelTitleMeasureRef}
            className="pointer-events-none absolute -left-[9999px] top-0 whitespace-pre text-lg font-semibold"
            aria-hidden="true"
          >
            {editingPanelTitle ? panelTitleDraft || DEFAULT_PANEL_TITLE : panelTitle}
          </span>

          {editingPanelTitle ? (
            <input
              ref={panelTitleInputRef}
              type="text"
              value={panelTitleDraft}
              onChange={(event) => setPanelTitleDraft(event.target.value)}
              onBlur={() => {
                void commitPanelTitle()
              }}
              onKeyDown={(event) => {
                void handlePanelTitleKeyDown(event)
              }}
              disabled={panelTitleSaving}
              className="min-w-[80px] max-w-[200px] border-0 border-b border-transparent bg-transparent px-0 py-0 text-lg font-semibold text-[#1A1A1A] outline-none transition-colors focus:border-b focus:border-[#E8917E]"
              style={{ width: `${panelTitleInputWidth}px` }}
              aria-label="대본 패널 제목"
            />
          ) : (
            <button
              type="button"
              onClick={startPanelTitleEdit}
              disabled={saving || panelTitleSaving}
              className="group inline-flex items-center gap-2 text-left text-[#1A1A1A] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="truncate text-lg font-semibold">{panelTitle}</span>
              <Pencil
                size={14}
                strokeWidth={1.9}
                className="text-[#9CA3AF] opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          )}
        </div>

        {!editingPanelTitle && (
          <Button onClick={handleSave} disabled={saving || panelTitleSaving}>
            {saved ? (
              <>
                <CheckCircle size={15} />
                저장됨
              </>
            ) : (
              <>
                <Save size={15} />
                {saving ? '저장 중...' : '저장'}
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-5 p-6">
        {field('제목', 'title')}
        {field('본문', 'body', true, 10)}
        {field('캡션', 'caption', true, 3)}
        {field('해시태그', 'hashtags')}
        {field('CTA', 'cta')}
        {field('썸네일 텍스트', 'thumbnail_text')}
      </div>
    </section>
  )
}
