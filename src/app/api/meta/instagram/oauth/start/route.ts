import { NextResponse, type NextRequest } from 'next/server'
import { createInstagramAuthorizeUrl, hasInstagramOAuthConfiguration } from '@/lib/instagram/meta-client'
import { createInstagramOAuthState } from '@/lib/instagram/oauth-state'
import { createClient } from '@/lib/supabase/server'

const OAUTH_STATE_COOKIE = 'posty_instagram_oauth_state'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!hasInstagramOAuthConfiguration()) {
    return NextResponse.redirect(
      new URL('/auto-dm?instagram=configuration_required', request.url)
    )
  }

  const state = createInstagramOAuthState(user.id)
  const response = NextResponse.redirect(createInstagramAuthorizeUrl(state))

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/',
  })

  return response
}
