import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  InstagramMetaError,
  replyToInstagramComment,
  sendInstagramPrivateReply,
} from './meta-client'
import { decryptInstagramAccessToken } from './token-crypto'

export type InitialPrivateReplyDeliveryResult =
  | { status: 'disabled' }
  | { status: 'private_reply_sent_and_public_reply_sent' }
  | { status: 'private_reply_sent_public_reply_failed' }
  | { status: 'private_reply_failed' }
  | { status: 'skipped_already_processed' }
  | { status: 'skipped_rule_disabled' }
  | { status: 'skipped_missing_data' }
  | { status: 'failed' }

type AutoDmEventRow = {
  id: string
  instagram_connection_id: string | null
  rule_id: string | null
  comment_id: string
  initial_reply_status: string
  initial_private_reply_message_id: string | null
}

type AutoDmRuleRow = {
  id: string
  instagram_connection_id: string
  enabled: boolean
  initial_private_reply_message: string
  public_comment_reply_message: string
}

type InstagramConnectionRow = {
  id: string
  instagram_professional_account_id: string
}

type InstagramConnectionSecretRow = {
  access_token_ciphertext: string
}

const FAILURE_REASON_BY_CODE: Record<string, string> = {
  missing_data: 'Required auto DM delivery data is missing',
  token_decrypt_failed: 'Instagram access token could not be decrypted',
  private_reply_failed: 'Instagram private reply request failed',
  public_comment_reply_failed: 'Instagram public comment reply request failed',
  database_error: 'Auto DM delivery database update failed',
}

export function isInstagramAutoDmSendEnabled() {
  return process.env.INSTAGRAM_AUTO_DM_SEND_ENABLED === 'true'
}

export async function processInitialPrivateReplyAndPublicCommentReply(
  eventId: string
): Promise<InitialPrivateReplyDeliveryResult> {
  if (!isInstagramAutoDmSendEnabled()) {
    return { status: 'disabled' }
  }

  const admin = createAdminClient()
  const { event, rule, connection, secret, failed } = await loadDeliveryContext(eventId)

  if (failed) {
    return { status: 'failed' }
  }

  if (!event || !event.instagram_connection_id || !event.rule_id || !event.comment_id) {
    await markDeliveryFailed(eventId, 'initial_private_reply', 'missing_data')
    return { status: 'skipped_missing_data' }
  }

  if (event.initial_reply_status !== 'pending' || event.initial_private_reply_message_id) {
    return { status: 'skipped_already_processed' }
  }

  if (!rule || !connection || !secret) {
    await markDeliveryFailed(event.id, 'initial_private_reply', 'missing_data')
    return { status: 'skipped_missing_data' }
  }

  if (!rule.enabled) {
    return { status: 'skipped_rule_disabled' }
  }

  if (rule.instagram_connection_id !== event.instagram_connection_id) {
    await markDeliveryFailed(event.id, 'initial_private_reply', 'missing_data')
    return { status: 'skipped_missing_data' }
  }

  const token = decryptDeliveryToken(secret.access_token_ciphertext)

  if (!token) {
    await markDeliveryFailed(event.id, 'initial_private_reply', 'token_decrypt_failed')
    return { status: 'failed' }
  }

  const attemptUpdated = await incrementAttemptCount(event.id)

  if (!attemptUpdated) {
    return { status: 'failed' }
  }

  try {
    const privateReply = await sendInstagramPrivateReply({
      instagramProfessionalAccountId: connection.instagram_professional_account_id,
      commentId: event.comment_id,
      messageText: rule.initial_private_reply_message,
      accessToken: token,
    })

    const { error } = await admin
      .from('instagram_auto_dm_events')
      .update({
        initial_reply_status: 'sent',
        initial_private_reply_message_id: privateReply.messageId,
        initial_private_reply_sent_at: new Date().toISOString(),
        lifecycle_status: 'waiting_for_user_reply',
        failure_stage: null,
        failure_code: null,
        failure_reason: null,
      })
      .eq('id', event.id)

    if (error) {
      return { status: 'failed' }
    }
  } catch (error) {
    await markDeliveryFailed(
      event.id,
      'initial_private_reply',
      safeFailureCode(error, 'private_reply_failed')
    )
    return { status: 'private_reply_failed' }
  }

  const { error: pendingError } = await admin
    .from('instagram_auto_dm_events')
    .update({ public_reply_status: 'pending' })
    .eq('id', event.id)

  if (pendingError) {
    return { status: 'failed' }
  }

  try {
    const publicReply = await replyToInstagramComment({
      commentId: event.comment_id,
      messageText: rule.public_comment_reply_message,
      accessToken: token,
    })

    const { error } = await admin
      .from('instagram_auto_dm_events')
      .update({
        public_reply_status: 'sent',
        public_comment_reply_id: publicReply.replyId,
        public_comment_reply_sent_at: new Date().toISOString(),
        failure_stage: null,
        failure_code: null,
        failure_reason: null,
      })
      .eq('id', event.id)

    if (error) {
      return { status: 'failed' }
    }

    return { status: 'private_reply_sent_and_public_reply_sent' }
  } catch (error) {
    await markPublicReplyFailed(event.id, safeFailureCode(error, 'public_comment_reply_failed'))
    return { status: 'private_reply_sent_public_reply_failed' }
  }
}

