import { NextResponse, type NextRequest } from 'next/server'
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  getInstagramAccountWebhookSubscriptions,
  getInstagramProfessionalAccount,
  hasInstagramOAuthConfiguration,
  InstagramMetaError,
  subscribeInstagramAccountToWebhooks,
} from '@/lib/instagram/meta-client'
import { statesMatch, verifyInstagramOAuthState } from '@/lib/instagram/oauth-state'
import { encryptInstagramAccessToken } from '@/lib/instagram/token-crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const OAUTH_STATE_COOKIE = 'posty_instagram_oauth_state'
const SAFE_ERROR_MESSAGE_MAX_LENGTH = 180

type InstagramOAuthCallbackStage =
  | 'callback_received'
  | 'state_validated'
  | 'code_received'
  | 'short_lived_token_exchange_started'
  | 'short_lived_token_exchanged'
  | 'long_lived_token_exchange_started'
  | 'long_lived_token_exchanged'
  | 'professional_account_load_started'
  | 'professional_account_loaded'
  | 'webhook_subscribe_started'
  | 'webhook_subscribe_completed'
  | 'webhook_verify_started'
  | 'webhook_verify_completed'
  | 'connection_upsert_started'
  | 'connection_upsert_completed'
  | 'secret_upsert_started'
  | 'secret_upsert_completed'

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown Instagram OAuth callback error'

  return message
    .replace(/access_token=[^\s&]+/gi, 'access_token=[redacted]')
    .replace(/client_secret=[^\s&]+/gi, 'client_secret=[redacted]')
    .replace(/code=[^\s&]+/gi, 'code=[redacted]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .slice(0, SAFE_ERROR_MESSAGE_MAX_LENGTH)
}

function logInstagramOAuthCallbackFailure(stage: InstagramOAuthCallbackStage, error: unknown) {
  const metaError = error instanceof InstagramMetaError ? error : null

  console.error('[instagram-oauth-callback]', {
    stage,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorMessage: safeErrorMessage(error),
    status: metaError?.status,
    metaCode: metaError?.metaCode,
    metaType: metaError?.metaType,
    fbtraceId: metaError?.fbtraceId,
    requestedFields: metaError?.requestedFields,
    returnedFields: metaError?.returnedFields,
    missingFields: metaError?.missingFields,
  })
}

function redirectWithStatus(request: NextRequest, status: string) {
  const response = NextResponse.redirect(new URL(`/auto-dm?instagram=${status}`, request.url))

  response.cookies.delete(OAUTH_STATE_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  let stage: InstagramOAuthCallbackStage = 'callback_received'
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

  stage = 'state_validated'

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

  stage = 'code_received'

  try {
    stage = 'short_lived_token_exchange_started'
    const shortLivedToken = await exchangeCodeForShortLivedToken(code)
    stage = 'short_lived_token_exchanged'

    stage = 'long_lived_token_exchange_started'
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken)
    stage = 'long_lived_token_exchanged'

    stage = 'professional_account_load_started'
    const account = await getInstagramProfessionalAccount(longLivedToken.accessToken)
    stage = 'professional_account_loaded'

    stage = 'webhook_subscribe_started'
    await subscribeInstagramAccountToWebhooks({
      instagramProfessionalAccountId: account.accountId,
      accessToken: longLivedToken.accessToken,
    })
    stage = 'webhook_subscribe_completed'

    stage = 'webhook_verify_started'
    const webhookSubscription = await getInstagramAccountWebhookSubscriptions({
      instagramProfessionalAccountId: account.accountId,
      accessToken: longLivedToken.accessToken,
    })

    if (!webhookSubscription.webhookSubscribed) {
      throw new Error('Instagram webhook subscription could not be verified')
    }
    stage = 'webhook_verify_completed'

    const encryptedToken = encryptInstagramAccessToken(longLivedToken.accessToken)
    const admin = createAdminClient()
    const now = new Date().toISOString()
    stage = 'connection_upsert_started'
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
    stage = 'connection_upsert_completed'

    stage = 'secret_upsert_started'
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
    stage = 'secret_upsert_completed'

    return redirectWithStatus(request, 'connected')
  } catch (error) {
    logInstagramOAuthCallbackFailure(stage, error)
    return redirectWithStatus(request, 'connection_failed')
  }
}
