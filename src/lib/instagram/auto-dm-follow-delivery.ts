import 'server-only'

import { createPublicContentShareUrl } from '@/lib/content-share-url'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InstagramMessagingNotification } from './webhook'
import {
  getInstagramUserProfile,
  InstagramMetaError,
  sendInstagramTextMessage,
} from './meta-client'
import { isInstagramAutoDmSendEnabled } from './auto-dm-delivery'
import { decryptInstagramAccessToken } from './token-crypto'

const FOLLOW_CONFIRMATION_TEXT = '팔로우완료'

export type FollowConfirmationDeliveryResult =
  | { status: 'disabled' }
  | { status: 'ignored_message_text' }
  | { status: 'ignored_connection_not_found' }
  | { status: 'ignored_waiting_event_not_found' }
  | { status: 'skipped_already_delivered' }
  | { status: 'waiting_for_follow' }
  | { status: 'material_sent' }
  | { status: 'follow_check_failed' }
  | { status: 'material_send_failed' }
  | { status: 'share_link_unavailable' }
  | { status: 'failed' }

type InstagramConnectionRow = {
  id: string
  instagram_professional_account_id: string
}

type InstagramConnectionSecretRow = {
  access_token_ciphertext: string
}

type WaitingEventRow = {
  id: string
  user_id: string
  instagram_connection_id: string | null
  rule_id: string | null
  commenter_instagram_scoped_id: string
  delivery_status: string
  lifecycle_status: string
}

type AutoDmRuleRow = {
  id: string
  user_id: string
  instagram_connection_id: string
  share_link_id: string | null
  follow_required_message: string
  material_delivery_message: string
}

type ShareLinkRow = {
  id: string
  token: string
  is_enabled: boolean
  disabled_at: string | null
  expires_at: string | null
  card: { is_deleted: boolean } | { is_deleted: boolean }[] | null
}

const FAILURE_REASON_BY_CODE: Record<string, string> = {
  missing_data: 'Required auto DM follow confirmation data is missing',
  token_decrypt_failed: 'Instagram access token could not be decrypted',
  follow_check_failed: 'Instagram user follow status could not be checked',
  follow_required_message_failed: 'Instagram follow-required message request failed',
  share_link_unavailable: 'Posty share material link is unavailable',
  public_base_url_missing: 'Posty public base URL is not configured',
  material_delivery_failed: 'Instagram material delivery message request failed',
  database_error: 'Auto DM follow confirmation database update failed',
}

