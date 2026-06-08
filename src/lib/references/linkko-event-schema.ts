export const LINKKO_REFERENCE_EVENT_SCHEMA_VERSION = 'linkko_posty_reference_event_v1'

export const LINKKO_REFERENCE_EVENT_TYPES = [
  'reference.upsert',
  'reference.delete',
  'reference.backfill',
  'reference.reconcile',
  'folder.disconnect',
] as const

export type LinkkoReferenceEventType = (typeof LINKKO_REFERENCE_EVENT_TYPES)[number]
export type LinkkoReferenceEventMode = 'realtime' | 'backfill' | 'reconcile'

export type LinkkoReferenceEvent = {
  schemaVersion: typeof LINKKO_REFERENCE_EVENT_SCHEMA_VERSION
  eventId: string
  eventType: LinkkoReferenceEventType
  occurredAt: string
  linkkoUserId: string
  link: {
    id: string | null
    folderId: string | null
    folderName: string | null
    url: string | null
    customTitle: string | null
    memo: string | null
    previewTitle: string | null
    previewDescription: string | null
    previewImage: string | null
    previewSiteName: string | null
    createdAt: string | null
  }
  metadata: {
    mode: LinkkoReferenceEventMode
  }
}

type ValidationResult =
  | { event: LinkkoReferenceEvent }
  | { error: string }

const EVENT_TYPES = new Set<string>(LINKKO_REFERENCE_EVENT_TYPES)
const EVENT_MODES = new Set<string>(['realtime', 'backfill', 'reconcile'])

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function requiredString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value.trim() || null : null
}

function isIsoTimestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed)
}

function hasValidUuidShape(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validateLinkkoReferenceEvent(payload: unknown): ValidationResult {
  const root = asRecord(payload)
  if (!root) return { error: 'invalid_payload' }

  if (root.schemaVersion !== LINKKO_REFERENCE_EVENT_SCHEMA_VERSION) {
    return { error: 'unsupported_schema_version' }
  }

  const eventId = requiredString(root.eventId)
  const eventType = requiredString(root.eventType)
  const occurredAt = requiredString(root.occurredAt)
  const linkkoUserId = requiredString(root.linkkoUserId)
  const link = asRecord(root.link)
  const metadata = asRecord(root.metadata)
  const mode = requiredString(metadata?.mode)

  if (!eventId || !hasValidUuidShape(eventId)) return { error: 'invalid_event_id' }
  if (!eventType || !EVENT_TYPES.has(eventType)) return { error: 'invalid_event_type' }
  if (!occurredAt || !isIsoTimestamp(occurredAt)) return { error: 'invalid_occurred_at' }
  if (!linkkoUserId || !hasValidUuidShape(linkkoUserId)) return { error: 'invalid_linkko_user_id' }
  if (!link) return { error: 'invalid_link' }
  if (!mode || !EVENT_MODES.has(mode)) return { error: 'invalid_mode' }

  const normalizedLink = {
    id: nullableString(link.id),
    folderId: nullableString(link.folderId),
    folderName: nullableString(link.folderName),
    url: nullableString(link.url),
    customTitle: nullableString(link.customTitle),
    memo: nullableString(link.memo),
    previewTitle: nullableString(link.previewTitle),
    previewDescription: nullableString(link.previewDescription),
    previewImage: nullableString(link.previewImage),
    previewSiteName: nullableString(link.previewSiteName),
    createdAt: nullableString(link.createdAt),
  }

  if (normalizedLink.id && !hasValidUuidShape(normalizedLink.id)) return { error: 'invalid_link_id' }
  if (normalizedLink.folderId && !hasValidUuidShape(normalizedLink.folderId)) {
    return { error: 'invalid_folder_id' }
  }
  if (normalizedLink.createdAt && !isIsoTimestamp(normalizedLink.createdAt)) {
    return { error: 'invalid_link_created_at' }
  }

  if (
    (eventType === 'reference.upsert' || eventType === 'reference.backfill') &&
    (!normalizedLink.id || !normalizedLink.url)
  ) {
    return { error: 'link_id_and_url_required' }
  }

  if (eventType === 'reference.delete' && !normalizedLink.id) {
    return { error: 'link_id_required' }
  }

  if (eventType === 'folder.disconnect' && !normalizedLink.folderId) {
    return { error: 'folder_id_required' }
  }

  return {
    event: {
      schemaVersion: LINKKO_REFERENCE_EVENT_SCHEMA_VERSION,
      eventId,
      eventType: eventType as LinkkoReferenceEventType,
      occurredAt,
      linkkoUserId,
      link: normalizedLink,
      metadata: {
        mode: mode as LinkkoReferenceEventMode,
      },
    },
  }
}
