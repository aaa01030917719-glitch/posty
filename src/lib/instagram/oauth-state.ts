import 'server-only'

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const STATE_MAX_AGE_MS = 10 * 60 * 1000

type InstagramOAuthStatePayload = {
  userId: string
  nonce: string
  issuedAt: number
}

function getStateSecret() {
  const secret = process.env.INSTAGRAM_OAUTH_STATE_SECRET

  if (!secret) {
    throw new Error('Instagram OAuth state configuration is unavailable')
  }

  return secret
}

function sign(encodedPayload: string) {
  return createHmac('sha256', getStateSecret())
    .update(encodedPayload)
    .digest('base64url')
}

export function createInstagramOAuthState(userId: string) {
  const payload: InstagramOAuthStatePayload = {
    userId,
    nonce: randomBytes(24).toString('base64url'),
    issuedAt: Date.now(),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')

  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function statesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyInstagramOAuthState(state: string) {
  const [encodedPayload, signature, extra] = state.split('.')

  if (!encodedPayload || !signature || extra) {
    return null
  }

  const expectedSignature = sign(encodedPayload)

  if (!statesMatch(signature, expectedSignature)) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as Partial<InstagramOAuthStatePayload>

    if (
      typeof payload.userId !== 'string' ||
      !payload.userId ||
      typeof payload.nonce !== 'string' ||
      !payload.nonce ||
      typeof payload.issuedAt !== 'number' ||
      Date.now() - payload.issuedAt > STATE_MAX_AGE_MS ||
      payload.issuedAt > Date.now() + 30_000
    ) {
      return null
    }

    return payload as InstagramOAuthStatePayload
  } catch {
    return null
  }
}