export async function processFollowConfirmationMessage(
  notification: InstagramMessagingNotification
): Promise<FollowConfirmationDeliveryResult> {
  if (!isInstagramAutoDmSendEnabled()) {
    return { status: 'disabled' }
  }

  if (notification.messageText.trim() !== FOLLOW_CONFIRMATION_TEXT) {
    return { status: 'ignored_message_text' }
  }

  const admin = createAdminClient()
  const { data: connection, error: connectionError } = await admin
    .from('instagram_connections')
    .select('id,instagram_professional_account_id')
    .eq('instagram_professional_account_id', notification.instagramProfessionalAccountId)
    .maybeSingle<InstagramConnectionRow>()

  if (connectionError) {
    return { status: 'failed' }
  }

  if (!connection) {
    return { status: 'ignored_connection_not_found' }
  }

  const { data: event, error: eventError } = await admin
    .from('instagram_auto_dm_events')
    .select('id,user_id,instagram_connection_id,rule_id,commenter_instagram_scoped_id,delivery_status,lifecycle_status')
    .eq('instagram_connection_id', connection.id)
    .eq('commenter_instagram_scoped_id', notification.senderInstagramScopedId)
    .eq('initial_reply_status', 'sent')
    .in('lifecycle_status', ['waiting_for_user_reply', 'waiting_for_follow'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<WaitingEventRow>()

  if (eventError) {
    return { status: 'failed' }
  }

  if (!event) {
    return { status: 'ignored_waiting_event_not_found' }
  }

  if (event.delivery_status === 'sent' || event.lifecycle_status === 'material_sent') {
    return { status: 'skipped_already_delivered' }
  }

  const { rule, secret, failed } = await loadFollowDeliveryContext(
    event.rule_id,
    event.instagram_connection_id
  )

  if (failed) {
    return { status: 'failed' }
  }

  if (
    !rule ||
    !secret ||
    !event.instagram_connection_id ||
    !event.rule_id ||
    rule.user_id !== event.user_id ||
    rule.instagram_connection_id !== event.instagram_connection_id
  ) {
    await markFollowDeliveryFailed(event.id, 'follow_check', 'missing_data')
    return { status: 'failed' }
  }

  const token = decryptDeliveryToken(secret.access_token_ciphertext)

  if (!token) {
    await markFollowDeliveryFailed(event.id, 'follow_check', 'token_decrypt_failed')
    return { status: 'failed' }
  }

  const now = new Date().toISOString()
  const { error: pendingError } = await admin
    .from('instagram_auto_dm_events')
    .update({
      user_replied_at: now,
      follow_status: 'pending',
      lifecycle_status: 'follow_check_pending',
      failure_stage: null,
      failure_code: null,
      failure_reason: null,
    })
    .eq('id', event.id)

  if (pendingError) {
    return { status: 'failed' }
  }

  let profile: { username: string | null; isUserFollowingBusiness: boolean }

  try {
    profile = await getInstagramUserProfile({
      instagramScopedId: notification.senderInstagramScopedId,
      accessToken: token,
    })
  } catch (error) {
    await markFollowDeliveryFailed(event.id, 'follow_check', safeFailureCode(error, 'follow_check_failed'), {
      follow_status: 'check_failed',
      lifecycle_status: 'waiting_for_user_reply',
    })
    return { status: 'follow_check_failed' }
  }

  if (profile.username) {
    await admin
      .from('instagram_auto_dm_events')
      .update({ commenter_username: profile.username })
      .eq('id', event.id)
      .is('commenter_username', null)
  }

  if (!profile.isUserFollowingBusiness) {
    try {
      await sendInstagramTextMessage({
        instagramProfessionalAccountId: connection.instagram_professional_account_id,
        recipientInstagramScopedId: notification.senderInstagramScopedId,
        messageText: rule.follow_required_message,
        accessToken: token,
      })

      await admin
        .from('instagram_auto_dm_events')
        .update({
          follow_status: 'not_following',
          follow_checked_at: new Date().toISOString(),
          lifecycle_status: 'waiting_for_follow',
          delivery_status: 'not_ready',
          failure_stage: null,
          failure_code: null,
          failure_reason: null,
        })
        .eq('id', event.id)

      return { status: 'waiting_for_follow' }
    } catch (error) {
      await markFollowDeliveryFailed(
        event.id,
        'follow_required_message',
        safeFailureCode(error, 'follow_required_message_failed'),
        {
          follow_status: 'not_following',
          lifecycle_status: 'waiting_for_follow',
          delivery_status: 'not_ready',
          follow_checked_at: new Date().toISOString(),
        }
      )
      return { status: 'failed' }
    }
  }

  const materialMessage = await createMaterialDeliveryMessage(rule)

  if (!materialMessage) {
    await markFollowDeliveryFailed(event.id, 'material_delivery', 'share_link_unavailable', {
      follow_status: 'following',
      follow_checked_at: new Date().toISOString(),
      delivery_status: 'failed',
      lifecycle_status: 'waiting_for_user_reply',
    })
    return { status: 'share_link_unavailable' }
  }

  try {
    const message = await sendInstagramTextMessage({
      instagramProfessionalAccountId: connection.instagram_professional_account_id,
      recipientInstagramScopedId: notification.senderInstagramScopedId,
      messageText: materialMessage,
      accessToken: token,
    })

    const { error: sentError } = await admin
      .from('instagram_auto_dm_events')
      .update({
        follow_status: 'following',
        follow_checked_at: new Date().toISOString(),
        delivery_status: 'sent',
        material_delivery_message_id: message.messageId,
        material_sent_at: new Date().toISOString(),
        lifecycle_status: 'material_sent',
        failure_stage: null,
        failure_code: null,
        failure_reason: null,
      })
      .eq('id', event.id)

    if (sentError) {
      return { status: 'failed' }
    }

    return { status: 'material_sent' }
  } catch (error) {
    await markFollowDeliveryFailed(
      event.id,
      'material_delivery',
      safeFailureCode(error, 'material_delivery_failed'),
      {
        follow_status: 'following',
        follow_checked_at: new Date().toISOString(),
        delivery_status: 'failed',
        lifecycle_status: 'waiting_for_user_reply',
      }
    )
    return { status: 'material_send_failed' }
  }
}

async function loadFollowDeliveryContext(
  ruleId: string | null,
  connectionId: string | null
) {
  const admin = createAdminClient()
  const [ruleResult, secretResult] = await Promise.all([
    ruleId
      ? admin
          .from('instagram_auto_dm_rules')
          .select('id,user_id,instagram_connection_id,share_link_id,follow_required_message,material_delivery_message')
          .eq('id', ruleId)
          .maybeSingle<AutoDmRuleRow>()
      : Promise.resolve({ data: null, error: null }),
    connectionId
      ? admin
          .from('instagram_connection_secrets')
          .select('access_token_ciphertext')
          .eq('instagram_connection_id', connectionId)
          .maybeSingle<InstagramConnectionSecretRow>()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (ruleResult.error || secretResult.error) {
    return { failed: true as const }
  }

  return {
    failed: false as const,
    rule: ruleResult.data ?? null,
    secret: secretResult.data ?? null,
  }
}

async function createMaterialDeliveryMessage(rule: AutoDmRuleRow) {
  if (!rule.share_link_id || !rule.material_delivery_message.includes('{link}')) {
    return null
  }

  const admin = createAdminClient()
  const { data: shareLink, error } = await admin
    .from('content_share_links')
    .select('id,token,is_enabled,disabled_at,expires_at,card:content_cards!inner(is_deleted)')
    .eq('id', rule.share_link_id)
    .eq('user_id', rule.user_id)
    .maybeSingle<ShareLinkRow>()

  if (error || !shareLink || !isActiveShareLink(shareLink)) {
    return null
  }

  const publicUrl = createPublicContentShareUrl(shareLink.token)

  if (!publicUrl) {
    return null
  }

  return rule.material_delivery_message.replace('{link}', publicUrl)
}

function isActiveShareLink(shareLink: ShareLinkRow) {
  const card = Array.isArray(shareLink.card) ? shareLink.card[0] : shareLink.card

  return Boolean(
    shareLink.token &&
      shareLink.is_enabled &&
      !shareLink.disabled_at &&
      !card?.is_deleted &&
      (!shareLink.expires_at || new Date(shareLink.expires_at).getTime() > Date.now())
  )
}

async function markFollowDeliveryFailed(
  eventId: string,
  stage: string,
  code: string,
  extra?: Record<string, string | null>
) {
  const admin = createAdminClient()

  await admin
    .from('instagram_auto_dm_events')
    .update({
      ...extra,
      failure_stage: stage,
      failure_code: code,
      failure_reason: FAILURE_REASON_BY_CODE[code] ?? 'Auto DM follow confirmation failed',
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
