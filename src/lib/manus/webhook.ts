import 'server-only'

import { createHash, createVerify } from 'node:crypto'
import { getWebhookPublicKey } from './client'

const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

let cachedPublicKey: { value: string; expiresAt: number } | null = null

async function getCachedPublicKey() {
  if (cachedPublicKey && cachedPublicKey.expiresAt > Date.now()) {
    return cachedPublicKey.value
  }

  const response = await getWebhookPublicKey()
  if (!response.public_key || response.algorithm !== 'RSA-SHA256') {
    throw new Error('manus_webhook_public_key_unavailable')
  }

  cachedPublicKey = {
    value: response.public_key,
    expiresAt: Date.now() + PUBLIC_KEY_TTL_MS,
  }

  return response.public_key
}

function sha256Hex(value: Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export async function verifyManusWebhookSignature({
  rawBody,
  fullWebhookUrl,
  signature,
  timestamp,
}: {
  rawBody: Buffer
  fullWebhookUrl: string
  signature: string | null
  timestamp: string | null
}) {
  if (!signature || !timestamp) {
    return { valid: false, reason: 'missing_signature_headers' }
  }

  const timestampMs = Number(timestamp) * 1000
  if (!Number.isFinite(timestampMs)) {
    return { valid: false, reason: 'invalid_timestamp' }
  }

  if (Math.abs(Date.now() - timestampMs) > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, reason: 'timestamp_outside_tolerance' }
  }

  const publicKey = await getCachedPublicKey()
  const signedPayload = `${timestamp}.${fullWebhookUrl}.${sha256Hex(rawBody)}`
  const verifier = createVerify('RSA-SHA256')
  verifier.update(signedPayload)
  verifier.end()

  const valid = verifier.verify(publicKey, signature, 'base64')

  return { valid, reason: valid ? null : 'signature_mismatch' }
}

export function safeWebhookEventId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const objectPayload = payload as Record<string, unknown>
  const eventId = objectPayload.event_id ?? objectPayload.id

  return typeof eventId === 'string' && eventId.trim() ? eventId : null
}

export function safeWebhookEventType(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const objectPayload = payload as Record<string, unknown>
  const eventType = objectPayload.event_type ?? objectPayload.type

  return typeof eventType === 'string' && eventType.trim() ? eventType : null
}

export function safeWebhookTaskId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const objectPayload = payload as Record<string, unknown>
  const task =
    objectPayload.task && typeof objectPayload.task === 'object'
      ? objectPayload.task as Record<string, unknown>
      : null
  const taskDetail =
    objectPayload.task_detail && typeof objectPayload.task_detail === 'object'
      ? objectPayload.task_detail as Record<string, unknown>
      : null
  const taskId = objectPayload.task_id ?? taskDetail?.task_id ?? task?.id

  return typeof taskId === 'string' && taskId.trim() ? taskId : null
}
