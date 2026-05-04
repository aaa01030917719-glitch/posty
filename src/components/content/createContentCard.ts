'use client'

import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types'

type ContentCardInsert = Database['public']['Tables']['content_cards']['Insert']

export async function createContentCard() {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user) {
    throw new Error('Authenticated user not found')
  }

  const { data: channels, error: channelsError } = await supabase
    .from('channels')
    .select('id, type')
    .order('created_at', { ascending: true })

  if (channelsError) {
    console.error('Failed to load channels for default content card', channelsError)
  }

  const defaultChannelId =
    channels?.find((channel) => channel.type === 'instagram')?.id ?? channels?.[0]?.id ?? null

  const payload: ContentCardInsert = {
    user_id: user.id,
    channel_id: defaultChannelId,
    title: '새 콘텐츠',
    format: null,
    status: 'idea',
    priority: 'normal',
    scheduled_at: null,
    published_at: null,
    memo: null,
    reference_url: null,
    checklist: [],
    idea_id: null,
  }

  const { data, error } = await supabase
    .from('content_cards')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    throw error
  }

  return data.id as string
}
