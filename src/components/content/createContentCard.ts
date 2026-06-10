'use client'

import { recordContentActivityLog } from '@/lib/content-activity-logs'
import { createClient } from '@/lib/supabase/client'
import type { ContentKind, Database } from '@/lib/types'

type ContentCardInsert = Database['public']['Tables']['content_cards']['Insert']

type CreateContentCardOptions = {
  title?: string
  channelId?: string | null
  contentKind?: ContentKind
  projectId?: string | null
  scheduledAt?: string | null
}

export async function createContentCard(options: CreateContentCardOptions = {}) {
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
    channel_id: options.channelId ?? defaultChannelId,
    title: options.title?.trim() || '새 콘텐츠',
    format: null,
    status: 'idea',
    content_kind: options.contentKind ?? 'content',
    priority: 'normal',
    scheduled_at: options.scheduledAt ?? null,
    published_at: null,
    memo: null,
    reference_url: null,
    checklist: [],
    idea_id: null,
    project_id: options.projectId ?? null,
  }

  const { data, error } = await supabase
    .from('content_cards')
    .insert(payload)
    .select('id, user_id, title, status, content_kind, project_id, channel_id, scheduled_at')
    .single()

  if (error) {
    throw error
  }

  try {
    await recordContentActivityLog(
      {
        user_id: data.user_id,
        card_id: data.id,
        project_id: data.project_id,
        action: 'content_created',
        title: data.title,
        description: '콘텐츠를 생성했습니다',
        metadata: {
          status: data.status,
          project_id: data.project_id,
          channel_id: data.channel_id,
          scheduled_at: data.scheduled_at,
          source: 'content_creation',
        },
      },
      supabase
    )
  } catch (activityLogError) {
    console.warn('Failed to record content creation activity log', activityLogError)
  }

  return data.id as string
}
