import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

export type InstagramCommentNotification = {
  instagramProfessionalAccountId: string
  commentId: string
  mediaId: string
  commenterInstagramScopedId: string
  commenterUsername: string | null
  commentText: string
  mediaType: string | null
}

export type InstagramMessagingNotification = {
  instagramProfessionalAccountId: string
  senderInstagramScopedId: string
  recipientInstagramProfessionalAccountId: string
  messageId: string
  messageText: string
  quickReplyPayload: string | null
  timestamp: string | null
}

export type CommentNormalizationResult =
  | { notification: InstagramCommentNotification }
  | { skipped: 'unsupported_payload' | 'missing_required_fields' }

export type MessagingNormalizationResult =
  | { notification: InstagramMessagingNotification }
  | {
      skipped:
        | 'unsupported_payload'
        | 'missing_required_fields'
        | 'ignored_echo'
        | 'ignored_self'
        | 'ignored_deleted'
        | 'ignored_unsupported'
        | 'ignored_empty_text'
    }

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyWebhookToken(providedToken: string | null, expectedToken: string) {
  return Boolean(providedToken && expectedToken && safeEqual(providedToken, expectedToken))
}

export function verifyWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string
) {
  if (!signatureHeader?.startsWith('sha256=') || !appSecret) {
    return false
  }

  const providedSignature = signatureHeader.slice('sha256='.length)

  if (!/^[a-f0-9]{64}$/i.test(providedSignature)) {
    return false
  }

  const expectedSignature = createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')

  return safeEqual(providedSignature.toLowerCase(), expectedSignature)
}

export function parseWebhookPayload(rawBody: Uint8Array) {
  try {
    return JSON.parse(new TextDecoder().decode(rawBody)) as unknown
  } catch {
    return null
  }
}

export function normalizeInstagramCommentNotifications(payload: unknown) {
  const results: CommentNormalizationResult[] = []
  const root = asRecord(payload)
  const entries = asArray(root?.entry)

  if (root?.object !== 'instagram' || entries.length === 0) {
    return [{ skipped: 'unsupported_payload' }] as CommentNormalizationResult[]
  }

  for (const rawEntry of entries) {
    const entry = asRecord(rawEntry)
    const professionalAccountId = stringValue(entry?.id)
    const changes = asArray(entry?.changes)

    for (const rawChange of changes) {
      const change = asRecord(rawChange)
      const field = stringValue(change?.field)

      if (field !== 'comments' && field !== 'live_comments') {
        results.push({ skipped: 'unsupported_payload' })
        continue
      }

      const values = Array.isArray(change?.value) ? change.value : [change?.value]

      for (const rawValue of values) {
        const value = asRecord(rawValue)
        const from = asRecord(value?.from)
        const media = asRecord(value?.media)
        const commentId = stringValue(value?.id) ?? stringValue(value?.comment_id)
        const mediaId = stringValue(media?.id) ?? stringValue(value?.media_id)
        const commenterId =
          stringValue(from?.id) ??
          stringValue(value?.from_id) ??
          stringValue(value?.user_id)
        const commentText = stringValue(value?.text)

        if (!professionalAccountId || !commentId || !mediaId || !commenterId || commentText === null) {
          results.push({ skipped: 'missing_required_fields' })
          continue
        }

        results.push({
          notification: {
            instagramProfessionalAccountId: professionalAccountId,
            commentId,
            mediaId,
            commenterInstagramScopedId: commenterId,
            commenterUsername:
              stringValue(from?.username) ?? stringValue(value?.username),
            commentText,
            mediaType:
              stringValue(media?.media_product_type) ??
              stringValue(value?.media_product_type),
          },
        })
      }
    }
  }

  return results.length > 0
    ? results
    : [{ skipped: 'unsupported_payload' }]
}

export function normalizeInstagramMessagingNotifications(payload: unknown) {
  const results: MessagingNormalizationResult[] = []
  const root = asRecord(payload)
  const entries = asArray(root?.entry)

  if (root?.object !== 'instagram' || entries.length === 0) {
    return [{ skipped: 'unsupported_payload' }] as MessagingNormalizationResult[]
  }

  for (const rawEntry of entries) {
    const entry = asRecord(rawEntry)
    const professionalAccountId = stringValue(entry?.id)
    const messagingItems = asArray(entry?.messaging)

    for (const rawItem of messagingItems) {
      const item = asRecord(rawItem)
      const sender = asRecord(item?.sender)
      const recipient = asRecord(item?.recipient)
      const message = asRecord(item?.message)
      const quickReply = asRecord(message?.quick_reply)

      if (!message) {
        results.push({ skipped: 'unsupported_payload' })
        continue
      }

      if (message.is_echo === true) {
        results.push({ skipped: 'ignored_echo' })
        continue
      }

      if (message.is_self === true) {
        results.push({ skipped: 'ignored_self' })
        continue
      }

      if (message.is_deleted === true) {
        results.push({ skipped: 'ignored_deleted' })
        continue
      }

      if (message.is_unsupported === true) {
        results.push({ skipped: 'ignored_unsupported' })
        continue
      }

      const senderId = stringValue(sender?.id)
      const recipientId = stringValue(recipient?.id)
      const messageId = stringValue(message?.mid)
      const messageText = stringValue(message?.text)?.trim() ?? ''

      if (!messageText) {
        results.push({ skipped: 'ignored_empty_text' })
        continue
      }

      if (!professionalAccountId || !senderId || !recipientId || !messageId) {
        results.push({ skipped: 'missing_required_fields' })
        continue
      }

      results.push({
        notification: {
          instagramProfessionalAccountId: professionalAccountId,
          senderInstagramScopedId: senderId,
          recipientInstagramProfessionalAccountId: recipientId,
          messageId,
          messageText,
          quickReplyPayload: stringValue(quickReply?.payload),
          timestamp: stringValue(item?.timestamp),
        },
      })
    }
  }

  return results.length > 0
    ? results
    : [{ skipped: 'unsupported_payload' }]
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}
