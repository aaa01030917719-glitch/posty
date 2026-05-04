'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { IdeaBoard } from '@/components/ideas/IdeaBoard'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import type { Idea, ChannelType } from '@/lib/types'
import { CHANNEL_TYPE_LABELS } from '@/lib/constants'

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', channel_type: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchIdeas()
  }, [])

  const fetchIdeas = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('ideas')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    setIdeas((data as Idea[]) ?? [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('ideas')
      .insert({
        user_id: user.id,
        title: form.title,
        body: form.body || null,
        channel_type: (form.channel_type as ChannelType) || null,
      } as never)
      .select()
      .single()
    if (data) {
      setIdeas((prev) => [data as Idea, ...prev])
      setForm({ title: '', body: '', channel_type: '' })
      setShowCreate(false)
    }
    setSaving(false)
  }

  const handleArchive = async (idea: Idea) => {
    const supabase = createClient()
    await supabase.from('ideas').update({ is_archived: true } as never).eq('id', idea.id)
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id))
  }

  const handleConvert = async (idea: Idea) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: card } = await supabase
      .from('content_cards')
      .insert({
        user_id: user.id,
        title: idea.title,
        memo: idea.body,
        status: 'idea',
        idea_id: idea.id,
      } as never)
      .select()
      .single()
    if (card) {
      const cardData = card as { id: string }
      await supabase.from('ideas').update({ converted_card_id: cardData.id } as never).eq('id', idea.id)
      setIdeas((prev) =>
        prev.map((i) => (i.id === idea.id ? { ...i, converted_card_id: cardData.id } : i))
      )
    }
  }

  return (
    <div className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div />
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          새 아이디어
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 border-2 border-[#E8917E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <IdeaBoard ideas={ideas} onConvert={handleConvert} onArchive={handleArchive} />
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="새 아이디어"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            id="idea-title"
            label="제목"
            placeholder="아이디어 제목"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">내용</label>
            <textarea
              rows={4}
              placeholder="아이디어 내용을 자유롭게 적어보세요"
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-[#F0F0F0] rounded-[8px] outline-none focus:border-[#E8917E] focus:ring-2 focus:ring-[#E8917E]/10 resize-none placeholder-[#9CA3AF]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A1A]">채널</label>
            <select
              value={form.channel_type}
              onChange={(e) => setForm((p) => ({ ...p, channel_type: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-[#F0F0F0] rounded-[8px] outline-none focus:border-[#E8917E] bg-white text-[#1A1A1A]"
            >
              <option value="">선택 안함</option>
              {Object.entries(CHANNEL_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={saving || !form.title.trim()}>
              {saving ? '저장 중...' : '추가'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
