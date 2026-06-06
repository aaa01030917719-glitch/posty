import { NextResponse } from 'next/server'
import {
  listInstagramRecentMedia,
  type InstagramRecentMedia,
} from '@/lib/instagram/meta-client'
import { decryptInstagramAccessToken } from '@/lib/instagram/token-crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      limit: 25,
    })

    return NextResponse.json({ media: media.map((item) => safeMedia(item)) })
  } catch {
    return NextResponse.json({ error: 'Instagram media could not be loaded' }, { status: 502 })
  }
}
