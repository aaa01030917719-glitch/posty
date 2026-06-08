import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  safeWebhookEventType,
  safeWebhookEventId,
  safeWebhookTaskId,
  verifyManusWebhookSignature,
} from '@/lib/manus/webhook'
import { processManusWebhookPayload } from '@/lib/references/manus-reconcile'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get('x-webhook-signature')
  const timestamp = request.headers.get('x-webhook-timestamp')
  const verification = await verifyManusWebhookSignature({
    rawBody,
    fullWebhookUrl: request.url,
    signature,
    timestamp,
  })

  if (!verification.valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventId = safeWebhookEventId(payload)
  const eventType = safeWebhookEventType(payload)
  const manusTaskId = safeWebhookTaskId(payload)
  const isKnownTaskEvent = eventType === 'task_created' || eventType === 'task_stopped'

  if (!eventId || !manusTaskId || !isKnownTaskEvent) {
    return NextResponse.json({
      received: true,
      duplicate: false,
      ignored: true,
      reason: !eventId || !manusTaskId ? 'probe_or_incomplete_payload' : 'unsupported_event_type',
    })
  }

  const admin = createAdminClient()

  const { data: existing, error: lookupError } = await admin
    .from('manus_webhook_events')
    .select('id,processed_at')
    .eq('event_id', eventId)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: 'webhook_event_lookup_failed' }, { status: 500 })
  }

  if (existing?.processed_at) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const eventRow = existing ?? (await admin
    .from('manus_webhook_events')
    .insert({
      event_id: eventId,
      manus_task_id: manusTaskId,
      signature_valid: true,
      payload,
    })
    .select('id')
    .single()).data

  if (!eventRow) {
    return NextResponse.json({ error: 'webhook_event_insert_failed' }, { status: 500 })
  }

  const result = await processManusWebhookPayload({ admin, payload, manusTaskId })

  await admin
    .from('manus_webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', eventRow.id)

  return NextResponse.json({ received: true, duplicate: false, result })
}
