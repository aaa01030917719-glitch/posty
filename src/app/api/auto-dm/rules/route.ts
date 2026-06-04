import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MEDIA_TYPES = ['POST', 'REEL'] as const

type RuleInput = {
  title?: unknown
  mediaId?: unknown
  mediaType?: unknown
  mediaPermalink?: unknown
  mediaPreviewUrl?: unknown
  keyword?: unknown
  shareLinkId?: unknown
  initialPrivateReplyMessage?: unknown
  publicCommentReplyMessage?: unknown
  followRequiredMessage?: unknown
  materialDeliveryMessage?: unknown
  enabled?: unknown
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

function validateRuleInput(input: RuleInput) {
  const values = {
    title: text(input.title),
    mediaId: text(input.mediaId),
    mediaType: text(input.mediaType),
    mediaPermalink: optionalText(input.mediaPermalink),
    mediaPreviewUrl: optionalText(input.mediaPreviewUrl),
    keyword: text(input.keyword),
    shareLinkId: text(input.shareLinkId),
    initialPrivateReplyMessage: text(input.initialPrivateReplyMessage),
    publicCommentReplyMessage: text(input.publicCommentReplyMessage),
    followRequiredMessage: text(input.followRequiredMessage),
    materialDeliveryMessage: text(input.materialDeliveryMessage),
    enabled: input.enabled !== false,
  }

  if (!values.title || !values.mediaId || !values.keyword || !values.shareLinkId) {
    return { error: '규칙명, 미디어 ID, 키워드, 공유자료는 필수입니다' } as const
  }

  if (!MEDIA_TYPES.includes(values.mediaType as (typeof MEDIA_TYPES)[number])) {
    return { error: '미디어 유형을 확인해주세요' } as const
  }

  if (
    !values.initialPrivateReplyMessage ||
    !values.publicCommentReplyMessage ||
    !values.followRequiredMessage ||
    !values.materialDeliveryMessage
  ) {
    return { error: '메시지 문구를 모두 입력해주세요' } as const
  }

  if (!values.materialDeliveryMessage.includes('{link}')) {
    return { error: '자료 발송 문구에 {link}를 포함해주세요' } as const
  }

  return { values } as const
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

async function getActiveShareLink(admin: ReturnType<typeof createAdminClient>, userId: string, id: string) {
  const { data } = await admin
    .from('content_share_links')
    .select('id,is_enabled,disabled_at,expires_at,card:content_cards!inner(is_deleted)')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .is('disabled_at', null)
    .eq('card.is_deleted', false)
    .maybeSingle()

  if (!data || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) {
    return null
  }

  return data
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

export async function GET() {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('instagram_auto_dm_rules')
    .select(RULE_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '자동 DM 규칙을 불러오지 못했습니다' }, { status: 500 })
  }

  return NextResponse.json({ rules: (data ?? []).map((rule) => safeRule(rule)) })
}

export async function POST(request: Request) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RuleInput

  try {
    body = await request.json() as RuleInput
  } catch {
    return NextResponse.json({ error: '요청 형식을 확인해주세요' }, { status: 400 })
  }

  const validated = validateRuleInput(body)

  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: connection } = await admin
    .from('instagram_connections')
    .select('id')
    .eq('user_id', user.id)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'Instagram 계정을 먼저 연결해주세요' }, { status: 409 })
  }

  const { data: secret } = await admin
    .from('instagram_connection_secrets')
    .select('id')
    .eq('instagram_connection_id', connection.id)
    .maybeSingle()

  if (!secret) {
    return NextResponse.json({ error: 'Instagram 계정을 다시 연결해주세요' }, { status: 409 })
  }

  if (!await getActiveShareLink(admin, user.id, validated.values.shareLinkId)) {
    return NextResponse.json({ error: '사용 가능한 공유자료를 선택해주세요' }, { status: 400 })
  }

  const values = validated.values
  const { data, error } = await admin
    .from('instagram_auto_dm_rules')
    .insert({
      user_id: user.id,
      instagram_connection_id: connection.id,
      share_link_id: values.shareLinkId,
      title: values.title,
      media_id: values.mediaId,
      media_type: values.mediaType,
      media_permalink: values.mediaPermalink,
      media_preview_url: values.mediaPreviewUrl,
      keyword: values.keyword,
      initial_private_reply_message: values.initialPrivateReplyMessage,
      public_comment_reply_message: values.publicCommentReplyMessage,
      follow_required_message: values.followRequiredMessage,
      material_delivery_message: values.materialDeliveryMessage,
      enabled: values.enabled,
    })
    .select(RULE_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 이 영상에 등록된 자동 DM 규칙이 있습니다' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: '자동 DM 규칙을 저장하지 못했습니다' }, { status: 500 })
  }

  return NextResponse.json({ rule: safeRule(data) }, { status: 201 })
}
