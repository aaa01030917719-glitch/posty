import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  canonicalizeReferenceUrl,
  type ReferencePlatform,
} from '@/lib/references/canonical-url'
import type {
  LinkkoReferenceEvent,
  LinkkoReferenceEventMode,
  LinkkoReferenceEventType,
} from '@/lib/references/linkko-event-schema'

type AdminClient = ReturnType<typeof createAdminClient>

type LinkkoConnection = {
  id: string
  posty_user_id: string
}

type ExistingReference = {
  id: string
  title: string | null
  thumbnail_url: string | null
  latest_analysis_id: string | null
  analysis_status: string
}

type LinkkoEventProcessResult =
  | { status: 'duplicate'; eventId: string }
  | {
      status: 'processed'
      eventId: string
      action: LinkkoReferenceEventType
      referenceId?: string
      analysisJobQueued?: boolean
    }

const ACTIVE_JOB_STATUSES = ['queued', 'processing', 'submitted', 'retry_scheduled']
const ANALYZABLE_PLATFORMS = new Set<ReferencePlatform>(['instagram_reel'])

function syncEventType(event: LinkkoReferenceEvent) {
  if (event.eventType === 'reference.delete') return 'reference_deleted'
  if (event.eventType === 'reference.backfill') return 'backfill_page_imported'
  if (event.eventType === 'folder.disconnect') return 'folder_disconnected'

  return 'reference_updated'
}

function preferredTitle(event: LinkkoReferenceEvent, existing?: ExistingReference | null) {
  return event.link.customTitle ?? event.link.previewTitle ?? existing?.title ?? null
}

function preferredThumbnail(event: LinkkoReferenceEvent, existing?: ExistingReference | null) {
  return event.link.previewImage ?? existing?.thumbnail_url ?? null
}

function jobTypeForMode(mode: LinkkoReferenceEventMode) {
  if (mode === 'backfill') {
    return { jobType: 'backfill', priority: 50 } as const
  }

  return { jobType: 'realtime', priority: 100 } as const
}

async function getActiveConnection(admin: AdminClient, linkkoUserId: string) {
  const { data, error } = await admin
    .from('linkko_account_connections')
    .select('id,posty_user_id,status,disconnected_at')
    .eq('linkko_user_id', linkkoUserId)
    .eq('status', 'connected')
    .is('disconnected_at', null)
    .limit(2)

  if (error) {
    throw new Error('connection_lookup_failed')
  }

  if (!data?.length) {
    return { error: 'account_connection_required' } as const
  }

  if (data.length > 1) {
    return { error: 'ambiguous_account_connection' } as const
  }

  return { connection: data[0] as LinkkoConnection } as const
}

async function ensureFolderIntegration(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection
) {
  const folderId = event.link.folderId

  if (!folderId) {
    if (
      event.eventType === 'reference.upsert' ||
      event.eventType === 'reference.backfill' ||
      event.eventType === 'folder.disconnect'
    ) {
      return { error: 'folder_integration_required' } as const
    }

    return { integrationId: null } as const
  }

  const { data, error } = await admin
    .from('linkko_folder_integrations')
    .select('id')
    .eq('posty_user_id', connection.posty_user_id)
    .eq('linkko_folder_id', folderId)
    .eq('is_enabled', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error('folder_integration_lookup_failed')
  }

  if (!data) {
    return { error: 'folder_integration_required' } as const
  }

  return { integrationId: data.id as string } as const
}

async function getExistingSyncEvent(admin: AdminClient, event: LinkkoReferenceEvent) {
  const { data, error } = await admin
    .from('reference_sync_events')
    .select('id,processed_at')
    .eq('source_system', 'linkko')
    .eq('source_event_id', event.eventId)
    .maybeSingle()

  if (error) {
    throw new Error('sync_event_lookup_failed')
  }

  return data as { id: string; processed_at: string | null } | null
}

async function createSyncEvent(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection,
  payload: unknown
) {
  const { data, error } = await admin
    .from('reference_sync_events')
    .insert({
      user_id: connection.posty_user_id,
      source_system: 'linkko',
      source_event_id: event.eventId,
      source_item_id: event.link.id,
      event_type: syncEventType(event),
      payload,
    })
    .select('id,processed_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return getExistingSyncEvent(admin, event)
    }

    throw new Error('sync_event_insert_failed')
  }

  return data as { id: string; processed_at: string | null }
}

