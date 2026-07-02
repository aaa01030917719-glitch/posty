'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  createMediaMarkdownToken,
  MarkdownToolbar,
  type MediaSizePreset,
  type MarkdownToolbarAction,
} from '@/components/content/MarkdownToolbar'
import type { SignedContentCardMedia } from '@/components/content/contentMedia'
import { getMarkdownTableFromClipboard } from '@/lib/table-paste'
import type { ContentMediaType } from '@/lib/types'

export type RichTextEditorMediaItem = SignedContentCardMedia

export type RichTextEditorHandle = {
  focus: () => void
  insertMediaItem: (media: RichTextEditorMediaItem) => void
}

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  mediaItems?: RichTextEditorMediaItem[]
  disabled?: boolean
  placeholder?: string
  bodyHeader?: ReactNode
  className?: string
  bodyClassName?: string
  editorClassName?: string
  onUploadMedia?: (files: File[]) => Promise<RichTextEditorMediaItem[]>
  uploadDisabledMessage?: string
  uploadDisabled?: boolean
  showMediaAction?: boolean
  toolbarStickyTop?: CSSProperties['top']
}

const RICH_TEXT_PLACEHOLDER = '\uD14D\uC2A4\uD2B8'
const RICH_HEADING_PLACEHOLDER = '\uC81C\uBAA9'
const RICH_SMALL_PLACEHOLDER = '\uC791\uC740\uAE00\uC528'
const RICH_MUTED_PLACEHOLDER = '\uBCF4\uC870\uAE00\uC528'
const RICH_LINK_TEXT_PLACEHOLDER = '\uB9C1\uD06C \uD14D\uC2A4\uD2B8'
const RICH_LINK_URL_PLACEHOLDER = 'https://example.com'
const RICH_LARGE_CLASS = 'text-[30px] font-semibold leading-[1.25] text-[var(--color-text-primary)]'
const RICH_TITLE_CLASS = 'text-[24px] font-semibold leading-[1.3] text-[var(--color-text-primary)]'
const RICH_SMALL_CLASS = 'text-[14px] leading-[1.6] text-[var(--color-text-secondary)]'
const RICH_MUTED_CLASS = 'text-[14px] leading-[1.6] text-[var(--color-text-muted)]'
const RICH_COLOR_OPTIONS = {
  ink: {
    value: '#222222',
    className: 'text-[var(--color-text-primary)]',
    tag: 'posty-color-ink',
  },
  body: {
    value: '#3f3f3f',
    className: 'text-[var(--color-text-body)]',
    tag: 'posty-color-body',
  },
  muted: {
    value: '#6a6a6a',
    className: 'text-[var(--color-text-subtle)]',
    tag: 'posty-color-muted',
  },
  accent: {
    value: '#ff385c',
    className: 'text-[var(--color-accent)]',
    tag: 'posty-color-accent',
  },
  calm: {
    value: '#2f6f66',
    className: 'text-[#2f6f66]',
    tag: 'posty-color-calm',
  },
} as const
type RichColorKey = keyof typeof RICH_COLOR_OPTIONS
type RichSizeKey = 'large' | 'title' | 'small' | 'muted'
const MEDIA_SIZE_OPTIONS: Array<{ value: MediaSizePreset; label: string; width: string }> = [
  { value: 'original', label: '\uC6D0\uBCF8', width: 'auto' },
  { value: 'small', label: '\uC791\uAC8C', width: '25%' },
  { value: 'medium', label: '\uC911\uAC04', width: '50%' },
  { value: 'large', label: '\uD06C\uAC8C', width: '75%' },
  { value: 'full', label: '\uAF49 \uCC44\uC6B0\uAE30', width: '100%' },
]

function normalizeMediaSize(value: string | null | undefined): MediaSizePreset {
  if (
    value === 'small' ||
    value === 'medium' ||
    value === 'large' ||
    value === 'full' ||
    value === 'original'
  ) {
    return value
  }

  return 'original'
}

function getMediaSizeWidth(size: MediaSizePreset) {
  return MEDIA_SIZE_OPTIONS.find((option) => option.value === size)?.width ?? 'auto'
}

function applyMediaSizeToFigure(figure: HTMLElement, size: MediaSizePreset) {
  const width = getMediaSizeWidth(size)
  const mediaElement = figure.querySelector('img, video') as HTMLElement | null

  figure.dataset.postyMediaSize = size
  figure.style.maxWidth = '100%'
  figure.style.width = width

  if (mediaElement) {
    mediaElement.style.maxWidth = '100%'
    mediaElement.style.height = 'auto'
    mediaElement.style.width = size === 'original' ? 'auto' : '100%'
  }
}

const RICH_MEDIA_UNAVAILABLE_LABEL =
  '\uCCA8\uBD80 \uBBF8\uB514\uC5B4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'
const RICH_MEDIA_IMAGE_LABEL = '\uCCA8\uBD80 \uC774\uBBF8\uC9C0'
const RICH_MEDIA_VIDEO_LABEL = '\uCCA8\uBD80 \uC601\uC0C1'
const RICH_MEDIA_REMOVE_LABEL = '\uBCF8\uBB38\uC5D0\uC11C \uC774\uBBF8\uC9C0 \uC81C\uAC70'
const RICH_MEDIA_SIZE_LABEL = '\uC774\uBBF8\uC9C0 \uD06C\uAE30'
const DEFAULT_PLACEHOLDER = '\uB0B4\uC6A9\uC744 \uC785\uB825\uD574\uBCF4\uC138\uC694...'
const DEFAULT_UPLOAD_DISABLED_MESSAGE =
  '\uC800\uC7A5\uB41C \uCF58\uD150\uCE20\uC5D0\uC11C\uB9CC \uC774\uBBF8\uC9C0\uB97C \uBCF8\uBB38\uC5D0 \uC0BD\uC785\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'

const EDITOR_MEDIA_TOKEN_PATTERN =
  /^!\[([^\]]*)\]\(posty-media:([A-Za-z0-9_-]+)(?:\|size=(original|small|medium|large|full))?\)$/
