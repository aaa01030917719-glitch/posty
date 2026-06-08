import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { processLinkkoReferenceEvent } from '@/lib/references/linkko-event-handler'
import { validateLinkkoReferenceEvent } from '@/lib/references/linkko-event-schema'

export const dynamic = 'force-dynamic'

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)

  return match?.[1]?.trim() ?? null
}

function statusForProcessingError(error: Error) {
  if (error.message === 'account_connection_required') return 403
  if (error.message === 'ambiguous_account_connection') return 409
  if (error.message === 'folder_integration_required') return 403
  if (error.message === 'Invalid URL' || error.message === 'Unsupported URL protocol') return 400

  return 500
}

function publicErrorCode(error: Error) {
  if (
    error.message === 'account_connection_required' ||
    error.message === 'ambiguous_account_connection' ||
    error.message === 'folder_integration_required'
  ) {
    return error.message
  }

  if (error.message === 'Invalid URL' || error.message === 'Unsupported URL protocol') {
    return 'invalid_url'
  }

  return 'event_processing_failed'
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.LINKKO_POSTY_SYNC_SECRET

  if (!expectedSecret) {
    return NextResponse.json({ error: 'sync_not_configured' }, { status: 503 })
  }

  const bearerToken = getBearerToken(request)

  if (!bearerToken || !safeEqual(bearerToken, expectedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const validated = validateLinkkoReferenceEvent(payload)

  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  try {
    const result = await processLinkkoReferenceEvent(payload, validated.event)

    return NextResponse.json({
      received: true,
      duplicate: result.status === 'duplicate',
      eventId: result.eventId,
      referenceId: result.status === 'processed' ? result.referenceId ?? null : null,
      analysisJobQueued: result.status === 'processed'
        ? result.analysisJobQueued === true
        : false,
    })
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('unknown_error')

    return NextResponse.json(
      { error: publicErrorCode(normalizedError) },
      { status: statusForProcessingError(normalizedError) }
    )
  }
}
