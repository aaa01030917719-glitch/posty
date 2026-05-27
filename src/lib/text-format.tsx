import type { ReactNode } from 'react'

export type FormattedTextMediaItem = {
  id: string
  fileName: string | null
  mediaType: 'image' | 'video'
  signedUrl: string | null
}

type TextBlock =
  | {
      type: 'text'
      value: string
    }
  | {
      type: 'table'
      header: string[]
      rows: string[][]
    }
  | {
      type: 'list'
      ordered: boolean
      items: string[]
    }
  | {
      type: 'hr'
    }
  | {
      type: 'media'
      id: string
      alt: string
    }

type FormattedTextProps = {
  text: string
  className?: string
  mediaItems?: FormattedTextMediaItem[]
}

type InlineMatch =
  | {
      type: 'media'
      index: number
      end: number
      alt: string
      id: string
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
      type: 'bold' | 'italic' | 'strike'
      index: number
      end: number
      value: string
      priority: number
    }

const MEDIA_TOKEN_PATTERN = /!\[([^\]]*)\]\(posty-media:([A-Za-z0-9_-]+)\)/
const MEDIA_TOKEN_ONLY_PATTERN = /^!\[([^\]]*)\]\(posty-media:([A-Za-z0-9_-]+)\)$/
const LINK_PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/
const BOLD_PATTERN = /\*\*([^*\n]+?)\*\*/
const STRIKE_PATTERN = /~~([^~\n]+?)~~/
const ITALIC_PATTERN = /\*([^*\n]+?)\*/
const UNORDERED_LIST_PATTERN = /^\s*[-*]\s+(.+)$/
const ORDERED_LIST_PATTERN = /^\s*\d+\.\s+(.+)$/
const HORIZONTAL_RULE_PATTERN = /^\s*-{3,}\s*$/
const MEDIA_PREVIEW_LABEL = '\uCCA8\uBD80 \uBBF8\uB514\uC5B4'
const MEDIA_IMAGE_LABEL = '\uCCA8\uBD80 \uC774\uBBF8\uC9C0'
const MEDIA_VIDEO_LABEL = '\uCCA8\uBD80 \uC601\uC0C1'
const MEDIA_UNAVAILABLE_LABEL = '\uCCA8\uBD80 \uBBF8\uB514\uC5B4\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'

function splitMarkdownRow(line: string) {
  let source = line.trim()

  if (source.startsWith('|')) {
    source = source.slice(1)
  }

  if (source.endsWith('|') && !source.endsWith('\\|')) {
    source = source.slice(0, -1)
  }

  const cells: string[] = []
  let current = ''

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const nextChar = source[index + 1]

    if (char === '\\' && nextChar === '|') {
      current += '|'
      index += 1
      continue
    }

    if (char === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())

  return cells
}

function isSeparatorLine(line: string) {
  const cells = splitMarkdownRow(line)

  return (
    cells.length >= 2 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))
  )
}

function isTableStart(currentLine: string, nextLine: string | undefined) {
  if (!nextLine || !currentLine.includes('|')) return false

  return splitMarkdownRow(currentLine).length >= 2 && isSeparatorLine(nextLine)
}

function normalizeRowLength(row: string[], length: number) {
  return Array.from({ length }, (_, index) => row[index] ?? '')
}

