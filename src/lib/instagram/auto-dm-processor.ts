import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { InstagramCommentNotification } from './webhook'

export type AutoDmCommentProcessResult =
  | { status: 'matched'; eventId: string }
  | { status: 'ignored_connection_not_found' }
  | { status: 'ignored_rule_not_found' }
  | { status: 'ignored_keyword_not_matched' }
  | { status: 'ignored_owner_comment' }
  | { status: 'ignored_comment_reply' }
  | { status: 'duplicate_skipped' }
  | {
      status: 'failed'
      failureStage?: 'connection_lookup' | 'rule_lookup' | 'event_insert' | 'unexpected'
      failureCode?: string
    }

export async function processInstagramComment(
  notification: InstagramCommentNotification
): Promise<AutoDmCommentProcessResult> {
  try {
    const admin = createAdminClient()
    const { data: connection, error: connectionError } = await admin
      .from('instagram_connections')
      .select('id,user_id,instagram_professional_account_id')
      .eq('instagram_professional_account_id', notification.instagramProfessionalAccountId)
      .limit(1)
      .maybeSingle()

    if (connectionError) {
      return {
        status: 'failed',
        failureStage: 'connection_lookup',
        failureCode: connectionError.code,
      }
    }

    if (!connection) {
      return { status: 'ignored_connection_not_found' }
    }

    if (
      notification.commenterInstagramScopedId === connection.instagram_professional_account_id ||
      notification.commenterInstagramScopedId === notification.instagramProfessionalAccountId
    ) {
      return { status: 'ignored_owner_comment' }
    }

    if (notification.isReply) {
      return { status: 'ignored_comment_reply' }
    }

    const { data: rule, error: ruleError } = await admin
      .from('instagram_auto_dm_rules')
      .select('id,keyword,comment_trigger_mode')
      .eq('instagram_connection_id', connection.id)
      .eq('media_id', notification.mediaId)
      .eq('enabled', true)
      .maybeSingle()

    if (ruleError) {
      return {
        status: 'failed',
        failureStage: 'rule_lookup',
        failureCode: ruleError.code,
      }
    }

    if (!rule) {
      return { status: 'ignored_rule_not_found' }
    }

    const triggerMode = rule.comment_trigger_mode ?? 'keyword'

    if (
      triggerMode !== 'all_comments' &&
      !normalizeMatchText(notification.commentText).includes(normalizeMatchText(rule.keyword ?? ''))
    ) {
      return { status: 'ignored_keyword_not_matched' }
    }

    const { data: event, error: eventError } = await admin
      .from('instagram_auto_dm_events')
      .insert({
        user_id: connection.user_id,
        instagram_connection_id: connection.id,
        rule_id: rule.id,
        comment_id: notification.commentId,
        media_id: notification.mediaId,
        commenter_instagram_scoped_id: notification.commenterInstagramScopedId,
        commenter_username: notification.commenterUsername,
        comment_text: notification.commentText,
        lifecycle_status: 'keyword_matched',
        initial_reply_status: 'pending',
        public_reply_status: 'not_attempted',
        follow_status: 'unknown',
        delivery_status: 'not_ready',
      })
      .select('id')
      .single()

    if (eventError?.code === '23505') {
      return { status: 'duplicate_skipped' }
    }

    if (eventError || !event) {
      return {
        status: 'failed',
        failureStage: 'event_insert',
        failureCode: eventError?.code,
      }
    }

    return { status: 'matched', eventId: event.id }
  } catch {
    return { status: 'failed', failureStage: 'unexpected' }
  }
}

function normalizeMatchText(value: string) {
  return value.trim().toLowerCase()
}