const EDITOR_INLINE_MEDIA_PATTERN =
  /!\[([^\]]*)\]\(posty-media:([A-Za-z0-9_-]+)(?:\|size=(original|small|medium|large|full))?\)/
const EDITOR_LINK_PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/
const EDITOR_BOLD_PATTERN = /\*\*([^*\n]+?)\*\*/
const EDITOR_STRIKE_PATTERN = /~~([^~\n]+?)~~/
const EDITOR_LARGE_PATTERN = /<posty-large>([^<\n]+?)<\/posty-large>/
const EDITOR_TITLE_PATTERN = /<posty-title>([^<\n]+?)<\/posty-title>/
const EDITOR_SMALL_PATTERN = /<small>([^<\n]+?)<\/small>/
const EDITOR_MUTED_PATTERN = /<posty-muted>([^<\n]+?)<\/posty-muted>/
const EDITOR_COLOR_INK_PATTERN = /<posty-color-ink>([^<\n]+?)<\/posty-color-ink>/
const EDITOR_COLOR_BODY_PATTERN = /<posty-color-body>([^<\n]+?)<\/posty-color-body>/
const EDITOR_COLOR_MUTED_PATTERN = /<posty-color-muted>([^<\n]+?)<\/posty-color-muted>/
const EDITOR_COLOR_ACCENT_PATTERN = /<posty-color-accent>([^<\n]+?)<\/posty-color-accent>/
const EDITOR_COLOR_CALM_PATTERN = /<posty-color-calm>([^<\n]+?)<\/posty-color-calm>/
const EDITOR_ITALIC_PATTERN = /\*([^*\n]+?)\*/
const EDITOR_HEADING_PATTERN = /^\s{0,3}#{1,3}\s+(.+)$/
const EDITOR_UNORDERED_LIST_PATTERN = /^\s*[-*]\s+(.+)$/
const EDITOR_ORDERED_LIST_PATTERN = /^\s*\d+\.\s+(.+)$/
const EDITOR_HR_PATTERN = /^\s*-{3,}\s*$/

type EditorInlineMatch =
  | {
      type: 'media'
      index: number
      end: number
      alt: string
      id: string
      size: MediaSizePreset
      priority: number
    }
  | {
      type: 'link'
      index: number
      end: number
      label: string
      href: string
      priority: number
    }
  | {
      type:
        | 'bold'
        | 'italic'
        | 'strike'
        | 'large'
        | 'title'
        | 'small'
        | 'muted'
        | 'colorInk'
        | 'colorBody'
        | 'colorMuted'
        | 'colorAccent'
        | 'colorCalm'
      index: number
      end: number
      value: string
      priority: number
    }

function createMediaItemMap(mediaItems: RichTextEditorMediaItem[]) {
  return new Map(mediaItems.map((item) => [item.id, item]))
}

function createEditorMediaNode(
  ownerDocument: Document,
  media: Pick<RichTextEditorMediaItem, 'id' | 'media_type' | 'signedUrl' | 'file_name'> | null,
  fallback: { id: string; alt?: string; mediaType?: ContentMediaType; size?: MediaSizePreset },
  editable: boolean
) {
  const figure = ownerDocument.createElement('figure')
  const mediaType = media?.media_type === 'video' || fallback.mediaType === 'video' ? 'video' : 'image'
  const mediaSize = fallback.size ?? 'original'
  const label = mediaType === 'video' ? RICH_MEDIA_VIDEO_LABEL : RICH_MEDIA_IMAGE_LABEL

  figure.dataset.postyMediaId = media?.id ?? fallback.id
  figure.dataset.postyMediaType = mediaType
  figure.dataset.postyMediaAlt = fallback.alt || media?.file_name || label
  figure.contentEditable = 'false'
  figure.className = 'group relative my-2 inline-block max-w-full align-top'

  if (media?.signedUrl && mediaType === 'image') {
    const image = ownerDocument.createElement('img')
    image.src = media.signedUrl
    image.alt = fallback.alt || media.file_name || label
    image.className = 'block h-auto max-h-[420px] max-w-full rounded-[var(--radius-md)] object-contain'
    figure.appendChild(image)
  } else if (media?.signedUrl && mediaType === 'video') {
    const video = ownerDocument.createElement('video')
    video.src = media.signedUrl
    video.controls = true
    video.preload = 'metadata'
    video.className = 'block h-auto max-h-[420px] max-w-full rounded-[var(--radius-md)] object-contain'
    figure.appendChild(video)
  } else {
    const fallbackNode = ownerDocument.createElement('div')
    fallbackNode.className =
      'rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] px-4 py-4 text-center text-xs text-[var(--color-text-muted)]'
    fallbackNode.textContent = RICH_MEDIA_UNAVAILABLE_LABEL
    figure.appendChild(fallbackNode)
  }

  if (editable) {
    const sizeToolbar = ownerDocument.createElement('div')
    sizeToolbar.dataset.postyMediaSizeToolbar = 'true'
    sizeToolbar.setAttribute('aria-label', RICH_MEDIA_SIZE_LABEL)
    sizeToolbar.className =
      'absolute bottom-2 left-2 z-10 hidden max-w-[calc(100%-16px)] flex-wrap items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-bg-surface)_92%,transparent)] px-1.5 py-1 text-[11px] font-semibold text-[var(--color-text-body)] shadow-sm'

    MEDIA_SIZE_OPTIONS.forEach((option) => {
      const sizeButton = ownerDocument.createElement('button')
      sizeButton.type = 'button'
      sizeButton.dataset.postyMediaSizeAction = option.value
      sizeButton.textContent = option.label
      sizeButton.className =
        'rounded-full px-2 py-1 transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]'
      sizeToolbar.appendChild(sizeButton)
    })

    figure.appendChild(sizeToolbar)

    const removeButton = ownerDocument.createElement('button')
    removeButton.type = 'button'
    removeButton.dataset.postyRemoveMedia = 'true'
    removeButton.setAttribute('aria-label', RICH_MEDIA_REMOVE_LABEL)
    removeButton.textContent = '\u00D7'
    removeButton.className =
      'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-bg-surface)_88%,transparent)] text-sm font-bold leading-none text-[var(--color-text-body)] shadow-sm transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]'
    figure.appendChild(removeButton)
  }

  applyMediaSizeToFigure(figure, mediaSize)

  return figure
}