function normalizeLines(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function getUnorderedListItem(line: string) {
  return line.match(UNORDERED_LIST_PATTERN)?.[1]?.trim() ?? null
}

function getOrderedListItem(line: string) {
  return line.match(ORDERED_LIST_PATTERN)?.[1]?.trim() ?? null
}

function getMediaToken(line: string) {
  const match = line.trim().match(MEDIA_TOKEN_ONLY_PATTERN)

  if (!match) return null

  return {
    alt: match[1]?.trim() ?? '',
    id: match[2],
  }
}

function parseFormattedText(text: string): TextBlock[] {
  const lines = normalizeLines(text)
  const blocks: TextBlock[] = []
  const textLines: string[] = []

  const flushText = () => {
    const value = textLines.join('\n').replace(/^\n+|\n+$/g, '')

    if (value) {
      blocks.push({ type: 'text', value })
    }

    textLines.length = 0
  }

  for (let index = 0; index < lines.length; ) {
    const line = lines[index]
    const nextLine = lines[index + 1]
    const mediaToken = getMediaToken(line)
    const unorderedItem = getUnorderedListItem(line)
    const orderedItem = getOrderedListItem(line)

    if (isTableStart(line, nextLine)) {
      flushText()

      const header = splitMarkdownRow(line)
      const columnCount = header.length
      const rows: string[][] = []

      index += 2

      while (index < lines.length) {
        const rowLine = lines[index]

        if (!rowLine.trim() || !rowLine.includes('|')) break

        const row = splitMarkdownRow(rowLine)

        if (row.length < 2) break

        rows.push(normalizeRowLength(row, columnCount))
        index += 1
      }

      blocks.push({
        type: 'table',
        header,
        rows,
      })
      continue
    }

    if (mediaToken) {
      flushText()
      blocks.push({ type: 'media', ...mediaToken })
      index += 1
      continue
    }

    if (HORIZONTAL_RULE_PATTERN.test(line)) {
      flushText()
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }

    if (unorderedItem) {
      flushText()

      const items: string[] = []

      while (index < lines.length) {
        const item = getUnorderedListItem(lines[index])

        if (!item) break

        items.push(item)
        index += 1
      }

      blocks.push({ type: 'list', ordered: false, items })
      continue
    }

    if (orderedItem) {
      flushText()

      const items: string[] = []

      while (index < lines.length) {
        const item = getOrderedListItem(lines[index])

        if (!item) break

        items.push(item)
        index += 1
      }

      blocks.push({ type: 'list', ordered: true, items })
      continue
    }

    textLines.push(line)
    index += 1
  }

  flushText()

  return blocks
}

function matchPattern(
  source: string,
  pattern: RegExp,
  priority: number,
  type: InlineMatch['type']
): InlineMatch | null {
  const match = source.match(pattern)

  if (!match || typeof match.index !== 'number') return null

  if (type === 'media') {
    return {
      type,
      index: match.index,
      end: match.index + match[0].length,
      alt: match[1] ?? '',
      id: match[2],
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

function getNextInlineMatch(source: string) {
  const matches = [
    matchPattern(source, MEDIA_TOKEN_PATTERN, 0, 'media'),
    matchPattern(source, LINK_PATTERN, 1, 'link'),
    matchPattern(source, BOLD_PATTERN, 2, 'bold'),
    matchPattern(source, STRIKE_PATTERN, 3, 'strike'),
    matchPattern(source, ITALIC_PATTERN, 4, 'italic'),
  ].filter((match): match is InlineMatch => Boolean(match))

  return matches.sort((a, b) => a.index - b.index || a.priority - b.priority)[0] ?? null
}

function renderInlineContent(source: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let remaining = source
  let offset = 0
  let keyIndex = 0

  while (remaining) {
    const match = getNextInlineMatch(remaining)

    if (!match) {
      nodes.push(remaining)
      break
    }

    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index))
    }

    const key = `${keyPrefix}-${offset + match.index}-${keyIndex}`

    if (match.type === 'bold') {
      nodes.push(<strong key={key}>{renderInlineContent(match.value, `${key}-bold`)}</strong>)
    } else if (match.type === 'italic') {
      nodes.push(<em key={key}>{renderInlineContent(match.value, `${key}-italic`)}</em>)
    } else if (match.type === 'strike') {
      nodes.push(<del key={key}>{renderInlineContent(match.value, `${key}-strike`)}</del>)
    } else if (match.type === 'link') {
      nodes.push(
        <a
          key={key}
          href={match.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[var(--color-accent)] underline underline-offset-2"
        >
          {renderInlineContent(match.label, `${key}-link`)}
        </a>
      )
    } else if (match.type === 'media') {
      nodes.push(
        <span
          key={key}
          className="rounded-[4px] bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[0.92em] text-[var(--color-text-muted)]"
        >
          {match.alt || MEDIA_PREVIEW_LABEL}
        </span>
      )
    }

    remaining = remaining.slice(match.end)
    offset += match.end
    keyIndex += 1
  }

  return nodes
}

function createMediaMap(mediaItems: FormattedTextMediaItem[] | undefined) {
  return new Map((mediaItems ?? []).map((item) => [item.id, item]))
}

function renderMediaBlock(
  id: string,
  alt: string,
  mediaById: Map<string, FormattedTextMediaItem>
) {
  const media = mediaById.get(id)
  const label = media?.mediaType === 'video' ? MEDIA_VIDEO_LABEL : MEDIA_IMAGE_LABEL
  const altText = alt || media?.fileName || label

  if (!media?.signedUrl) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">
        {MEDIA_UNAVAILABLE_LABEL}
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-bg-subtle)]">
      {media.mediaType === 'image' ? (
        <img
          src={media.signedUrl}
          alt={altText}
          className="max-h-[460px] w-full object-contain"
        />
      ) : (
        <video
          src={media.signedUrl}
          controls
          preload="metadata"
          className="max-h-[460px] w-full object-contain"
        />
      )}
    </figure>
  )
}

