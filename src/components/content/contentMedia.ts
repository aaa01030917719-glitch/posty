import { createClient } from '@/lib/supabase/client'
import {
  getContentMediaPathSegment,
  type ContentMediaPurpose,
} from '@/lib/content-media-purpose'
import type { ContentCardMedia, ContentMediaType } from '@/lib/types'

export type SignedContentCardMedia = ContentCardMedia & {
  signedUrl: string | null
}

export const MEDIA_BUCKET_NAME = 'content-card-media'
export const MEDIA_SIGNED_URL_EXPIRES_IN = 60 * 60

function createShareToken() {
  const browserCrypto = globalThis.crypto

  if (browserCrypto?.randomUUID) {
    return browserCrypto.randomUUID().replaceAll('-', '')
  }

  const randomValues =
    browserCrypto?.getRandomValues
      ? Array.from(browserCrypto.getRandomValues(new Uint8Array(24)))
      : Array.from({ length: 24 }, () => Math.floor(Math.random() * 256))

  return randomValues.map((value) => value.toString(16).padStart(2, '0')).join('')
}

export function getMediaType(mimeType: string): ContentMediaType | null {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'

  return null
}

function sanitizeMediaFileName(fileName: string) {
  const safeName = fileName
    .trim()
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '-')
    .replace(/\s+/g, '-')

  return safeName || 'media'
}

function createMediaStoragePath(
  userId: string,
  cardId: string,
  file: File,
  index: number,
  purpose: ContentMediaPurpose
) {
  const safeName = sanitizeMediaFileName(file.name)
  const token = createShareToken().slice(0, 12)
  const purposeSegment = getContentMediaPathSegment(purpose)

  return `${userId}/${cardId}/${purposeSegment}/${Date.now()}-${index + 1}-${token}-${safeName}`
}

export function sortMediaItems<T extends Pick<ContentCardMedia, 'sort_order' | 'created_at'>>(
  items: T[]
) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export async function createSignedMediaItems(
  supabase: ReturnType<typeof createClient>,
  rows: ContentCardMedia[]
): Promise<SignedContentCardMedia[]> {
  const sortedRows = sortMediaItems(rows)

  return Promise.all(
    sortedRows.map(async (row) => {
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET_NAME)
        .createSignedUrl(row.storage_path, MEDIA_SIGNED_URL_EXPIRES_IN)

      if (error) {
        console.error('Failed to create content media signed URL', error)
      }

      return {
        ...row,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )
}

export async function uploadContentCardMediaFiles({
  supabase,
  userId,
  cardId,
  files,
  baseSortOrder,
  purpose = 'attachment',
}: {
  supabase: ReturnType<typeof createClient>
  userId: string
  cardId: string
  files: File[]
  baseSortOrder: number
  purpose?: ContentMediaPurpose
}) {
  const uploadableFiles = files
    .map((file) => ({
      file,
      mediaType: getMediaType(file.type),
    }))
    .filter(
      (entry): entry is { file: File; mediaType: ContentMediaType } =>
        entry.mediaType !== null && (purpose === 'attachment' || entry.mediaType === 'image')
    )

  const uploadedItems: SignedContentCardMedia[] = []

  for (const [index, { file, mediaType }] of uploadableFiles.entries()) {
    const storagePath = createMediaStoragePath(userId, cardId, file, index, purpose)
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET_NAME)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: insertedMedia, error: insertError } = await supabase
      .from('content_card_media')
      .insert({
        user_id: userId,
        card_id: cardId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || null,
        media_type: mediaType,
        sort_order: baseSortOrder + index + 1,
      })
      .select('*')
      .single()

    if (insertError) {
      await supabase.storage.from(MEDIA_BUCKET_NAME).remove([storagePath])
      throw insertError
    }

    const [signedItem] = await createSignedMediaItems(supabase, [
      insertedMedia as ContentCardMedia,
    ])
    uploadedItems.push(signedItem)
  }

  return uploadedItems
}