function matchEditorPattern(
  source: string,
  pattern: RegExp,
  priority: number,
  type: EditorInlineMatch['type']
): EditorInlineMatch | null {
  const match = source.match(pattern)

  if (!match || typeof match.index !== 'number') return null

  if (type === 'media') {
    return {
      type,
      index: match.index,
      end: match.index + match[0].length,
      alt: match[1] ?? '',
      id: match[2],
      size: normalizeMediaSize(match[3]),
      priority,
    }
  }

  if (type === 'link') {
    return {
      type,
      index: match.index,
      end: match.index + match[0].length,
      label: match[1] ?? '',
      href: match[2] ?? '',
      priority,
    }
  }

  return {
    type,
    index: match.index,
    end: match.index + match[0].length,
    value: match[1] ?? '',
    priority,
  }
}

function getNextEditorInlineMatch(source: string) {
  const matches = [
    matchEditorPattern(source, EDITOR_INLINE_MEDIA_PATTERN, 0, 'media'),
    matchEditorPattern(source, EDITOR_LINK_PATTERN, 1, 'link'),
    matchEditorPattern(source, EDITOR_BOLD_PATTERN, 2, 'bold'),
    matchEditorPattern(source, EDITOR_STRIKE_PATTERN, 3, 'strike'),
    matchEditorPattern(source, EDITOR_LARGE_PATTERN, 4, 'large'),
    matchEditorPattern(source, EDITOR_TITLE_PATTERN, 5, 'title'),
    matchEditorPattern(source, EDITOR_SMALL_PATTERN, 6, 'small'),
    matchEditorPattern(source, EDITOR_MUTED_PATTERN, 7, 'muted'),
    matchEditorPattern(source, EDITOR_COLOR_INK_PATTERN, 8, 'colorInk'),
    matchEditorPattern(source, EDITOR_COLOR_BODY_PATTERN, 9, 'colorBody'),
    matchEditorPattern(source, EDITOR_COLOR_MUTED_PATTERN, 10, 'colorMuted'),
    matchEditorPattern(source, EDITOR_COLOR_ACCENT_PATTERN, 11, 'colorAccent'),
    matchEditorPattern(source, EDITOR_COLOR_CALM_PATTERN, 12, 'colorCalm'),
    matchEditorPattern(source, EDITOR_ITALIC_PATTERN, 13, 'italic'),
  ].filter((match): match is EditorInlineMatch => Boolean(match))

  return matches.sort((a, b) => a.index - b.index || a.priority - b.priority)[0] ?? null
}

function getColorKeyFromEditorMatchType(type: EditorInlineMatch['type']): RichColorKey | null {
  if (type === 'colorInk') return 'ink'
  if (type === 'colorBody') return 'body'
  if (type === 'colorMuted') return 'muted'
  if (type === 'colorAccent') return 'accent'
  if (type === 'colorCalm') return 'calm'

  return null
}

function appendInlineEditorNodes(
  ownerDocument: Document,
  parent: HTMLElement | DocumentFragment,
  source: string,
  mediaById: Map<string, RichTextEditorMediaItem>,
  editable: boolean
) {
  let remaining = source

  while (remaining) {
    const match = getNextEditorInlineMatch(remaining)

    if (!match) {
      parent.appendChild(ownerDocument.createTextNode(remaining))
      break
    }

    if (match.index > 0) {
      parent.appendChild(ownerDocument.createTextNode(remaining.slice(0, match.index)))
    }

    if (match.type === 'media') {
      parent.appendChild(
        createEditorMediaNode(
          ownerDocument,
          mediaById.get(match.id) ?? null,
          {
            id: match.id,
            alt: match.alt,
            size: match.size,
          },
          editable
        )
      )
    } else if (match.type === 'link') {
      const link = ownerDocument.createElement('a')
      link.href = match.href
      link.dataset.postyLink = 'true'
      link.target = '_blank'
      link.rel = 'noreferrer noopener'
      link.className =
        'cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700 [&_*]:text-blue-600'
      appendInlineEditorNodes(ownerDocument, link, match.label, mediaById, editable)
      parent.appendChild(link)
    } else {
      const element = ownerDocument.createElement(
        match.type === 'bold'
          ? 'strong'
          : match.type === 'italic'
            ? 'em'
            : match.type === 'strike'
              ? 'del'
              : 'span'
      )

      if (['large', 'title', 'small', 'muted'].includes(match.type)) {
        element.dataset.postySize = match.type
        element.className =
          match.type === 'large'
            ? RICH_LARGE_CLASS
            : match.type === 'title'
              ? RICH_TITLE_CLASS
              : match.type === 'muted'
                ? RICH_MUTED_CLASS
                : RICH_SMALL_CLASS
      }

      const colorKey = getColorKeyFromEditorMatchType(match.type)

      if (colorKey) {
        element.dataset.postyColor = colorKey
        element.className = RICH_COLOR_OPTIONS[colorKey].className
      }

      appendInlineEditorNodes(ownerDocument, element, match.value, mediaById, editable)
      parent.appendChild(element)
    }

    remaining = remaining.slice(match.end)
  }
}

function appendParagraphNode(
  ownerDocument: Document,
  root: HTMLElement,
  text: string,
  mediaById: Map<string, RichTextEditorMediaItem>,
  editable: boolean
) {
  const paragraph = ownerDocument.createElement('p')
  paragraph.className = 'my-0 min-h-[1.85em]'

  if (text) {
    appendInlineEditorNodes(ownerDocument, paragraph, text, mediaById, editable)
  } else {
    paragraph.appendChild(ownerDocument.createElement('br'))
  }

  root.appendChild(paragraph)
}