async function loadDeliveryContext(eventId: string) {
  const admin = createAdminClient()
  const { data: event, error: eventError } = await admin
    .from('instagram_auto_dm_events')
    .select('id,instagram_connection_id,rule_id,comment_id,initial_reply_status,initial_private_reply_message_id')
    .eq('id', eventId)
    .maybeSingle<AutoDmEventRow>()

  if (eventError) {
    return { failed: true as const }
  }

  const [ruleResult, connectionResult, secretResult] = await Promise.all([
    event?.rule_id
      ? admin
          .from('instagram_auto_dm_rules')
          .select('id,instagram_connection_id,enabled,initial_private_reply_message,public_comment_reply_message')
          .eq('id', event.rule_id)
          .maybeSingle<AutoDmRuleRow>()
      : Promise.resolve({ data: null, error: null }),
    event?.instagram_connection_id
      ? admin
          .from('instagram_connections')
          .select('id,instagram_professional_account_id')
          .eq('id', event.instagram_connection_id)
          .maybeSingle<InstagramConnectionRow>()
      : Promise.resolve({ data: null, error: null }),
    event?.instagram_connection_id
      ? admin
          .from('instagram_connection_secrets')
          .select('access_token_ciphertext')
          .eq('instagram_connection_id', event.instagram_connection_id)
          .maybeSingle<InstagramConnectionSecretRow>()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (ruleResult.error || connectionResult.error || secretResult.error) {
    return { failed: true as const }
  }

  return {
    failed: false as const,
    event: event ?? null,
    rule: ruleResult.data ?? null,
    connection: connectionResult.data ?? null,
    secret: secretResult.data ?? null,
  }
}

async function incrementAttemptCount(eventId: string) {
  const admin = createAdminClient()
  const { data: event, error: readError } = await admin
    .from('instagram_auto_dm_events')
    .select('attempt_count')
    .eq('id', eventId)
    .maybeSingle<{ attempt_count: number }>()

  if (readError || !event) {
    return false
  }

  const { error: updateError } = await admin
    .from('instagram_auto_dm_events')
    .update({ attempt_count: event.attempt_count + 1 })
    .eq('id', eventId)

  return !updateError
}

async function markDeliveryFailed(eventId: string, stage: string, code: string) {
  const admin = createAdminClient()

  await admin
    .from('instagram_auto_dm_events')
    .update({
      initial_reply_status: 'failed',
      public_reply_status: 'not_attempted',
      lifecycle_status: 'failed',
      failure_stage: stage,
      failure_code: code,
      failure_reason: FAILURE_REASON_BY_CODE[code] ?? 'Auto DM delivery failed',
    })
    .eq('id', eventId)
}

async function markPublicReplyFailed(eventId: string, code: string) {
  const admin = createAdminClient()

  await admin
    .from('instagram_auto_dm_events')
    .update({
      public_reply_status: 'failed',
      lifecycle_status: 'waiting_for_user_reply',
      failure_stage: 'public_comment_reply',
      failure_code: code,
      failure_reason: FAILURE_REASON_BY_CODE[code] ?? 'Auto DM public comment reply failed',
    })
    .eq('id', eventId)
}

function decryptDeliveryToken(ciphertext: string) {
  try {
    return decryptInstagramAccessToken(ciphertext)
  } catch {
    return null
  }
}

function safeFailureCode(error: unknown, fallback: string) {
  if (error instanceof InstagramMetaError) {
    return fallback
  }

  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return fallback
  }

  return fallback
}