export function getPlainTextPreview(text: string | null | undefined) {
  if (!text) return ''

  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(new RegExp(MEDIA_TOKEN_PATTERN.source, 'g'), MEDIA_PREVIEW_LABEL)
    .replace(new RegExp(LINK_PATTERN.source, 'g'), '$1')
    .replace(new RegExp(BOLD_PATTERN.source, 'g'), '$1')
    .replace(new RegExp(STRIKE_PATTERN.source, 'g'), '$1')
    .replace(new RegExp(ITALIC_PATTERN.source, 'g'), '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function FormattedText({ text, className, mediaItems }: FormattedTextProps) {
  const blocks = parseFormattedText(text)
  const mediaById = createMediaMap(mediaItems)

  if (blocks.length === 0) return null

  return (
    <div className={['space-y-3', className].filter(Boolean).join(' ')}>
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <div key={`text-${index}`} className="whitespace-pre-wrap">
              {renderInlineContent(block.value, `text-${index}`)}
            </div>
          )
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'

          return (
            <ListTag
              key={`list-${index}`}
              className={
                block.ordered
                  ? 'list-decimal space-y-1 pl-5'
                  : 'list-disc space-y-1 pl-5'
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={`list-${index}-${itemIndex}`}>
                  {renderInlineContent(item, `list-${index}-${itemIndex}`)}
                </li>
              ))}
            </ListTag>
          )
        }

        if (block.type === 'hr') {
          return (
            <hr
              key={`hr-${index}`}
              className="border-0 border-t border-[var(--color-border-soft)]"
            />
          )
        }

        if (block.type === 'media') {
          return <div key={`media-${index}`}>{renderMediaBlock(block.id, block.alt, mediaById)}</div>
        }

        return (
          <div
            key={`table-${index}`}
            className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-soft)]"
          >
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]">
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th
                      key={`head-${cellIndex}`}
                      scope="col"
                      className="border-b border-r border-[var(--color-border-soft)] px-3 py-2 font-semibold last:border-r-0"
                    >
                      {renderInlineContent(cell, `head-${index}-${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--color-text-body)]">
                {block.rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`cell-${rowIndex}-${cellIndex}`}
                        className="border-r border-t border-[var(--color-border-soft)] px-3 py-2 align-top last:border-r-0"
                      >
                        {renderInlineContent(cell, `cell-${index}-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