function renderMarkdownIntoEditor(
  root: HTMLDivElement,
  markdown: string,
  mediaItems: RichTextEditorMediaItem[],
  editable: boolean
) {
  const ownerDocument = root.ownerDocument
  const mediaById = createMediaItemMap(mediaItems)
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  root.replaceChildren()

  if (!markdown.trim()) return

  for (let index = 0; index < lines.length; ) {
    const line = lines[index]
    const mediaMatch = line.trim().match(EDITOR_MEDIA_TOKEN_PATTERN)
    const headingMatch = line.match(EDITOR_HEADING_PATTERN)

    if (!line.trim()) {
      appendParagraphNode(ownerDocument, root, '', mediaById, editable)
      index += 1
      continue
    }

    if (mediaMatch) {
      root.appendChild(
        createEditorMediaNode(
          ownerDocument,
          mediaById.get(mediaMatch[2]) ?? null,
          {
            id: mediaMatch[2],
            alt: mediaMatch[1],
            size: normalizeMediaSize(mediaMatch[3]),
          },
          editable
        )
      )
      index += 1
      continue
    }

    if (EDITOR_HR_PATTERN.test(line)) {
      root.appendChild(ownerDocument.createElement('hr'))
      index += 1
      continue
    }

    if (headingMatch) {
      const heading = ownerDocument.createElement('h2')
      heading.className = 'my-0 text-[30px] font-semibold leading-[1.25] text-[var(--color-text-primary)]'
      appendInlineEditorNodes(ownerDocument, heading, headingMatch[1], mediaById, editable)
      root.appendChild(heading)
      index += 1
      continue
    }

    const unorderedItem = line.match(EDITOR_UNORDERED_LIST_PATTERN)?.[1]
    if (unorderedItem) {
      const list = ownerDocument.createElement('ul')
      list.className = 'my-0 list-disc space-y-0 pl-5'

      while (index < lines.length) {
        const item = lines[index].match(EDITOR_UNORDERED_LIST_PATTERN)?.[1]
        if (!item) break

        const listItem = ownerDocument.createElement('li')
        appendInlineEditorNodes(ownerDocument, listItem, item, mediaById, editable)
        list.appendChild(listItem)
        index += 1
      }

      root.appendChild(list)
      continue
    }

    const orderedItem = line.match(EDITOR_ORDERED_LIST_PATTERN)?.[1]
    if (orderedItem) {
      const list = ownerDocument.createElement('ol')
      list.className = 'my-0 list-decimal space-y-0 pl-5'

      while (index < lines.length) {
        const item = lines[index].match(EDITOR_ORDERED_LIST_PATTERN)?.[1]
        if (!item) break

        const listItem = ownerDocument.createElement('li')
        appendInlineEditorNodes(ownerDocument, listItem, item, mediaById, editable)
        list.appendChild(listItem)
        index += 1
      }

      root.appendChild(list)
      continue
    }

    appendParagraphNode(ownerDocument, root, line, mediaById, editable)
    index += 1
  }
}

function normalizeEditorColorValue(value: string | null | undefined): RichColorKey | null {
  if (!value) return null

  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')

  if (!normalized) return null

  const colorEntries = Object.entries(RICH_COLOR_OPTIONS) as Array<
    [RichColorKey, (typeof RICH_COLOR_OPTIONS)[RichColorKey]]
  >

  for (const [key, option] of colorEntries) {
    if (normalized === option.value || normalized === option.value.toLowerCase()) {
      return key
    }
  }

  const rgbMap: Record<string, RichColorKey> = {
    'rgb(34,34,34)': 'ink',
    'rgb(63,63,63)': 'body',
    'rgb(106,106,106)': 'muted',
    'rgb(255,56,92)': 'accent',
    'rgb(47,111,102)': 'calm',
  }

  return rgbMap[normalized] ?? null
}

function getEditorElementColorKey(node: HTMLElement): RichColorKey | null {
  const datasetColor = node.dataset.postyColor

  if (
    datasetColor === 'ink' ||
    datasetColor === 'body' ||
    datasetColor === 'muted' ||
    datasetColor === 'accent' ||
    datasetColor === 'calm'
  ) {
    return datasetColor
  }

  return (
    normalizeEditorColorValue(node.getAttribute('color')) ??
    normalizeEditorColorValue(node.style.color)
  )
}

function wrapSerializedColor(content: string, colorKey: RichColorKey | null) {
  if (!colorKey) return content

  const tagName = RICH_COLOR_OPTIONS[colorKey].tag

  return `<${tagName}>${content}</${tagName}>`
}

function serializeInlineEditorNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.replace(/\u00a0/g, ' ') ?? ''
  }

  if (!(node instanceof HTMLElement)) return ''

  const mediaId = node.dataset.postyMediaId

  if (mediaId) {
    const mediaType = node.dataset.postyMediaType === 'video' ? 'video' : 'image'
    const mediaSize = normalizeMediaSize(node.dataset.postyMediaSize)
    return createMediaMarkdownToken({ id: mediaId, media_type: mediaType, size: mediaSize })
  }

  if (node.tagName === 'BR') return '\n'

  const content = Array.from(node.childNodes).map(serializeInlineEditorNode).join('')
  const colorKey = getEditorElementColorKey(node)

  if (node.tagName === 'STRONG' || node.tagName === 'B') {
    return wrapSerializedColor(`**${content}**`, colorKey)
  }
  if (node.tagName === 'EM' || node.tagName === 'I') {
    return wrapSerializedColor(`*${content}*`, colorKey)
  }
  if (node.tagName === 'DEL' || node.tagName === 'S' || node.tagName === 'STRIKE') {
    return wrapSerializedColor(`~~${content}~~`, colorKey)
  }
  if (node.tagName === 'FONT') {
    const fontSize = node.getAttribute('size')

    if (fontSize === '7') {
      return wrapSerializedColor(`<posty-large>${content}</posty-large>`, colorKey)
    }

    if (fontSize === '6') {
      return wrapSerializedColor(`<posty-title>${content}</posty-title>`, colorKey)
    }

    if (fontSize === '2') {
      if (colorKey === 'muted') {
        return `<posty-muted>${content}</posty-muted>`
      }

      return wrapSerializedColor(`<small>${content}</small>`, colorKey)
    }
  }
  if (node.dataset.postySize === 'large') {
    return wrapSerializedColor(`<posty-large>${content}</posty-large>`, colorKey)
  }
  if (node.dataset.postySize === 'title') {
    return wrapSerializedColor(`<posty-title>${content}</posty-title>`, colorKey)
  }
  if (node.dataset.postySize === 'muted') {
    return wrapSerializedColor(`<posty-muted>${content}</posty-muted>`, colorKey)
  }
  if (node.dataset.postySize === 'small' || node.tagName === 'SMALL') {
    return wrapSerializedColor(`<small>${content}</small>`, colorKey)
  }
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') || RICH_LINK_URL_PLACEHOLDER
    return wrapSerializedColor(`[${content || RICH_LINK_TEXT_PLACEHOLDER}](${href})`, colorKey)
  }

  return wrapSerializedColor(content, colorKey)
}

