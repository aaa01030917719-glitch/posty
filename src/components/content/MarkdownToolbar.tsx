'use client'

import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react'

export type MarkdownToolbarAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'bulletList'
  | 'orderedList'
  | 'link'
  | 'hr'

type MarkdownToolbarProps = {
  onAction: (action: MarkdownToolbarAction) => void
  disabled?: boolean
  className?: string
  toolbarClassName?: string
}

type MarkdownSelectionResult = {
  value: string
  selectionStart: number
  selectionEnd: number
}

type MarkdownSnippet = {
  text: string
  selectionStartOffset: number
  selectionEndOffset: number
}

const MARKDOWN_TEXT_PLACEHOLDER = '\uD14D\uC2A4\uD2B8'
const MARKDOWN_LINK_TEXT_PLACEHOLDER = '\uB9C1\uD06C \uD14D\uC2A4\uD2B8'
const MARKDOWN_LINK_URL_PLACEHOLDER = 'https://example.com'
const MARKDOWN_MEDIA_IMAGE_LABEL = '\uCCA8\uBD80 \uC774\uBBF8\uC9C0'
const MARKDOWN_MEDIA_VIDEO_LABEL = '\uCCA8\uBD80 \uC601\uC0C1'
const MARKDOWN_TOOLBAR_ITEMS: Array<{
  value: MarkdownToolbarAction
  label: string
  icon: LucideIcon
}> = [
  { value: 'bold', label: '\uBCFC\uB4DC', icon: Bold },
  { value: 'italic', label: '\uC774\uD0E4\uB9AD', icon: Italic },
  { value: 'strike', label: '\uCDE8\uC18C\uC120', icon: Strikethrough },
  { value: 'bulletList', label: '\uBAA9\uB85D', icon: List },
  { value: 'orderedList', label: '\uBC88\uD638 \uBAA9\uB85D', icon: ListOrdered },
  { value: 'link', label: '\uB9C1\uD06C', icon: Link2 },
  { value: 'hr', label: '\uAD6C\uBD84\uC120', icon: Minus },
]

function createWrappedMarkdownSnippet(selectedText: string, wrapper: string): MarkdownSnippet {
  const value = selectedText || MARKDOWN_TEXT_PLACEHOLDER

  return {
    text: `${wrapper}${value}${wrapper}`,
    selectionStartOffset: selectedText
      ? wrapper.length + value.length + wrapper.length
      : wrapper.length,
    selectionEndOffset: selectedText
      ? wrapper.length + value.length + wrapper.length
      : wrapper.length + value.length,
  }
}

function createListMarkdownSnippet(selectedText: string, ordered: boolean): MarkdownSnippet {
  const lines = (selectedText || MARKDOWN_TEXT_PLACEHOLDER).split('\n')
  const text = lines
    .map((line, index) => `${ordered ? `${index + 1}.` : '-'} ${line || MARKDOWN_TEXT_PLACEHOLDER}`)
    .join('\n')
  const firstPrefixLength = ordered ? 3 : 2

  return {
    text,
    selectionStartOffset: selectedText ? text.length : firstPrefixLength,
    selectionEndOffset: selectedText
      ? text.length
      : firstPrefixLength + MARKDOWN_TEXT_PLACEHOLDER.length,
  }
}

function createLinkMarkdownSnippet(selectedText: string): MarkdownSnippet {
  const label = selectedText || MARKDOWN_LINK_TEXT_PLACEHOLDER
  const text = `[${label}](${MARKDOWN_LINK_URL_PLACEHOLDER})`
  const urlStartOffset = label.length + 3
  const placeholderStartOffset = 1

  return {
    text,
    selectionStartOffset: selectedText ? urlStartOffset : placeholderStartOffset,
    selectionEndOffset: selectedText
      ? urlStartOffset + MARKDOWN_LINK_URL_PLACEHOLDER.length
      : placeholderStartOffset + label.length,
  }
}

function createMarkdownSnippet(action: MarkdownToolbarAction, selectedText: string): MarkdownSnippet {
  switch (action) {
    case 'bold':
      return createWrappedMarkdownSnippet(selectedText, '**')
    case 'italic':
      return createWrappedMarkdownSnippet(selectedText, '*')
    case 'strike':
      return createWrappedMarkdownSnippet(selectedText, '~~')
    case 'bulletList':
      return createListMarkdownSnippet(selectedText, false)
    case 'orderedList':
      return createListMarkdownSnippet(selectedText, true)
    case 'link':
      return createLinkMarkdownSnippet(selectedText)
    case 'hr':
    default:
      return {
        text: '---',
        selectionStartOffset: 3,
        selectionEndOffset: 3,
      }
  }
}

function insertBlockAtSelection(
  value: string,
  insertion: string,
  selectionStart: number,
  selectionEnd: number
): MarkdownSelectionResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const before = value.slice(0, start)
  const after = value.slice(end)
  const trimmedInsertion = insertion.trim()
  const prefix = before && !before.endsWith('\n') ? '\n' : ''
  const suffix = after && !after.startsWith('\n') ? '\n' : ''
  const nextValue = `${before}${prefix}${trimmedInsertion}${suffix}${after}`
  const cursorPosition = before.length + prefix.length + trimmedInsertion.length

  return {
    value: nextValue,
    selectionStart: cursorPosition,
    selectionEnd: cursorPosition,
  }
}

export function getMarkdownActionResult(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownToolbarAction
): MarkdownSelectionResult {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const selectedText = value.slice(start, end)
  const snippet = createMarkdownSnippet(action, selectedText)

  if (action === 'hr') {
    return insertBlockAtSelection(value, snippet.text, start, end)
  }

  const nextValue = `${value.slice(0, start)}${snippet.text}${value.slice(end)}`

  return {
    value: nextValue,
    selectionStart: start + snippet.selectionStartOffset,
    selectionEnd: start + snippet.selectionEndOffset,
  }
}

export function createMediaMarkdownToken(media: { id: string; media_type: 'image' | 'video' }) {
  const label = media.media_type === 'video' ? MARKDOWN_MEDIA_VIDEO_LABEL : MARKDOWN_MEDIA_IMAGE_LABEL

  return `![${label}](posty-media:${media.id})`
}

export function MarkdownToolbar({
  onAction,
  disabled = false,
  className,
  toolbarClassName,
}: MarkdownToolbarProps) {
  return (
    <div className={className ?? 'toolbar-wrap shrink-0 border-b border-[var(--color-border-soft)] px-11'}>
      <div className={toolbarClassName ?? 'toolbar flex h-9 items-center gap-1 overflow-x-auto'}>
        {MARKDOWN_TOOLBAR_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onAction(item.value)}
              disabled={disabled}
              title={item.label}
              aria-label={item.label}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted-soft)]"
            >
              <Icon size={14} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
