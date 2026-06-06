import { NextResponse } from 'next/server'
import {
  listInstagramRecentMedia,
  type InstagramRecentMedia,
} from '@/lib/instagram/meta-client'
import { decryptInstagramAccessToken } from '@/lib/instagram/token-crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MEDIA_RESOLVE_PAGE_LIMIT = 25
const MEDIA_RESOLVE_MAX_PAGES = 3

type ResolveInput = {
  url?: unknown
}

type InstagramConnectionRow = {
  id: string
  instagram_professional_account_id: string
}

type InstagramConnectionSecretRow = {
  access_token_ciphertext: string
}

function safeMedia(media: InstagramRecentMedia) {
  return {
    id: media.id,
    mediaType: media.mediaType,
    apiMediaType: media.apiMediaType,
    permalink: media.permalink,
    thumbnailUrl: media.thumbnailUrl,
    captionPreview: media.captionPreview,
    timestamp: media.timestamp,
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ResolveInput

  try {
    body = await request.json() as ResolveInput
  } catch {
    return NextResponse.json({ error: '요청 형식을 확인해주세요' }, { status: 400 })
  }

  const normalizedUrl = normalizeInstagramPermalink(body.url)

  if (!normalizedUrl) {
    return NextResponse.json({ error: 'Instagram 게시물 URL을 확인해주세요' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: connection, error: connectionError } = await admin
    .from('instagram_connections')
    .select('id,instagram_professional_account_id')
    .eq('user_id', user.id)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle<InstagramConnectionRow>()

  if (connectionError) {
    return NextResponse.json({ error: 'Instagram connection is unavailable' }, { status: 500 })
  }

  if (!connection) {
    return NextResponse.json({ error: 'Instagram account is not connected' }, { status: 409 })
  }

  const { data: secret, error: secretError } = await admin
    .from('instagram_connection_secrets')
    .select('access_token_ciphertext')
    .eq('instagram_connection_id', connection.id)
    .maybeSingle<InstagramConnectionSecretRow>()

  if (secretError) {
    return NextResponse.json({ error: 'Instagram credential state is unavailable' }, { status: 500 })
  }

  if (!secret) {
    return NextResponse.json({ error: 'Instagram account should be reconnected' }, { status: 409 })
  }

  try {
    const accessToken = decryptInstagramAccessToken(secret.access_token_ciphertext)
    const media = await listInstagramRecentMedia({
      instagramProfessionalAccountId: connection.instagram_professional_account_id,
      accessToken,
      limit: MEDIA_RESOLVE_PAGE_LIMIT,
      maxPages: MEDIA_RESOLVE_MAX_PAGES,
    })
    const matched = media.find((item) =>
      item.permalink ? normalizeInstagramPermalink(item.permalink) === normalizedUrl : false
    )

    if (!matched) {
      return NextResponse.json(
        {
          error:
            '연결된 Instagram 계정의 최근 게시물에서 해당 URL을 찾지 못했어요',
          searchLimit: MEDIA_RESOLVE_PAGE_LIMIT * MEDIA_RESOLVE_MAX_PAGES,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      media: safeMedia(matched),
      searchLimit: MEDIA_RESOLVE_PAGE_LIMIT * MEDIA_RESOLVE_MAX_PAGES,
    })
  } catch {
    return NextResponse.json({ error: 'Instagram media could not be resolved' }, { status: 502 })
  }
}

function normalizeInstagramPermalink(value: unknown) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  if (!trimmed) return null

  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()

  if (host !== 'instagram.com' && host !== 'www.instagram.com') {
    return null
  }

  const segments = url.pathname.split('/').filter(Boolean)

  if (segments.length < 2 || !['p', 'reel'].includes(segments[0])) {
    return null
  }

  return `https://www.instagram.com/${segments[0]}/${segments[1]}/`
}
