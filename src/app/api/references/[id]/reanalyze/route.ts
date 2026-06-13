import { NextResponse, type NextRequest } from 'next/server'
import {
  ManualReferenceAnalysisError,
  submitManualReferenceAnalysis,
} from '@/lib/references/manual-reference-analysis'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{ id: string }>
}

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { confirmCost?: unknown }

  try {
    body = await request.json() as { confirmCost?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_request_body' }, { status: 400 })
  }

  const { id } = await params
  const admin = createAdminClient()

  try {
    const result = await submitManualReferenceAnalysis({
      admin,
      userId: user.id,
      referenceId: id,
      confirmCost: body.confirmCost === true,
      allowCompletedAnalysis: true,
      jobType: 'realtime',
      submissionSource: 'manual_reanalyze',
      priority: 100,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ManualReferenceAnalysisError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }

    return NextResponse.json({ error: 'reference_reanalysis_submit_failed' }, { status: 500 })
  }
}
