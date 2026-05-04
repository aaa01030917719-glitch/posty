'use client'

import { useState, useEffect } from 'react'
import { ScriptEditor } from '@/components/scripts/ScriptEditor'
import { createClient } from '@/lib/supabase/client'
import type { Script } from '@/lib/types'
import { FileText } from 'lucide-react'

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
      if (data && data.length > 0) setSelectedScript(data[0] as Script)
      setLoading(false)
    }
    fetchScripts()
  }, [])

  const handleSave = (updated: Script) => {
    setScripts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedScript(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <div className="w-5 h-5 border-2 border-[#E8917E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Script list */}
      <div className="w-60 shrink-0 border-r border-[#F0F0F0] bg-white overflow-y-auto">
        <div className="px-4 py-4 border-b border-[#F0F0F0]">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">원고 목록</p>
        </div>
        {scripts.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-[#9CA3AF]">원고가 없습니다</p>
          </div>
        ) : (
          <div className="py-2">
            {scripts.map((script) => (
              <button
                key={script.id}
                onClick={() => setSelectedScript(script)}
                className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-2.5 ${
                  selectedScript?.id === script.id
                    ? 'bg-[#FDF0ED]'
                    : 'hover:bg-[#FAFAFA]'
                }`}
              >
                <FileText
                  size={14}
                  className={selectedScript?.id === script.id ? 'text-[#E8917E] mt-0.5' : 'text-[#9CA3AF] mt-0.5'}
                  strokeWidth={1.8}
                />
                <div className="min-w-0">
                  <p
                    className={`text-sm truncate ${
                      selectedScript?.id === script.id
                        ? 'font-medium text-[#E8917E]'
                        : 'text-[#1A1A1A]'
                    }`}
                  >
                    {script.title || script.card?.title || '제목 없음'}
                  </p>
                  {script.card && (
                    <p className="text-xs text-[#9CA3AF] truncate mt-0.5">
                      {(script.card as { title?: string }).title}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedScript ? (
          <ScriptEditor script={selectedScript} onSave={handleSave} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-24 text-center">
            <p className="text-3xl mb-3">✍️</p>
            <p className="text-sm text-[#9CA3AF]">원고를 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  )
}