function serializeEditorBlock(node: ChildNode, index: number): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) return ''

  const mediaId = node.dataset.postyMediaId

  if (mediaId) {
    const mediaType = node.dataset.postyMediaType === 'video' ? 'video' : 'image'
    const mediaSize = normalizeMediaSize(node.dataset.postyMediaSize)
    return createMediaMarkdownToken({ id: mediaId, media_type: mediaType, size: mediaSize })
  }

  if (node.tagName === 'HR') return '---'

  if (node.tagName === 'UL' || node.tagName === 'OL') {
    const ordered = node.tagName === 'OL'

    return Array.from(node.children)
      .filter((child) => child.tagName === 'LI')
      .map((child, itemIndex) => {
        const prefix = ordered ? `${itemIndex + 1}.` : '-'
        return `${prefix} ${serializeInlineEditorNode(child).trim()}`
      })
      .join('\n')
  }

  if (node.tagName === 'H1' || node.tagName === 'H2' || node.tagName === 'H3') {
    return `## ${serializeInlineEditorNode(node).trim()}`
  }

  const value = serializeInlineEditorNode(node)

  return index === 0 ? value.replace(/^\n+/, '') : value
}

function serializeEditorToMarkdown(root: HTMLDivElement) {
  return Array.from(root.childNodes)
    .map(serializeEditorBlock)
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
}

function isSelectionInsideElement(element: HTMLElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)

  return element.contains(range.commonAncestorContainer)
}

function insertHtmlAtSelection(editor: HTMLDivElement, html: string) {
  editor.focus()

  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0 || !isSelectionInsideElement(editor)) {
    const fallbackRange = editor.ownerDocument.createRange()
    fallbackRange.selectNodeContents(editor)
    fallbackRange.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(fallbackRange)
  }

  document.execCommand('insertHTML', false, html)
}

function getEditableBlockForRange(editor: HTMLElement, range: Range) {
  let node: Node | null = range.commonAncestorContainer

  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode
  }

  while (node && node !== editor) {
    if (node instanceof HTMLElement) {
      if (['P', 'DIV', 'H1', 'H2', 'H3', 'LI'].includes(node.tagName)) {
        return node
      }

      if (node.parentElement === editor) {
        return node
      }
    }

    node = node.parentNode
  }

  return null
}

function unwrapPostySizeElements(root: HTMLElement, options: { includeRoot?: boolean } = {}) {
  const targets: HTMLElement[] = []

  if (options.includeRoot && root.matches('[data-posty-size], small, font[size]')) {
    targets.push(root)
  }

  root.querySelectorAll('[data-posty-size], small, font[size]').forEach((node) => {
    if (node instanceof HTMLElement) targets.push(node)
  })

  targets.forEach((wrapper) => {
    const parent = wrapper?.parentNode

    if (!wrapper || !parent) return

    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper)
    }

    parent.removeChild(wrapper)
  })
}

function normalizeEditorLinks(editor: HTMLElement) {
  editor.querySelectorAll('a').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return

    link.dataset.postyLink = 'true'
    link.target = '_blank'
    link.rel = 'noreferrer noopener'
    link.className =
      'cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700 [&_*]:text-blue-600'
  })
}

function normalizeEditorLists(editor: HTMLElement) {
  editor.querySelectorAll('ul').forEach((list) => {
    if (!(list instanceof HTMLElement)) return
    list.className = 'my-0 list-disc space-y-0 pl-5'
  })

  editor.querySelectorAll('ol').forEach((list) => {
    if (!(list instanceof HTMLElement)) return
    list.className = 'my-0 list-decimal space-y-0 pl-5'
  })

  editor.querySelectorAll('li').forEach((item) => {
    if (!(item instanceof HTMLElement)) return
    item.className = 'min-h-[1.75em] pl-1 leading-[1.75]'
  })
}

function selectCurrentEditableBlockContents(editor: HTMLDivElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return false

  const block = getEditableBlockForRange(editor, selection.getRangeAt(0))

  if (!block) return false

  const range = editor.ownerDocument.createRange()
  range.selectNodeContents(block)
  selection.removeAllRanges()
  selection.addRange(range)

  return true
}

function selectInsertedTextBeforeCaret(placeholder: string) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const node = range.startContainer
  const offset = range.startOffset

  if (node.nodeType !== Node.TEXT_NODE || offset < placeholder.length) return

  const value = node.textContent ?? ''

  if (value.slice(offset - placeholder.length, offset) !== placeholder) return

  range.setStart(node, offset - placeholder.length)
  range.setEnd(node, offset)
  selection.removeAllRanges()
  selection.addRange(range)
}

function normalizeEditorLinkUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return ''
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed

  return `https://${trimmed}`
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    {
      value,
      onChange,
      mediaItems = [],
      disabled = false,
      placeholder = DEFAULT_PLACEHOLDER,
      bodyHeader,
      className = 'flex min-h-0 flex-1 flex-col',
      bodyClassName = 'editor-body-wrap flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 lg:px-11',
      editorClassName = '',
      onUploadMedia,
      uploadDisabled = false,
      uploadDisabledMessage = DEFAULT_UPLOAD_DISABLED_MESSAGE,
      showMediaAction = true,
      toolbarStickyTop,
    },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null)
    const imageUploadInputRef = useRef<HTMLInputElement | null>(null)
    const editorSelectionRef = useRef<Range | null>(null)
    const linkUrlInputRef = useRef<HTMLInputElement | null>(null)
    const lastMarkdownRef = useRef('')
    const lastMediaKeyRef = useRef('')
    const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
    const [linkUrlDraft, setLinkUrlDraft] = useState('')
    const [linkError, setLinkError] = useState<string | null>(null)
    const mediaRenderKey = useMemo(
      () => mediaItems.map((item) => `${item.id}:${item.signedUrl ?? ''}`).join('|'),
      [mediaItems]
    )
    const editable = !disabled

    const syncDraftFromEditor = () => {
      const editor = editorRef.current

      if (!editor) return

      const nextValue = serializeEditorToMarkdown(editor)
      lastMarkdownRef.current = nextValue
      onChange(nextValue)
    }

    const storeEditorSelection = () => {
      const editor = editorRef.current
      const selection = window.getSelection()

      if (!editor || !selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)

      if (!editor.contains(range.commonAncestorContainer)) return

      editorSelectionRef.current = range.cloneRange()
    }

    const restoreEditorSelection = () => {
      const editor = editorRef.current
      const selection = window.getSelection()
      const range = editorSelectionRef.current

      if (!editor || !selection) return

      editor.focus()

      if (range && editor.contains(range.commonAncestorContainer)) {
        selection.removeAllRanges()
        selection.addRange(range)
        return
      }

      const fallbackRange = editor.ownerDocument.createRange()
      fallbackRange.selectNodeContents(editor)
      fallbackRange.collapse(false)
      selection.removeAllRanges()
      selection.addRange(fallbackRange)
    }

    const ensureEditorSelectionText = (
      fallbackText: string,
      options: { onlyWhenEditorEmpty?: boolean } = {}
    ) => {
      const editor = editorRef.current
      const selection = window.getSelection()

      if (!editor || !selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)

      if (!range.collapsed) return
      if (options.onlyWhenEditorEmpty && serializeEditorToMarkdown(editor).trim()) return

      document.execCommand('insertText', false, fallbackText)
      selectInsertedTextBeforeCaret(fallbackText)
    }

    const applyEditorSize = (sizeKey: RichSizeKey, fallbackText: string) => {
      const editor = editorRef.current

      if (!editor) return

      restoreEditorSelection()
      ensureEditorSelectionText(fallbackText, { onlyWhenEditorEmpty: true })

      const selection = window.getSelection()

      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)

      if (range.collapsed && serializeEditorToMarkdown(editor).trim()) {
        selectCurrentEditableBlockContents(editor)
      }

      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand(
        'fontSize',
        false,
        sizeKey === 'large' ? '7' : sizeKey === 'title' ? '6' : '2'
      )

      if (sizeKey === 'muted') {
        document.execCommand('styleWithCSS', false, 'true')
        document.execCommand('foreColor', false, RICH_COLOR_OPTIONS.muted.value)
      }

      syncDraftFromEditor()
      storeEditorSelection()
    }

    const insertPlainText = (text: string) => {
      restoreEditorSelection()
      document.execCommand('insertText', false, text)
      syncDraftFromEditor()
      storeEditorSelection()
    }

    const insertMediaItem = (media: RichTextEditorMediaItem) => {
      const editor = editorRef.current

      if (media.media_type === 'file') return
      if (!editor) return

      restoreEditorSelection()
      const mediaNode = createEditorMediaNode(
        editor.ownerDocument,
        media,
        {
          id: media.id,
          mediaType: media.media_type,
          alt: media.file_name ?? undefined,
          size: 'original',
        },
        editable
      )

      insertHtmlAtSelection(editor, mediaNode.outerHTML)
      syncDraftFromEditor()
      storeEditorSelection()
    }

    const applyEditorColor = (colorKey: RichColorKey) => {
      const editor = editorRef.current

      if (!editor) return

      restoreEditorSelection()
      ensureEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
      document.execCommand('styleWithCSS', false, 'true')
      document.execCommand('foreColor', false, RICH_COLOR_OPTIONS[colorKey].value)
      syncDraftFromEditor()
      storeEditorSelection()
    }

    const applyParagraph = () => {
      const editor = editorRef.current

      if (!editor) return

      restoreEditorSelection()
      ensureEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })

      const selection = window.getSelection()

      if (!selection || selection.rangeCount === 0) return

      const block = getEditableBlockForRange(editor, selection.getRangeAt(0))

      if (block) {
        unwrapPostySizeElements(block, { includeRoot: true })
      }

      syncDraftFromEditor()
      storeEditorSelection()
    }

    const openLinkPopover = () => {
      const editor = editorRef.current

      if (!editor) return

      restoreEditorSelection()

      const selection = window.getSelection()
      const range =
        selection && selection.rangeCount > 0 && isSelectionInsideElement(editor)
          ? selection.getRangeAt(0)
          : null

      if (!range || range.collapsed || !selection?.toString().trim()) {
        editorSelectionRef.current = null
        setLinkError(
          '\uB9C1\uD06C\uB97C \uC801\uC6A9\uD560 \uD14D\uC2A4\uD2B8\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.'
        )
        setLinkUrlDraft('')
        setLinkPopoverOpen(true)
        return
      }

      editorSelectionRef.current = range.cloneRange()
      setLinkError(null)
      setLinkUrlDraft('')
      setLinkPopoverOpen(true)
      window.setTimeout(() => linkUrlInputRef.current?.focus(), 0)
    }

    const handleApplyLink = () => {
      const editor = editorRef.current
      const href = normalizeEditorLinkUrl(linkUrlDraft)

      if (!editor) return

      if (!href) {
        setLinkError('URL\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.')
        return
      }

      const range = editorSelectionRef.current

      if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) {
        setLinkError(
          '\uB9C1\uD06C\uB97C \uC801\uC6A9\uD560 \uD14D\uC2A4\uD2B8\uB97C \uBA3C\uC800 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.'
        )
        return
      }

      restoreEditorSelection()
      document.execCommand('createLink', false, href)
      normalizeEditorLinks(editor)
      syncDraftFromEditor()
      storeEditorSelection()
      setLinkPopoverOpen(false)
      setLinkUrlDraft('')
      setLinkError(null)
    }

    const handleCancelLink = () => {
      setLinkPopoverOpen(false)
      setLinkUrlDraft('')
      setLinkError(null)
      restoreEditorSelection()
    }

    const handleToolbarAction = (action: MarkdownToolbarAction) => {
      const editor = editorRef.current

      if (!editor || disabled) return

      if (action === 'media') {
        storeEditorSelection()

        if (!onUploadMedia || uploadDisabled) {
          window.alert(uploadDisabledMessage)
          return
        }

        imageUploadInputRef.current?.click()
        return
      }

      restoreEditorSelection()

      if (action === 'bold') {
        ensureEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
        document.execCommand('bold')
      } else if (action === 'italic') {
        ensureEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
        document.execCommand('italic')
      } else if (action === 'strike') {
        ensureEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
        document.execCommand('strikeThrough')
      } else if (action === 'bulletList') {
        ensureEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
        document.execCommand('insertUnorderedList')
        normalizeEditorLists(editor)
      } else if (action === 'orderedList') {
        ensureEditorSelectionText(RICH_TEXT_PLACEHOLDER, { onlyWhenEditorEmpty: true })
        document.execCommand('insertOrderedList')
        normalizeEditorLists(editor)
      } else if (action === 'link') {
        openLinkPopover()
        return
      } else if (action === 'hr') {
        insertHtmlAtSelection(editor, '<hr>')
      } else if (action === 'largeHeading') {
        applyEditorSize('large', RICH_HEADING_PLACEHOLDER)
        return
      } else if (action === 'heading') {
        applyEditorSize('title', RICH_HEADING_PLACEHOLDER)
        return
      } else if (action === 'paragraph') {
        applyParagraph()
        return
      } else if (action === 'small') {
        applyEditorSize('small', RICH_SMALL_PLACEHOLDER)
        return
      } else if (action === 'muted') {
        applyEditorSize('muted', RICH_MUTED_PLACEHOLDER)
        return
      } else if (action === 'colorInk') {
        applyEditorColor('ink')
        return
      } else if (action === 'colorBody') {
        applyEditorColor('body')
        return
      } else if (action === 'colorMuted') {
        applyEditorColor('muted')
        return
      } else if (action === 'colorAccent') {
        applyEditorColor('accent')
        return
      } else if (action === 'colorCalm') {
        applyEditorColor('calm')
        return
      }

      syncDraftFromEditor()
      storeEditorSelection()
    }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget
      const imageFiles = Array.from(input.files ?? []).filter((file) =>
        file.type.startsWith('image/')
      )

      if (!imageFiles.length) {
        input.value = ''
        return
      }

      if (!onUploadMedia || uploadDisabled || disabled) {
        window.alert(uploadDisabledMessage)
        input.value = ''
        return
      }

      const uploadedItems = await onUploadMedia(imageFiles)
      uploadedItems.forEach(insertMediaItem)
      input.value = ''
    }

    const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return

      const files = Array.from(event.clipboardData.files ?? []).filter((file) =>
        file.type.startsWith('image/')
      )

      if (files.length > 0) {
        event.preventDefault()

        if (!onUploadMedia || uploadDisabled) {
          window.alert(uploadDisabledMessage)
          return
        }

        const uploadedItems = await onUploadMedia(files)
        uploadedItems.forEach(insertMediaItem)
        return
      }

      const markdownTable = getMarkdownTableFromClipboard(event.clipboardData)

      if (markdownTable) {
        event.preventDefault()
        insertPlainText(markdownTable)
        return
      }

      const plainText = event.clipboardData.getData('text/plain')

      if (!plainText) return

      event.preventDefault()
      insertPlainText(plainText)
    }

    const clearSelectedMediaNode = () => {
      const editor = editorRef.current

      if (!editor) return

      editor.querySelectorAll('[data-posty-media-id]').forEach((node) => {
        if (!(node instanceof HTMLElement)) return

        node.classList.remove('ring-1', 'ring-blue-500', 'ring-offset-1')
        const toolbar = node.querySelector('[data-posty-media-size-toolbar]')
        toolbar?.classList.add('hidden')
        toolbar?.classList.remove('flex')
      })
    }

    const selectMediaNode = (mediaNode: HTMLElement) => {
      clearSelectedMediaNode()
      mediaNode.classList.add('ring-1', 'ring-blue-500', 'ring-offset-1')

      const toolbar = mediaNode.querySelector('[data-posty-media-size-toolbar]')
      toolbar?.classList.remove('hidden')
      toolbar?.classList.add('flex')
    }

    const removeMediaNode = (mediaNode: HTMLElement) => {
      const editor = editorRef.current
      const parent = mediaNode.parentNode

      if (!editor || !parent) return

      mediaNode.remove()
      editor.focus()

      const range = editor.ownerDocument.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)

      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      syncDraftFromEditor()
      storeEditorSelection()
    }

    const handleEditorClick = (event: ReactMouseEvent<HTMLDivElement>) => {
      if (disabled) return

      const target = event.target

      if (!(target instanceof HTMLElement)) return

      const sizeButton = target.closest('[data-posty-media-size-action]')

      if (sizeButton instanceof HTMLElement) {
        event.preventDefault()
        event.stopPropagation()

        const mediaNode = sizeButton.closest('[data-posty-media-id]')

        if (mediaNode instanceof HTMLElement) {
          applyMediaSizeToFigure(
            mediaNode,
            normalizeMediaSize(sizeButton.dataset.postyMediaSizeAction)
          )
          selectMediaNode(mediaNode)
          syncDraftFromEditor()
          storeEditorSelection()
        }

        return
      }

      const removeButton = target.closest('[data-posty-remove-media]')

      if (removeButton) {
        event.preventDefault()
        event.stopPropagation()

        const mediaNode = removeButton.closest('[data-posty-media-id]')

        if (mediaNode instanceof HTMLElement) {
          removeMediaNode(mediaNode)
        }

        return
      }

      const mediaNode = target.closest('[data-posty-media-id]')

      if (mediaNode instanceof HTMLElement) {
        event.preventDefault()
        event.stopPropagation()
        selectMediaNode(mediaNode)
        return
      }

      clearSelectedMediaNode()
    }

    useImperativeHandle(ref, () => ({
      focus() {
        editorRef.current?.focus()
      },
      insertMediaItem,
    }))

    useEffect(() => {
      const editor = editorRef.current

      if (!editor) return
      if (lastMarkdownRef.current === value && lastMediaKeyRef.current === mediaRenderKey) {
        return
      }
      if (document.activeElement === editor) return

      renderMarkdownIntoEditor(editor, value, mediaItems, editable)
      lastMarkdownRef.current = value
      lastMediaKeyRef.current = mediaRenderKey
    }, [editable, mediaItems, mediaRenderKey, value])

    const handleInput = () => {
      syncDraftFromEditor()
      storeEditorSelection()
    }

    const editorClasses = [
      'min-h-[420px] w-full flex-1 overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent text-[16px] leading-[1.75] text-[var(--color-text-body)] outline-none empty:before:pointer-events-none empty:before:text-[var(--color-text-muted-soft)] empty:before:content-[attr(data-placeholder)]',
      '[&_a]:cursor-pointer [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-700 [&_a_*]:text-blue-600',
      '[&_div]:my-0 [&_div]:min-h-[1.75em] [&_div]:leading-[1.75]',
      "[&_font[size='2']]:text-[14px] [&_font[size='2']]:leading-[1.6] [&_font[size='6']]:text-[24px] [&_font[size='6']]:font-semibold [&_font[size='6']]:leading-[1.3] [&_font[size='7']]:text-[30px] [&_font[size='7']]:font-semibold [&_font[size='7']]:leading-[1.25]",
      '[&_figure[data-posty-media-id]]:my-2 [&_figure[data-posty-media-id]]:max-w-full',
      '[&_figure[data-posty-media-id]_img]:h-auto [&_figure[data-posty-media-id]_img]:max-w-full [&_figure[data-posty-media-id]_img]:object-contain',
      '[&_figure[data-posty-media-id]_video]:h-auto [&_figure[data-posty-media-id]_video]:max-w-full [&_figure[data-posty-media-id]_video]:object-contain',
      '[&_h1]:my-0 [&_h2]:my-0 [&_h2]:min-h-[1.25em] [&_h2]:text-[30px] [&_h2]:font-semibold [&_h2]:leading-[1.25] [&_h3]:my-0',
      '[&_li]:min-h-[1.75em] [&_li]:pl-1 [&_li]:leading-[1.75]',
      '[&_ol]:my-0 [&_ol]:list-decimal [&_ol]:space-y-0 [&_ol]:pl-5',
      '[&_p]:my-0 [&_p]:min-h-[1.75em] [&_p]:leading-[1.75]',
      '[&_span[data-posty-size=large]]:leading-[1.25] [&_span[data-posty-size=muted]]:leading-[1.6] [&_span[data-posty-size=small]]:leading-[1.6] [&_span[data-posty-size=title]]:leading-[1.3]',
      '[&_ul]:my-0 [&_ul]:list-disc [&_ul]:space-y-0 [&_ul]:pl-5',
      editorClassName,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={className}>
        <MarkdownToolbar
          onAction={handleToolbarAction}
          disabled={disabled}
          showMediaAction={showMediaAction}
          stickyTop={toolbarStickyTop}
        />
        {linkPopoverOpen ? (
          <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-4 py-3 sm:px-6 lg:px-11">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[180px] flex-1 text-xs font-semibold text-[var(--color-text-body)]">
                <span className="mb-1 block">{'\uB9C1\uD06C URL'}</span>
                <input
                  ref={linkUrlInputRef}
                  type="url"
                  value={linkUrlDraft}
                  onChange={(event) => {
                    setLinkUrlDraft(event.target.value)
                    setLinkError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleApplyLink()
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault()
                      handleCancelLink()
                    }
                  }}
                  placeholder="https://example.com"
                  className="h-9 w-full rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-xs font-medium text-[var(--color-text-body)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)]"
                />
              </label>
              <button
                type="button"
                onClick={handleApplyLink}
                className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[var(--color-accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
              >
                {'\uC800\uC7A5'}
              </button>
              <button
                type="button"
                onClick={handleCancelLink}
                className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)]"
              >
                {'\uCDE8\uC18C'}
              </button>
            </div>
            {linkError ? (
              <p className="mt-2 text-xs text-[var(--color-danger)]">{linkError}</p>
            ) : null}
          </div>
        ) : null}
        <input
          ref={imageUploadInputRef}
          type="file"
          accept="image/*"
          disabled={disabled || uploadDisabled || !onUploadMedia}
          onChange={handleImageUpload}
          className="sr-only"
          aria-label={RICH_MEDIA_IMAGE_LABEL}
        />
        <div className={bodyClassName}>
          {bodyHeader}
          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            role="textbox"
            aria-label="editor"
            aria-multiline="true"
            data-placeholder={placeholder}
            onClick={handleEditorClick}
            onInput={handleInput}
            onPaste={handlePaste}
            onKeyUp={storeEditorSelection}
            onMouseUp={storeEditorSelection}
            onFocus={storeEditorSelection}
            className={editorClasses}
          />
        </div>
      </div>
    )
  }
)
