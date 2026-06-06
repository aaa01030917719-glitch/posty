import 'server-only'

const INSTAGRAM_AUTHORIZE_ENDPOINT = 'https://www.instagram.com/oauth/authorize'
const INSTAGRAM_TOKEN_ENDPOINT = 'https://api.instagram.com/oauth/access_token'
const INSTAGRAM_GRAPH_ENDPOINT = 'https://graph.instagram.com'
const INSTAGRAM_GRAPH_API_VERSION = 'v23.0'
const FETCH_TIMEOUT_MS = 10_000

export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
] as const

type InstagramOAuthConfig = {
  appId: string
  appSecret: string
  redirectUri: string
}

type ShortLivedTokenResponse = {
  access_token?: string
  user_id?: number
}

type LongLivedTokenResponse = {
  access_token?: string
  expires_in?: number
}

type InstagramAccountResponse = {
  id?: string
  user_id?: string
  username?: string
}

type PrivateReplyResponse = {
  message_id?: string
  recipient_id?: string
}

type CommentReplyResponse = {
  id?: string
}

type InstagramUserProfileResponse = {
  username?: string
  is_user_follow_business?: boolean
}

type TextMessageResponse = {
  message_id?: string
  recipient_id?: string
}

export class InstagramMetaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InstagramMetaError'
  }
}

function getOAuthConfig(): InstagramOAuthConfig {
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT_URI

  if (!appId || !appSecret || !redirectUri) {
    throw new InstagramMetaError('Instagram OAuth configuration is unavailable')
  }

  return { appId, appSecret, redirectUri }
}

export function hasInstagramOAuthConfiguration() {
  return Boolean(
    process.env.INSTAGRAM_APP_ID &&
      process.env.INSTAGRAM_APP_SECRET &&
      process.env.INSTAGRAM_OAUTH_REDIRECT_URI &&
      process.env.INSTAGRAM_OAUTH_STATE_SECRET &&
      process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SERVICE_KEY ??
        process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY
      )
  )
}

async function fetchInstagramJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new InstagramMetaError(`Instagram request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function postInstagramJson<T>(path: string, accessToken: string, body: unknown) {
  const url = new URL(`/${INSTAGRAM_GRAPH_API_VERSION}${path}`, INSTAGRAM_GRAPH_ENDPOINT)

  return fetchInstagramJson<T>(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function getInstagramJson<T>(path: string, accessToken: string, params?: Record<string, string>) {
  const url = new URL(`/${INSTAGRAM_GRAPH_API_VERSION}${path}`, INSTAGRAM_GRAPH_ENDPOINT)

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }

  return fetchInstagramJson<T>(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function createInstagramAuthorizeUrl(state: string) {
  const { appId, redirectUri } = getOAuthConfig()
  const url = new URL(INSTAGRAM_AUTHORIZE_ENDPOINT)

  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_OAUTH_SCOPES.join(','))
  url.searchParams.set('state', state)

  return url
}

export async function exchangeCodeForShortLivedToken(code: string) {
  const { appId, appSecret, redirectUri } = getOAuthConfig()
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })
  const data = await fetchInstagramJson<ShortLivedTokenResponse>(
    INSTAGRAM_TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  )

  if (!data.access_token) {
    throw new InstagramMetaError('Instagram short-lived token response is incomplete')
  }

  return data.access_token
}

export async function exchangeForLongLivedToken(shortLivedAccessToken: string) {
  const { appSecret } = getOAuthConfig()
  const url = new URL('/access_token', INSTAGRAM_GRAPH_ENDPOINT)

  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('access_token', shortLivedAccessToken)

  const data = await fetchInstagramJson<LongLivedTokenResponse>(url.toString())

  if (!data.access_token) {
    throw new InstagramMetaError('Instagram long-lived token response is incomplete')
  }

  return {
    accessToken: data.access_token,
    expiresAt:
      typeof data.expires_in === 'number'
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
  }
}

export async function getInstagramProfessionalAccount(accessToken: string) {
  const url = new URL('/me', INSTAGRAM_GRAPH_ENDPOINT)

  url.searchParams.set('fields', 'id,user_id,username')

  const data = await fetchInstagramJson<InstagramAccountResponse>(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const accountId = data.user_id ?? data.id

  if (!accountId || !data.username) {
    throw new InstagramMetaError('Instagram account metadata response is incomplete')
  }

  return {
    accountId,
    username: data.username,
  }
}

export async function sendInstagramPrivateReply(input: {
  instagramProfessionalAccountId: string
  commentId: string
  messageText: string
  accessToken: string
}) {
  const data = await postInstagramJson<PrivateReplyResponse>(
    `/${encodeURIComponent(input.instagramProfessionalAccountId)}/messages`,
    input.accessToken,
    {
      recipient: { comment_id: input.commentId },
      message: { text: input.messageText },
    }
  )

  if (!data.message_id) {
    throw new InstagramMetaError('Instagram private reply response is incomplete')
  }

  return {
    messageId: data.message_id,
    recipientId: data.recipient_id ?? null,
  }
}

export async function replyToInstagramComment(input: {
  commentId: string
  messageText: string
  accessToken: string
}) {
  const data = await postInstagramJson<CommentReplyResponse>(
    `/${encodeURIComponent(input.commentId)}/replies`,
    input.accessToken,
    { message: input.messageText }
  )

  if (!data.id) {
    throw new InstagramMetaError('Instagram public comment reply response is incomplete')
  }

  return {
    replyId: data.id,
  }
}

export async function getInstagramUserProfile(input: {
  instagramScopedId: string
  accessToken: string
}) {
  const data = await getInstagramJson<InstagramUserProfileResponse>(
    `/${encodeURIComponent(input.instagramScopedId)}`,
    input.accessToken,
    { fields: 'username,is_user_follow_business' }
  )

  if (typeof data.is_user_follow_business !== 'boolean') {
    throw new InstagramMetaError('Instagram user profile response is incomplete')
  }

  return {
    username: data.username ?? null,
    isUserFollowingBusiness: data.is_user_follow_business,
  }
}

export async function sendInstagramTextMessage(input: {
  instagramProfessionalAccountId: string
  recipientInstagramScopedId: string
  messageText: string
  accessToken: string
}) {
  const data = await postInstagramJson<TextMessageResponse>(
    `/${encodeURIComponent(input.instagramProfessionalAccountId)}/messages`,
    input.accessToken,
    {
      recipient: { id: input.recipientInstagramScopedId },
      message: { text: input.messageText },
    }
  )

  if (!data.message_id) {
    throw new InstagramMetaError('Instagram text message response is incomplete')
  }

  return {
    messageId: data.message_id,
    recipientId: data.recipient_id ?? null,
  }
}
