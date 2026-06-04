import { NextResponse } from 'next/server'
import { hasInstagramOAuthConfiguration } from '@/lib/instagram/meta-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const configured = hasInstagramOAuthConfiguration()

  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      instagramUsername: null,
      tokenExpiresAt: null,
      connectedAt: null,
    })
  }

  try {
    const admin = createAdminClient()
    const { data: connection, error: connectionError } = await admin
      .from('instagram_connections')
      .select('id,instagram_username,token_expires_at,connected_at')
      .eq('user_id', user.id)
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (connectionError) {
      throw new Error('Instagram connection metadata could not be loaded')
    }

    if (!connection) {
      return NextResponse.json({
        configured: true,
        connected: false,
        instagramUsername: null,
        tokenExpiresAt: null,
        connectedAt: null,
      })
    }

    const { data: secret, error: secretError } = await admin
      .from('instagram_connection_secrets')
      .select('id')
      .eq('instagram_connection_id', connection.id)
      .maybeSingle()

    if (secretError) {
      throw new Error('Instagram connection credential state could not be loaded')
    }

    return NextResponse.json({
      configured: true,
      connected: Boolean(secret),
      instagramUsername: connection.instagram_username,
      tokenExpiresAt: connection.token_expires_at,
      connectedAt: connection.connected_at,
    })
  } catch {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        instagramUsername: null,
        tokenExpiresAt: null,
        connectedAt: null,
        error: 'Connection status is unavailable',
      },
      { status: 500 }
    )
  }
}
