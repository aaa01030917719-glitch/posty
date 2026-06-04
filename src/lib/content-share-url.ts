import 'server-only'

export function createPublicContentShareUrl(token: string) {
  const baseUrl = process.env.POSTY_PUBLIC_BASE_URL?.trim()

  if (!baseUrl) {
    return null
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  return `${normalizedBaseUrl}/share/content/${encodeURIComponent(token)}`
}
