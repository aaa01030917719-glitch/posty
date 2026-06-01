import { createClient } from '@/lib/supabase/client'
import type { ContentMediaPurpose } from '@/lib/content-media-purpose'
import {
  CONTENT_MEDIA_ATTACHMENT_ACCEPT,
  createContentMediaStoragePath,
  getContentMediaTypeFromFile,
  validateContentMediaFile,
} from '@/lib/content-media-files'
import type { ContentCardMedia, ContentMediaType } from '@/lib/types'

export type SignedContentCardMedia = ContentCardMedia & {
  signedUrl: string | null
}

export const MEDIA_BUCKET_NAME = 'content-card-media'
export const MEDIA_SIGNED_URL_EXPIRES_IN = 60 * 60
export { CONTENT_MEDIA_ATTACHMENT_ACCEPT }

export function getMediaType(mimeType: string, fileName = ''): ContentMediaType | null {
  return getContentMediaTypeFromFile({
    name: fileName,
    type: mimeType,
    size: 0,
  })
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
      const downloadFileName = row.media_type === 'file' ? row.file_name?.trim() ?? '' : ''
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET_NAME)
        .createSignedUrl(
          row.storage_path,
          MEDIA_SIGNED_URL_EXPIRES_IN,
          downloadFileName ? { download: downloadFileName } : undefined
        )

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
      mediaType: getContentMediaTypeFromFile(file),
      rejectionMessage: validateContentMediaFile(file, purpose),
    }))
    .filter(
      (
        entry
      ): entry is {
        file: File
        mediaType: ContentMediaType
        rejectionMessage: null
      } => entry.mediaType !== null && entry.rejectionMessage === null
    )

  const firstRejection = files
    .map((file) => validateContentMediaFile(file, purpose))
    .find((message): message is string => Boolean(message))

  if (firstRejection) {
    throw new Error(firstRejection)
  }

  const uploadedItems: SignedContentCardMedia[] = []

  for (const [index, { file, mediaType }] of uploadableFiles.entries()) {
    const storagePath = createContentMediaStoragePath({
      userId,
      cardId,
      file,
      purpose,
    })
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
        file_size: file.size,
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
