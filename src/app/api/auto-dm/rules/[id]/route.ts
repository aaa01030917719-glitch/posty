import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ id: string }>
}

const MEDIA_TYPES = ['POST', 'REEL'] as const
const ALLOWED_FIELDS = new Set([
  'title',
  'mediaId',
  'mediaType',
  'mediaPermalink',
  'mediaPreviewUrl',
  'keyword',
  'shareLinkId',
  'initialPrivateReplyMessage',
  'publicCommentReplyMessage',
  'followRequiredMessage',
  'materialDeliveryMessage',
  'enabled',
])

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function safeRule(rule: Record<string, unknown>) {
  const rawShareLink = rule.share_link as
    | { card?: { title?: string | null } | { title?: string | null }[] | null }
    | { card?: { title?: string | null } | { title?: string | null }[] | null }[]
    | null
    | undefined
  const shareLink = Array.isArray(rawShareLink) ? rawShareLink[0] : rawShareLink
  const card = Array.isArray(shareLink?.card) ? shareLink.card[0] : shareLink?.card

  return {
    id: rule.id,
    title: rule.title,
    mediaId: rule.media_id,
    mediaType: rule.media_type,
    mediaPermalink: rule.media_permalink,
    mediaPreviewUrl: rule.media_preview_url,
    keyword: rule.keyword,
    shareLinkId: rule.share_link_id,
    shareMaterialTitle: card?.title ?? null,
    initialPrivateReplyMessage: rule.initial_private_reply_message,
    publicCommentReplyMessage: rule.public_comment_reply_message,
    followRequiredMessage: rule.follow_required_message,
    materialDeliveryMessage: rule.material_delivery_message,
    enabled: rule.enabled,
    createdAt: rule.created_at,
    updatedAt: rule.updated_at,
  }
}

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

const RULE_SELECT = `
  id,
  title,
  media_id,
  media_type,
  media_permalink,
  media_preview_url,
  keyword,
  share_link_id,
  initial_private_reply_message,
  public_comment_reply_message,
  follow_required_message,
  material_delivery_message,
  enabled,
  created_at,
  updated_at,
  share_link:content_share_links(card:content_cards(title))
`

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>

  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '요청 형식을 확인해주세요' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue

    if (key === 'enabled') {
      if (typeof body[key] !== 'boolean') {
        return NextResponse.json({ error: '활성화 값을 확인해주세요' }, { status: 400 })
      }
      updates.enabled = body[key]
      continue
    }

    const value = text(body[key])

    if (key === 'mediaPermalink' || key === 'mediaPreviewUrl') {
      updates[key === 'mediaPermalink' ? 'media_permalink' : 'media_preview_url'] = value || null
      continue
    }

    if (!value) {
      return NextResponse.json({ error: '필수 입력값을 확인해주세요' }, { status: 400 })
    }

    const column = {
      title: 'title',
      mediaId: 'media_id',
      mediaType: 'media_type',
      keyword: 'keyword',
      shareLinkId: 'share_link_id',
      initialPrivateReplyMessage: 'initial_private_reply_message',
      publicCommentReplyMessage: 'public_comment_reply_message',
      followRequiredMessage: 'follow_required_message',
      materialDeliveryMessage: 'material_delivery_message',
    }[key]

    if (column) updates[column] = value
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: '변경할 내용을 확인해주세요' }, { status: 400 })
  }

  if (updates.media_type && !MEDIA_TYPES.includes(updates.media_type as (typeof MEDIA_TYPES)[number])) {
    return NextResponse.json({ error: '미디어 유형을 확인해주세요' }, { status: 400 })
  }

  if (
    typeof updates.material_delivery_message === 'string' &&
    !updates.material_delivery_message.includes('{link}')
  ) {
    return NextResponse.json({ error: '자료 발송 문구에 {link}를 포함해주세요' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (
    typeof updates.share_link_id === 'string' &&
    !await isActiveShareLink(admin, user.id, updates.share_link_id)
  ) {
    return NextResponse.json({ error: '사용 가능한 공유자료를 선택해주세요' }, { status: 400 })
  }

  const { id } = await context.params
  const { data, error } = await admin
    .from('instagram_auto_dm_rules')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(RULE_SELECT)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 이 영상에 등록된 자동 DM 규칙이 있습니다' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: '자동 DM 규칙을 수정하지 못했습니다' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: '자동 DM 규칙을 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json({ rule: safeRule(data) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('instagram_auto_dm_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: '자동 DM 규칙을 삭제하지 못했습니다' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: '자동 DM 규칙을 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}

async function isActiveShareLink(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  id: string
) {
  const { data } = await admin
    .from('content_share_links')
    .select('id,expires_at,card:content_cards!inner(is_deleted)')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .is('disabled_at', null)
    .eq('card.is_deleted', false)
    .maybeSingle()

  return Boolean(data && (!data.expires_at || new Date(data.expires_at).getTime() > Date.now()))
}
