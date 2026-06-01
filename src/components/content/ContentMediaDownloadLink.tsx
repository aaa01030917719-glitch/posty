'use client'

import { type MouseEvent, type ReactNode } from 'react'
import { downloadContentMediaFile, sanitizeDownloadFileName } from '@/lib/content-media-files'

const DOWNLOAD_ERROR_MESSAGE = '파일을 다운로드하지 못했습니다. 잠시 후 다시 시도해주세요.'

type ContentMediaDownloadLinkProps = {
  children: ReactNode
  className?: string
  fileName: string
  url: string
}

export function ContentMediaDownloadLink({
  children,
  className,
  fileName,
  url,
}: ContentMediaDownloadLinkProps) {
  const safeFileName = sanitizeDownloadFileName(fileName)

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()

    try {
      await downloadContentMediaFile(url, safeFileName)
    } catch (error) {
      console.error('Failed to download content media file', error)
      window.alert(DOWNLOAD_ERROR_MESSAGE)
    }
  }

  return (
    <a href={url} download={safeFileName} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
