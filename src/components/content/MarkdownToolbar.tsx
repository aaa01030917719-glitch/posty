'use client'

import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react'

export type MarkdownToolbarAction =
  | 'largeHeading'
  | 'heading'
  | 'paragraph'
  | 'small'
  | 'muted'
  | 'colorInk'
  | 'colorBody'
  | 'colorMuted'
  | 'colorAccent'
  | 'colorCalm'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'bulletList'
  | 'orderedList'
  | 'link'
  | 'hr'
  | 'media'

type MarkdownToolbarProps = {
  onAction: (action: MarkdownToolbarAction) => void
  disabled?: boolean
  className?: string
  toolbarClassName?: string
  showMediaAction?: boolean
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
const MARKDOWN_LARGE_HEADING_PLACEHOLDER = '\uD070\uC81C\uBAA9'
const MARKDOWN_HEADING_PLACEHOLDER = '\uC81C\uBAA9'
const MARKDOWN_SMALL_PLACEHOLDER = '\uC791\uC740\uAE00\uC528'
const MARKDOWN_MUTED_PLACEHOLDER = '\uBCF4\uC870\uAE00\uC528'
const MARKDOWN_LINK_TEXT_PLACEHOLDER = '\uB9C1\uD06C \uD14D\uC2A4\uD2B8'
const MARKDOWN_LINK_URL_PLACEHOLDER = 'https://example.com'
const MARKDOWN_MEDIA_IMAGE_LABEL = '\uCCA8\uBD80 \uC774\uBBF8\uC9C0'
const MARKDOWN_MEDIA_VIDEO_LABEL = '\uCCA8\uBD80 \uC601\uC0C1'
const MARKDOWN_TOOLBAR_ITEMS: Array<{
  value: MarkdownToolbarAction
  label: string
  icon?: LucideIcon
  text?: string
  swatchClass?: string
  mediaOnly?: boolean
}> = [
  { value: 'largeHeading', label: '\uD070\uC81C\uBAA9', text: '\uD070\uC81C\uBAA9' },
  { value: 'heading', label: '\uC81C\uBAA9', text: '\uC81C\uBAA9' },
  { value: 'paragraph', label: '\uBCF8\uBB38', text: '\uBCF8\uBB38' },
  { value: 'small', label: '\uC791\uC740\uAE00\uC528', text: '\uC791\uC740\uAE00\uC528' },
  { value: 'muted', label: '\uBCF4\uC870\uAE00\uC528', text: '\uBCF4\uC870\uAE00\uC528' },
  { value: 'colorInk', label: '\uAE30\uBCF8 \uAC80\uC815', swatchClass: 'bg-[var(--color-text-primary)]' },
  { value: 'colorBody', label: '\uC9C4\uD68C\uC0C9', swatchClass: 'bg-[var(--color-text-body)]' },
  { value: 'colorMuted', label: '\uD68C\uC0C9', swatchClass: 'bg-[var(--color-text-subtle)]' },
  { value: 'colorAccent', label: '\uD3EC\uC2A4\uD2F0 \uD3EC\uC778\uD2B8', swatchClass: 'bg-[var(--color-accent)]' },
  { value: 'colorCalm', label: '\uCC28\uBD84\uD55C \uAC15\uC870', swatchClass: 'bg-[#2f6f66]' },
  { value: 'bold', label: '\uBCFC\uB4DC', icon: Bold },
  { value: 'italic', label: '\uC774\uD0E4\uB9AD', icon: Italic },
  { value: 'strike', label: '\uCDE8\uC18C\uC120', icon: Strikethrough },
  { value: 'bulletList', label: '\uBAA9\uB85D', icon: List },
  { value: 'orderedList', label: '\uBC88\uD638 \uBAA9\uB85D', icon: ListOrdered },
  { value: 'link', label: '\uB9C1\uD06C', icon: Link2 },
  { value: 'hr', label: '\uAD6C\uBD84\uC120', icon: Minus },
  { value: 'media', label: '\uC774\uBBF8\uC9C0 \uC0BD\uC785', icon: ImagePlus, mediaOnly: true },
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
    case 'largeHeading': {
      const value = selectedText || MARKDOWN_LARGE_HEADING_PLACEHOLDER

      return {
        text: `<posty-large>${value}</posty-large>`,
        selectionStartOffset: selectedText ? 27 + value.length : 13,
        selectionEndOffset: selectedText ? 27 + value.length : 13 + value.length,
      }
    }
    case 'heading': {
      const value = selectedText || MARKDOWN_HEADING_PLACEHOLDER

      return {
        text: `<posty-title>${value}</posty-title>`,
        selectionStartOffset: selectedText ? 27 + value.length : 13,
        selectionEndOffset: selectedText ? 27 + value.length : 13 + value.length,
      }
    }
    case 'paragraph': {
      const value = selectedText || MARKDOWN_TEXT_PLACEHOLDER

      return {
        text: value,
        selectionStartOffset: selectedText ? value.length : 0,
        selectionEndOffset: selectedText ? value.length : value.length,
      }
    }
    case 'small': {
      const value = selectedText || MARKDOWN_SMALL_PLACEHOLDER

      return {
        text: `<small>${value}</small>`,
        selectionStartOffset: selectedText ? 15 + value.length : 7,
        selectionEndOffset: selectedText ? 15 + value.length : 7 + value.length,
      }
    }
    case 'muted': {
      const value = selectedText || MARKDOWN_MUTED_PLACEHOLDER

      return {
        text: `<posty-muted>${value}</posty-muted>`,
        selectionStartOffset: selectedText ? 27 + value.length : 13,
        selectionEndOffset: selectedText ? 27 + value.length : 13 + value.length,
      }
    }
    case 'colorInk':
    case 'colorBody':
    case 'colorMuted':
    case 'colorAccent':
    case 'colorCalm': {
      const value = selectedText || MARKDOWN_TEXT_PLACEHOLDER
      const colorKey = action.replace('color', '').toLowerCase()
      const openingTag = `<posty-color-${colorKey}>`
      const closingTag = `</posty-color-${colorKey}>`

      return {
        text: `${openingTag}${value}${closingTag}`,
        selectionStartOffset: selectedText
          ? openingTag.length + value.length + closingTag.length
          : openingTag.length,
        selectionEndOffset: selectedText
          ? openingTag.length + value.length + closingTag.length
          : openingTag.length + value.length,
      }
    }
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
    case 'media':
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

export type MediaSizePreset = 'original' | 'small' | 'medium' | 'large' | 'full'

export function createMediaMarkdownToken(media: {
  id: string
  media_type: 'image' | 'video'
  size?: MediaSizePreset
}) {
  const label = media.media_type === 'video' ? MARKDOWN_MEDIA_VIDEO_LABEL : MARKDOWN_MEDIA_IMAGE_LABEL
  const size = media.size ?? 'original'

  return `![${label}](posty-media:${media.id}|size=${size})`
}

export function MarkdownToolbar({
  onAction,
  disabled = false,
  className,
  toolbarClassName,
  showMediaAction = false,
}: MarkdownToolbarProps) {
  return (
    <div className={className ?? 'toolbar-wrap shrink-0 border-b border-[var(--color-border-soft)] px-4 sm:px-6 lg:px-11'}>
      <div className={toolbarClassName ?? 'toolbar flex min-h-10 items-center gap-1 overflow-x-auto py-1'}>
        {MARKDOWN_TOOLBAR_ITEMS.filter((item) => !item.mediaOnly || showMediaAction).map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onAction(item.value)}
              disabled={disabled}
              title={item.label}
              aria-label={item.label}
              className={[
                'flex h-8 shrink-0 items-center justify-center rounded-[4px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted-soft)]',
                item.text ? 'px-2 text-[11px] font-semibold' : 'w-8',
              ].join(' ')}
            >
              {Icon ? (
                <Icon size={14} />
              ) : item.swatchClass ? (
                <span
                  className={[
                    'h-3.5 w-3.5 rounded-full border border-[var(--color-border-default)]',
                    item.swatchClass,
                  ].join(' ')}
                />
              ) : (
                item.text
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
