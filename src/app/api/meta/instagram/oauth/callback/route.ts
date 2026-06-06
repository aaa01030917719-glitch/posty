import { NextResponse, type NextRequest } from 'next/server'
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  getInstagramAccountWebhookSubscriptions,
  getInstagramProfessionalAccount,
  hasInstagramOAuthConfiguration,
  subscribeInstagramAccountToWebhooks,
} from '@/lib/instagram/meta-client'
import { statesMatch, verifyInstagramOAuthState } from '@/lib/instagram/oauth-state'
import { encryptInstagramAccessToken } from '@/lib/instagram/token-crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const OAUTH_STATE_COOKIE = 'posty_instagram_oauth_state'

function redirectWithStatus(request: NextRequest, status: string) {
  const response = NextResponse.redirect(new URL(`/auto-dm?instagram=${status}`, request.url))

  response.cookies.delete(OAUTH_STATE_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  const queryState = request.nextUrl.searchParams.get('state')
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (!queryState || !cookieState || !statesMatch(queryState, cookieState)) {
    return redirectWithStatus(request, 'invalid_state')
  }

  let state: ReturnType<typeof verifyInstagramOAuthState>

  try {
    state = verifyInstagramOAuthState(queryState)
  } catch {
    return redirectWithStatus(request, 'invalid_state')
  }

  if (!state) {
    return redirectWithStatus(request, 'invalid_state')
  }

  if (request.nextUrl.searchParams.has('error')) {
    return redirectWithStatus(request, 'connection_failed')
  }

  const code = request.nextUrl.searchParams.get('code')

  if (!code || !hasInstagramOAuthConfiguration()) {
    return redirectWithStatus(
      request,
      code ? 'configuration_required' : 'connection_failed'
    )
  }

  try {
    const shortLivedToken = await exchangeCodeForShortLivedToken(code)
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken)
    const account = await getInstagramProfessionalAccount(longLivedToken.accessToken)
    await subscribeInstagramAccountToWebhooks({
      instagramProfessionalAccountId: account.accountId,
      accessToken: longLivedToken.accessToken,
    })
    const webhookSubscription = await getInstagramAccountWebhookSubscriptions({
      instagramProfessionalAccountId: account.accountId,
      accessToken: longLivedToken.accessToken,
    })

    if (!webhookSubscription.webhookSubscribed) {
      throw new Error('Instagram webhook subscription could not be verified')
    }

    const encryptedToken = encryptInstagramAccessToken(longLivedToken.accessToken)
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const { data: connection, error: connectionError } = await admin
      .from('instagram_connections')
      .upsert(
        {
          user_id: state.userId,
          instagram_professional_account_id: account.accountId,
          instagram_username: account.username,
          token_expires_at: longLivedToken.expiresAt,
          connected_at: now,
        },
        { onConflict: 'user_id,instagram_professional_account_id' }
      )
      .select('id')
      .single()

    if (connectionError || !connection) {
      throw new Error('Instagram connection metadata could not be saved')
    }

    const { error: secretError } = await admin
      .from('instagram_connection_secrets')
      .upsert(
        {
          instagram_connection_id: connection.id,
          access_token_ciphertext: encryptedToken.ciphertext,
          encryption_key_version: encryptedToken.keyVersion,
          token_expires_at: longLivedToken.expiresAt,
        },
        { onConflict: 'instagram_connection_id' }
      )

    if (secretError) {
      throw new Error('Instagram connection credential could not be saved')
    }

    return redirectWithStatus(request, 'connected')
  } catch {
    return redirectWithStatus(request, 'connection_failed')
  }
}