async function markSyncEventProcessed(admin: AdminClient, syncEventId: string) {
  const { error } = await admin
    .from('reference_sync_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', syncEventId)

  if (error) {
    throw new Error('sync_event_update_failed')
  }
}

async function getReferenceByFingerprint(
  admin: AdminClient,
  userId: string,
  fingerprint: string
) {
  const { data, error } = await admin
    .from('references')
    .select('id,title,thumbnail_url,latest_analysis_id,analysis_status')
    .eq('user_id', userId)
    .eq('url_fingerprint', fingerprint)
    .maybeSingle()

  if (error) {
    throw new Error('reference_lookup_failed')
  }

  return data as ExistingReference | null
}

async function upsertReference(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection
) {
  if (!event.link.url) {
    throw new Error('url_required')
  }

  const canonical = canonicalizeReferenceUrl(event.link.url)
  const existing = await getReferenceByFingerprint(
    admin,
    connection.posty_user_id,
    canonical.fingerprint
  )
  const title = preferredTitle(event, existing)
  const thumbnailUrl = preferredThumbnail(event, existing)
  const now = new Date().toISOString()

  if (existing) {
    const { data, error } = await admin
      .from('references')
      .update({
        canonical_url: canonical.canonicalUrl,
        canonicalizer_version: canonical.canonicalizerVersion,
        platform: canonical.platform,
        title,
        thumbnail_url: thumbnailUrl,
        last_seen_at: now,
      })
      .eq('id', existing.id)
      .eq('user_id', connection.posty_user_id)
      .select('id,title,thumbnail_url,latest_analysis_id,analysis_status')
      .single()

    if (error) {
      throw new Error('reference_update_failed')
    }

    return {
      reference: data as ExistingReference,
      platform: canonical.platform,
      created: false,
    }
  }

  const { data, error } = await admin
    .from('references')
    .insert({
      user_id: connection.posty_user_id,
      canonical_url: canonical.canonicalUrl,
      url_fingerprint: canonical.fingerprint,
      canonicalizer_version: canonical.canonicalizerVersion,
      platform: canonical.platform,
      title,
      thumbnail_url: thumbnailUrl,
      analysis_status: 'pending',
      first_seen_at: now,
      last_seen_at: now,
    })
    .select('id,title,thumbnail_url,latest_analysis_id,analysis_status')
    .single()

  if (error) {
    throw new Error('reference_insert_failed')
  }

  return {
    reference: data as ExistingReference,
    platform: canonical.platform,
    created: true,
  }
}

