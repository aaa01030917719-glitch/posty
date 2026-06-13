import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{ integrationId: string }>
}

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { autoAnalyzeNewLinks?: unknown }

  try {
    body = await request.json() as { autoAnalyzeNewLinks?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_request_body' }, { status: 400 })
  }

  if (typeof body.autoAnalyzeNewLinks !== 'boolean') {
    return NextResponse.json({ error: 'auto_analyze_new_links_required' }, { status: 400 })
  }

  const { integrationId } = await params
  const admin = createAdminClient()

  const { data: integration, error: lookupError } = await admin
    .from('linkko_folder_integrations')
    .select('id,is_enabled')
    .eq('id', integrationId)
    .eq('posty_user_id', user.id)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: 'folder_integration_lookup_failed' }, { status: 500 })
  }

  if (!integration) {
    return NextResponse.json({ error: 'folder_integration_not_found' }, { status: 404 })
  }

  if (!integration.is_enabled && body.autoAnalyzeNewLinks) {
    return NextResponse.json({ error: 'disabled_folder_auto_analysis_forbidden' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('linkko_folder_integrations')
    .update({ auto_analyze_new_links: body.autoAnalyzeNewLinks })
    .eq('id', integrationId)
    .eq('posty_user_id', user.id)
    .select('id,folder_name,is_enabled,auto_analyze_new_links,created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'folder_auto_analysis_update_failed' }, { status: 500 })
  }

  return NextResponse.json({ folder: data })
}
