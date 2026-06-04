import { after, NextResponse, type NextRequest } from 'next/server'
import { processInstagramComment } from '@/lib/instagram/auto-dm-processor'
import {
  isInstagramAutoDmSendEnabled,
  processInitialPrivateReplyAndPublicCommentReply,
} from '@/lib/instagram/auto-dm-delivery'
import {
  normalizeInstagramCommentNotifications,
  parseWebhookPayload,
  verifyWebhookSignature,
  verifyWebhookToken,
} from '@/lib/instagram/webhook'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN

  if (!expectedToken) {
    return new Response('Webhook configuration unavailable', { status: 503 })
  }

  const mode = request.nextUrl.searchParams.get('hub.mode')
  const providedToken = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')

  if (
    mode !== 'subscribe' ||
    !challenge ||
    !verifyWebhookToken(providedToken, expectedToken)
  ) {
    return new Response('Forbidden', { status: 403 })
  }

  return new Response(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET

  if (!appSecret) {
    return NextResponse.json({ error: 'Webhook configuration unavailable' }, { status: 503 })
  }

  const rawBody = new Uint8Array(await request.arrayBuffer())
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = parseWebhookPayload(rawBody)

  if (payload === null) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const normalized = normalizeInstagramCommentNotifications(payload)
  const processResults = await Promise.all(
    normalized.flatMap((result) =>
      'notification' in result
        ? [processInstagramComment(result.notification)]
        : []
    )
  )

  if (processResults.some((result) => result.status === 'failed')) {
    return NextResponse.json({ received: false }, { status: 500 })
  }

  if (isInstagramAutoDmSendEnabled()) {
    for (const result of processResults) {
      if (result.status === 'matched') {
        after(async () => {
          await processInitialPrivateReplyAndPublicCommentReply(result.eventId)
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
