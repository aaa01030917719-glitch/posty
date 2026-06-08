import { createHash } from 'node:crypto'

export const REFERENCE_CANONICALIZER_VERSION = 'posty-reference-url-v1'

export type ReferencePlatform =
  | 'instagram_reel'
  | 'instagram_post'
  | 'threads'
  | 'youtube_short'
  | 'youtube'
  | 'web'
  | 'unknown'

export type CanonicalReferenceUrl = {
  canonicalUrl: string
  fingerprint: string
  platform: ReferencePlatform
  canonicalizerVersion: typeof REFERENCE_CANONICALIZER_VERSION
}

const TRACKING_PARAM_PREFIXES = ['utm_']
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'si',
  'spm',
])

function normalizeUrlInput(rawUrl: string) {
  const value = rawUrl.trim()

  if (!value) {
    throw new Error('URL is required')
  }

  if (value.startsWith('//')) return `https:${value}`
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return `https://${value}`

  return value
}

function removeTrackingParams(url: URL) {
  for (const key of Array.from(url.searchParams.keys())) {
    const normalizedKey = key.toLowerCase()

    if (
      TRACKING_PARAMS.has(normalizedKey) ||
      TRACKING_PARAM_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))
    ) {
      url.searchParams.delete(key)
    }
  }

  url.searchParams.sort()
}

function normalizePathname(pathname: string) {
  const withoutDuplicateSlashes = pathname.replace(/\/{2,}/g, '/')
  if (withoutDuplicateSlashes === '/') return '/'

  return withoutDuplicateSlashes.replace(/\/+$/, '')
}

function getInstagramShortcode(pathname: string, segment: 'reel' | 'p') {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== segment || !parts[1]) return null

  return parts[1]
}

function getYoutubeVideoId(url: URL) {
  if (url.hostname === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? null
  }

  return url.searchParams.get('v')
}

function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function canonicalizeReferenceUrl(rawUrl: string): CanonicalReferenceUrl {
  let url: URL

  try {
    url = new URL(normalizeUrlInput(rawUrl))
  } catch {
    throw new Error('Invalid URL')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported URL protocol')
  }

  url.protocol = 'https:'
  url.hostname = url.hostname.toLowerCase().replace(/^m\./, 'www.')
  url.hash = ''
  removeTrackingParams(url)
  url.pathname = normalizePathname(decodeURI(url.pathname))

  let platform: ReferencePlatform = 'web'

  if (url.hostname === 'instagram.com') {
    url.hostname = 'www.instagram.com'
  }

  if (url.hostname === 'www.instagram.com') {
    const reelShortcode = getInstagramShortcode(url.pathname, 'reel')
    const postShortcode = getInstagramShortcode(url.pathname, 'p')

    if (reelShortcode) {
      platform = 'instagram_reel'
      url.pathname = `/reel/${encodeURIComponent(reelShortcode)}/`
      url.search = ''
    } else if (postShortcode) {
      platform = 'instagram_post'
      url.pathname = `/p/${encodeURIComponent(postShortcode)}/`
      url.search = ''
    }
  } else if (url.hostname === 'threads.net' || url.hostname === 'www.threads.net') {
    platform = 'threads'
    url.hostname = 'www.threads.net'
  } else if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') {
    url.hostname = 'www.youtube.com'

    if (url.pathname.startsWith('/shorts/')) {
      const videoId = url.pathname.split('/').filter(Boolean)[1]
      if (videoId) {
        platform = 'youtube_short'
        url.pathname = `/shorts/${encodeURIComponent(videoId)}`
        url.search = ''
      }
    } else {
      const videoId = getYoutubeVideoId(url)
      if (videoId) {
        platform = 'youtube'
        url.pathname = '/watch'
        url.search = ''
        url.searchParams.set('v', videoId)
      }
    }
  } else if (url.hostname === 'youtu.be') {
    const videoId = getYoutubeVideoId(url)
    if (videoId) {
      platform = 'youtube'
      url.hostname = 'www.youtube.com'
      url.pathname = '/watch'
      url.search = ''
      url.searchParams.set('v', videoId)
    }
  }

  if (!url.hostname.includes('.')) {
    platform = 'unknown'
  }

  const canonicalUrl = url.toString()

  return {
    canonicalUrl,
    fingerprint: sha256Hex(canonicalUrl),
    platform,
    canonicalizerVersion: REFERENCE_CANONICALIZER_VERSION,
  }
}