async function upsertReferenceSource(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection,
  referenceId: string
) {
  if (!event.link.id || !event.link.url) {
    throw new Error('source_required')
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('reference_sources')
    .upsert(
      {
        user_id: connection.posty_user_id,
        reference_id: referenceId,
        source_system: 'linkko',
        source_item_id: event.link.id,
        source_folder_id: event.link.folderId,
        source_folder_name: event.link.folderName,
        raw_url: event.link.url,
        custom_title: event.link.customTitle,
        preview_title: event.link.previewTitle,
        preview_description: event.link.previewDescription,
        preview_image: event.link.previewImage,
        preview_site_name: event.link.previewSiteName,
        memo: event.link.memo,
        source_created_at: event.link.createdAt,
        source_deleted_at: null,
        last_seen_at: now,
      },
      { onConflict: 'user_id,source_system,source_item_id' }
    )

  if (error) {
    throw new Error('reference_source_upsert_failed')
  }
}

async function hasActiveAnalysisJob(admin: AdminClient, userId: string, referenceId: string) {
  const { data, error } = await admin
    .from('reference_analysis_jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('reference_id', referenceId)
    .in('status', ACTIVE_JOB_STATUSES)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error('analysis_job_lookup_failed')
  }

  return Boolean(data)
}

async function enqueueAnalysisJobIfNeeded(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection,
  reference: ExistingReference,
  platform: ReferencePlatform
) {
  if (!ANALYZABLE_PLATFORMS.has(platform)) return false
  if (event.metadata.mode === 'reconcile') return false
  if (reference.latest_analysis_id) return false

  const hasActiveJob = await hasActiveAnalysisJob(
    admin,
    connection.posty_user_id,
    reference.id
  )

  if (hasActiveJob) return false

  const jobPolicy = jobTypeForMode(event.metadata.mode)
  const { error } = await admin
    .from('reference_analysis_jobs')
    .insert({
      user_id: connection.posty_user_id,
      reference_id: reference.id,
      job_type: jobPolicy.jobType,
      status: 'queued',
      priority: jobPolicy.priority,
    })

  if (error) {
    if (error.code === '23505') {
      return false
    }

    throw new Error('analysis_job_insert_failed')
  }

  await admin
    .from('references')
    .update({ analysis_status: 'queued' })
    .eq('id', reference.id)
    .eq('user_id', connection.posty_user_id)

  return true
}

async function processReferenceUpsert(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection
) {
  const integration = await ensureFolderIntegration(admin, event, connection)
  if ('error' in integration) return { error: integration.error } as const

  const { reference, platform } = await upsertReference(admin, event, connection)
  await upsertReferenceSource(admin, event, connection, reference.id)
  const analysisJobQueued = await enqueueAnalysisJobIfNeeded(
    admin,
    event,
    connection,
    reference,
    platform
  )

  return { referenceId: reference.id, analysisJobQueued } as const
}

async function processReferenceDelete(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection
) {
  if (!event.link.id) return { error: 'link_id_required' } as const

  const { error } = await admin
    .from('reference_sources')
    .update({
      source_deleted_at: event.occurredAt,
      last_seen_at: new Date().toISOString(),
    })
    .eq('user_id', connection.posty_user_id)
    .eq('source_system', 'linkko')
    .eq('source_item_id', event.link.id)

  if (error) {
    throw new Error('reference_source_soft_delete_failed')
  }

  return {} as const
}

async function processFolderDisconnect(
  admin: AdminClient,
  event: LinkkoReferenceEvent,
  connection: LinkkoConnection
) {
  if (!event.link.folderId) return { error: 'folder_id_required' } as const

  const { data, error } = await admin
    .from('linkko_folder_integrations')
    .update({
      is_enabled: false,
      disconnected_at: event.occurredAt,
    })
    .eq('posty_user_id', connection.posty_user_id)
    .eq('linkko_folder_id', event.link.folderId)
    .eq('is_enabled', true)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error('folder_disconnect_failed')
  }

  if (!data) {
    return { error: 'folder_integration_required' } as const
  }

  return {} as const
}

export async function processLinkkoReferenceEvent(
  payload: unknown,
  event: LinkkoReferenceEvent
): Promise<LinkkoEventProcessResult> {
  const admin = createAdminClient()
  const connectionResult = await getActiveConnection(admin, event.linkkoUserId)

  if ('error' in connectionResult) {
    throw new Error(connectionResult.error)
  }

  const { connection } = connectionResult
  const existingSyncEvent = await getExistingSyncEvent(admin, event)

  if (existingSyncEvent?.processed_at) {
    return { status: 'duplicate', eventId: event.eventId }
  }

  const syncEvent = existingSyncEvent ?? await createSyncEvent(
    admin,
    event,
    connection,
    payload
  )

  if (!syncEvent) {
    throw new Error('sync_event_insert_failed')
  }

  let processed:
    | { referenceId?: string; analysisJobQueued?: boolean; error?: string }
    | undefined

  if (
    event.eventType === 'reference.upsert' ||
    event.eventType === 'reference.backfill' ||
    event.eventType === 'reference.reconcile'
  ) {
    if (event.eventType === 'reference.reconcile' && (!event.link.id || !event.link.url)) {
      processed = { analysisJobQueued: false }
    } else {
      processed = await processReferenceUpsert(admin, event, connection)
    }
  } else if (event.eventType === 'reference.delete') {
    processed = await processReferenceDelete(admin, event, connection)
  } else if (event.eventType === 'folder.disconnect') {
    processed = await processFolderDisconnect(admin, event, connection)
  }

  if (processed?.error) {
    throw new Error(processed.error)
  }

  await markSyncEventProcessed(admin, syncEvent.id)

  return {
    status: 'processed',
    eventId: event.eventId,
    action: event.eventType,
    referenceId: processed?.referenceId,
    analysisJobQueued: processed?.analysisJobQueued,
  }
}
