import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicSharePage = pathname.startsWith('/share/content/')
  const isPublicLegalPage = pathname === '/privacy-policy' || pathname === '/data-deletion'
  const isInstagramOauthCallback = pathname === '/api/meta/instagram/oauth/callback'
  const isInstagramWebhook = pathname === '/api/meta/instagram/webhook'
  const isLinkkoReferenceEvent = pathname === '/api/integrations/linkko/events'
  const isReferenceQueueProcessor = pathname === '/api/references/process-queue'
  const isReferenceManusReconcile = pathname === '/api/references/reconcile-manus'
  const isManusWebhook = pathname === '/api/webhooks/manus'

  if (
    isPublicSharePage ||
    isPublicLegalPage ||
    isInstagramOauthCallback ||
    isInstagramWebhook ||
    isLinkkoReferenceEvent ||
    isReferenceQueueProcessor ||
    isReferenceManusReconcile ||
    isManusWebhook
  ) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = pathname.startsWith('/login') ||
    pathname.startsWith('/signup')

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/schedule', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
