import { NextResponse } from 'next/server'
import {
  getInstagramAccountWebhookSubscriptions,
  hasInstagramOAuthConfiguration,
} from '@/lib/instagram/meta-client'
import { decryptInstagramAccessToken } from '@/lib/instagram/token-crypto'
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
      webhookSubscribed: false,
      subscribedFields: [],
    })
  }

  try {
    const admin = createAdminClient()
    const { data: connection, error: connectionError } = await admin
      .from('instagram_connections')
      .select('id,instagram_professional_account_id,instagram_username,token_expires_at,connected_at')
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
        webhookSubscribed: false,
        subscribedFields: [],
      })
    }

    const { data: secret, error: secretError } = await admin
      .from('instagram_connection_secrets')
      .select('id,access_token_ciphertext')
      .eq('instagram_connection_id', connection.id)
      .maybeSingle()

    if (secretError) {
      throw new Error('Instagram connection credential state could not be loaded')
    }

    let webhookSubscribed = false
    let subscribedFields: string[] = []

    if (secret?.access_token_ciphertext) {
      try {
        const accessToken = decryptInstagramAccessToken(secret.access_token_ciphertext)
        const subscription = await getInstagramAccountWebhookSubscriptions({
          instagramProfessionalAccountId: connection.instagram_professional_account_id,
          accessToken,
        })

        webhookSubscribed = subscription.webhookSubscribed
        subscribedFields = subscription.subscribedFields
      } catch {
        webhookSubscribed = false
        subscribedFields = []
      }
    }

    return NextResponse.json({
      configured: true,
      connected: Boolean(secret),
      instagramUsername: connection.instagram_username,
      tokenExpiresAt: connection.token_expires_at,
      connectedAt: connection.connected_at,
      webhookSubscribed,
      subscribedFields,
    })
  } catch {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        instagramUsername: null,
        tokenExpiresAt: null,
        connectedAt: null,
        webhookSubscribed: false,
        subscribedFields: [],
        error: 'Connection status is unavailable',
      },
      { status: 500 }
    )
  }
}
