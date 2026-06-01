import type { ContentMediaType } from '@/lib/types'

export const GENERAL_CONTENT_FILE_MAX_SIZE = 50 * 1024 * 1024

export const ALLOWED_GENERAL_FILE_EXTENSIONS = [
  'csv',
  'doc',
  'docx',
  'hwp',
  'hwpx',
  'pdf',
  'ppt',
  'pptx',
  'txt',
  'xls',
  'xlsx',
] as const

export const BLOCKED_CONTENT_FILE_EXTENSIONS = [
  'exe',
  'msi',
  'bat',
  'cmd',
  'ps1',
  'sh',
  'js',
  'html',
  'vbs',
  'scr',
  'com',
  'dll',
  'app',
  'jar',
  'zip',
] as const

const ALLOWED_GENERAL_FILE_MIME_TYPES = new Set([
  'application/csv',
  'application/haansofthwp',
  'application/hwp+zip',
  'application/msword',
  'application/pdf',
  'application/vnd.hancom.hwp',
  'application/vnd.hancom.hwpx',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-hwp',
  'application/x-hwpx',
  'text/csv',
  'text/plain',
])

const ALLOWED_GENERAL_FILE_EXTENSION_SET = new Set<string>(ALLOWED_GENERAL_FILE_EXTENSIONS)
const BLOCKED_CONTENT_FILE_EXTENSION_SET = new Set<string>(BLOCKED_CONTENT_FILE_EXTENSIONS)

export const CONTENT_MEDIA_ATTACHMENT_ACCEPT = [
  'image/*',
  'video/*',
  '.csv',
  '.doc',
  '.docx',
  '.hwp',
  '.hwpx',
  '.pdf',
  '.ppt',
  '.pptx',
  '.txt',
  '.xls',
  '.xlsx',
].join(',')

type FileLike = {
  name: string
  type: string
  size: number
}

export function getContentMediaFileExtension(fileName: string | null | undefined) {
  const normalizedName = fileName?.trim().toLowerCase() ?? ''
  const extension = normalizedName.split('.').pop()

  return extension && extension !== normalizedName ? extension : ''
}

function isBlockedExtension(extension: string) {
  return Boolean(extension) && BLOCKED_CONTENT_FILE_EXTENSION_SET.has(extension)
}

function isAllowedGeneralFile(extension: string, mimeType: string) {
  return (
    ALLOWED_GENERAL_FILE_EXTENSION_SET.has(extension) ||
    ALLOWED_GENERAL_FILE_MIME_TYPES.has(mimeType.toLowerCase())
  )
}

function createContentMediaToken() {
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

function getFallbackExtensionFromMimeType(mimeType: string) {
  const normalizedMimeType = mimeType.trim().toLowerCase()

  if (normalizedMimeType.startsWith('image/jpeg')) return 'jpg'
  if (normalizedMimeType.startsWith('image/png')) return 'png'
  if (normalizedMimeType.startsWith('image/webp')) return 'webp'
  if (normalizedMimeType.startsWith('image/gif')) return 'gif'
  if (normalizedMimeType.startsWith('video/mp4')) return 'mp4'
  if (normalizedMimeType === 'application/pdf') return 'pdf'
  if (normalizedMimeType === 'text/plain') return 'txt'
  if (normalizedMimeType === 'text/csv' || normalizedMimeType === 'application/csv') return 'csv'
  if (normalizedMimeType === 'application/msword') return 'doc'
  if (
    normalizedMimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx'
  }
  if (normalizedMimeType === 'application/vnd.ms-excel') return 'xls'
  if (
    normalizedMimeType ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx'
  }
  if (normalizedMimeType === 'application/vnd.ms-powerpoint') return 'ppt'
  if (
    normalizedMimeType ===
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return 'pptx'
  }
  if (
    normalizedMimeType === 'application/x-hwp' ||
    normalizedMimeType === 'application/haansofthwp' ||
    normalizedMimeType === 'application/vnd.hancom.hwp'
  ) {
    return 'hwp'
  }
  if (
    normalizedMimeType === 'application/x-hwpx' ||
    normalizedMimeType === 'application/vnd.hancom.hwpx' ||
    normalizedMimeType === 'application/hwp+zip'
  ) {
    return 'hwpx'
  }

  return ''
}

function normalizeSafeContentMediaExtension(file: FileLike) {
  const extension = getContentMediaFileExtension(file.name)

  if (/^[a-z0-9]+$/.test(extension)) return extension

  return getFallbackExtensionFromMimeType(file.type)
}

export function createContentMediaStoragePath({
  userId,
  cardId,
  file,
  purpose,
}: {
  userId: string
  cardId: string
  file: FileLike
  purpose: 'attachment' | 'inline'
}) {
  const extension = normalizeSafeContentMediaExtension(file)
  const token = createContentMediaToken().slice(0, 12)
  const fileName = extension ? `${Date.now()}-${token}.${extension}` : `${Date.now()}-${token}`
  const purposeSegment = purpose === 'inline' ? 'inline' : 'attachments'

  return `${userId}/${cardId}/${purposeSegment}/${fileName}`
}

export function getContentMediaTypeFromFile(file: FileLike): ContentMediaType | null {
  const extension = getContentMediaFileExtension(file.name)
  const mimeType = file.type.trim().toLowerCase()

  if (isBlockedExtension(extension)) return null
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (isAllowedGeneralFile(extension, mimeType)) return 'file'

  return null
}

export function validateContentMediaFile(
  file: FileLike,
  purpose: 'attachment' | 'inline'
): string | null {
  const extension = getContentMediaFileExtension(file.name)
  const mediaType = getContentMediaTypeFromFile(file)
  const unsupportedFileMessage =
    '지원하지 않는 파일 형식입니다.\n이미지, 동영상, TXT, PDF 또는 문서 파일을 첨부해주세요'

  if (purpose === 'inline') {
    return mediaType === 'image' ? null : '본문에는 이미지 파일만 삽입할 수 있습니다'
  }

  if (isBlockedExtension(extension)) return unsupportedFileMessage
  if (!mediaType) return unsupportedFileMessage

  if (mediaType === 'file' && file.size > GENERAL_CONTENT_FILE_MAX_SIZE) {
    return '일반 첨부파일은 50MB 이하만 업로드할 수 있습니다.'
  }

  return null
}

export function formatContentMediaFileSize(size: number | null | undefined) {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return '-'
  }

  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`

  return `${(size / 1024 / 1024).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function sanitizeDownloadFileName(fileName: string | null | undefined) {
  const safeName = fileName
    ?.replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim()

  return safeName || 'download'
}

export async function downloadContentMediaFile(downloadUrl: string, originalFileName: string) {
  const response = await fetch(downloadUrl)

  if (!response.ok) {
    throw new Error(`Failed to download content media file: ${response.status}`)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = sanitizeDownloadFileName(originalFileName)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

export function getContentMediaTypeLabel(
  mediaType: ContentMediaType,
  fileName: string | null | undefined
) {
  if (mediaType === 'image') return '이미지'
  if (mediaType === 'video') return '동영상'

  const extension = getContentMediaFileExtension(fileName)
  return extension ? extension.toUpperCase() : '파일'
}
