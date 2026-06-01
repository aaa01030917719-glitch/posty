import type { ContentCardMedia } from '@/lib/types'

export type ContentMediaPurpose = 'attachment' | 'inline'

export const CONTENT_MEDIA_ATTACHMENT_SEGMENT = 'attachments'
export const CONTENT_MEDIA_INLINE_SEGMENT = 'inline'

export function getContentMediaPathSegment(purpose: ContentMediaPurpose) {
  return purpose === 'inline' ? CONTENT_MEDIA_INLINE_SEGMENT : CONTENT_MEDIA_ATTACHMENT_SEGMENT
}

function getContentMediaPurposeSegment(storagePath: string) {
  return storagePath.split('/')[2] ?? ''
}

export function isInlineContentMedia(media: Pick<ContentCardMedia, 'storage_path'>) {
  return getContentMediaPurposeSegment(media.storage_path) === CONTENT_MEDIA_INLINE_SEGMENT
}

export function isAttachmentContentMedia(media: Pick<ContentCardMedia, 'storage_path'>) {
  return !isInlineContentMedia(media)
}
