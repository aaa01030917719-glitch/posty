import { after, NextResponse, type NextRequest } from 'next/server'
import {
  processInstagramComment,
  type AutoDmCommentProcessResult,
} from '@/lib/instagram/auto-dm-processor'
import {
  isInstagramAutoDmSendEnabled,
  processInitialPrivateReplyAndPublicCommentReply,
} from '@/lib/instagram/auto-dm-delivery'
import { processFollowConfirmationMessage } from '@/lib/instagram/auto-dm-follow-delivery'
import {
  type CommentNormalizationResult,
  type CommentSkipReason,
  normalizeInstagramCommentNotifications,
  normalizeInstagramMessagingNotifications,
  parseWebhookPayload,
  verifyWebhookSignature,
  verifyWebhookToken,
} from '@/lib/instagram/webhook'

export const dynamic = 'force-dynamic'

type CommentDiagnosticStatus =
  | CommentSkipReason
  | AutoDmCommentProcessResult['status']
  | 'invalid_payload'

function logCommentWebhookDiagnostics({
  normalized,
  processResults,
}: {
  normalized: CommentNormalizationResult[]
  processResults: AutoDmCommentProcessResult[]
}) {
  const skipReasons = normalized.flatMap((result) =>
    'skipped' in result ? [result.skipped] : []
  )
  const processorStatuses = processResults.map((result) => result.status)
  const results: CommentDiagnosticStatus[] = [...skipReasons, ...processorStatuses]
  const skipReasonCounts = countBy(skipReasons)
  const matchedCount = processResults.filter((result) => result.status === 'matched').length
  const duplicateCount = processResults.filter((result) => result.status === 'duplicate_skipped').length
  const failedCount = processResults.filter((result) => result.status === 'failed').length

  console.info('[instagram-webhook]', {
    type: 'comment',
    normalizedCount: normalized.filter((result) => 'notification' in result).length,
    results,
    skipReasonCounts,
    invalidPayloadSkipCount: skipReasons.length,
    matchedCount,
    eventCreatedCount: matchedCount,
    duplicateCount,
    failedCount,
  })
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

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
    console.info('[instagram-webhook]', {
      type: 'comment',
      normalizedCount: 0,
      results: ['invalid_payload'] satisfies CommentDiagnosticStatus[],
      skipReasonCounts: { invalid_payload: 1 },
      invalidPayloadSkipCount: 1,
      matchedCount: 0,
      eventCreatedCount: 0,
      duplicateCount: 0,
      failedCount: 0,
    })
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
  logCommentWebhookDiagnostics({ normalized, processResults })

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

    const messagingNotifications = normalizeInstagramMessagingNotifications(payload)

    for (const result of messagingNotifications) {
      if ('notification' in result) {
        after(async () => {
          await processFollowConfirmationMessage(result.notification)
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
