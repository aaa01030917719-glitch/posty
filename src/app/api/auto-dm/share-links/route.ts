import { NextResponse } from 'next/server'
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

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_share_links')
    .select('id,card_id,expires_at,card:content_cards!inner(title,is_deleted)')
    .eq('user_id', user.id)
    .eq('is_enabled', true)
    .is('disabled_at', null)
    .eq('card.is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '공유자료 목록을 불러오지 못했습니다' }, { status: 500 })
  }

  const now = Date.now()
  const shareLinks = (data ?? [])
    .filter((link) => !link.expires_at || new Date(link.expires_at).getTime() > now)
    .map((link) => {
      const card = Array.isArray(link.card) ? link.card[0] : link.card

      return {
        shareLinkId: link.id,
        cardId: link.card_id,
        title: card?.title ?? '제목 없는 공유자료',
      }
    })

  return NextResponse.json({ shareLinks })
}
