import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { reconcileSubmittedManusJobs } from '@/lib/references/manus-reconcile'

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

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.REFERENCES_QUEUE_CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: 'references_queue_not_configured' }, { status: 503 })
  }

  const token = getBearerToken(request)
  if (!token || !safeEqual(token, expectedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await reconcileSubmittedManusJobs()

  return NextResponse.json(result)
}
