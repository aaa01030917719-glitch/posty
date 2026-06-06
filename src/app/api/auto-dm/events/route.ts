import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type EventRow = Record<string, unknown> & {
  rule?: { title?: string | null; keyword?: string | null } | { title?: string | null; keyword?: string | null }[] | null
}

function safeEvent(event: EventRow) {
  const rule = Array.isArray(event.rule) ? event.rule[0] : event.rule

  return {
    id: event.id,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    ruleId: event.rule_id,
    ruleTitle: rule?.title ?? null,
    keyword: rule?.keyword ?? null,
    mediaId: event.media_id,
    commentId: event.comment_id,
    commenterUsername: event.commenter_username,
    commentText: event.comment_text,
    lifecycleStatus: event.lifecycle_status,
    initialReplyStatus: event.initial_reply_status,
    publicReplyStatus: event.public_reply_status,
    followStatus: event.follow_status,
    deliveryStatus: event.delivery_status,
    initialPrivateReplySentAt: event.initial_private_reply_sent_at,
    publicCommentReplySentAt: event.public_comment_reply_sent_at,
    userRepliedAt: event.user_replied_at,
    followCheckedAt: event.follow_checked_at,
    materialSentAt: event.material_sent_at,
    failureStage: event.failure_stage,
    failureCode: event.failure_code,
    failureReason: event.failure_reason,
    attemptCount: event.attempt_count,
  }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('instagram_auto_dm_events')
    .select(`
      id,
      created_at,
      updated_at,
      rule_id,
      media_id,
      comment_id,
      commenter_username,
      comment_text,
      lifecycle_status,
      initial_reply_status,
      public_reply_status,
      follow_status,
      delivery_status,
      initial_private_reply_sent_at,
      public_comment_reply_sent_at,
      user_replied_at,
      follow_checked_at,
      material_sent_at,
      failure_stage,
      failure_code,
      failure_reason,
      attempt_count,
      rule:instagram_auto_dm_rules(title,keyword)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: '발송 이력을 불러오지 못했습니다' }, { status: 500 })
  }

  return NextResponse.json({ events: (data ?? []).map((event) => safeEvent(event as EventRow)) })
}
