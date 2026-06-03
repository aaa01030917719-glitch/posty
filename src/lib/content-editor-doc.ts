import type { JSONContent } from '@tiptap/react'
import type { Json, ShareSection } from '@/lib/types'

export const TIPTAP_EDITOR_SCHEMA_VERSION = 1
export const TIPTAP_EDITOR_FORMAT = 'tiptap-json'

export type TiptapEditorDocEnvelope = {
  schema_version: typeof TIPTAP_EDITOR_SCHEMA_VERSION
  format: typeof TIPTAP_EDITOR_FORMAT
  doc: JSONContent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isTiptapDoc(value: unknown): value is JSONContent {
  return isRecord(value) && value.type === 'doc'
}

export function createEmptyTiptapDoc(): JSONContent {
  return {
    type: 'doc',
    content: [],
  }
}

export function createTiptapDocEnvelope(doc: JSONContent): TiptapEditorDocEnvelope {
  return {
    schema_version: TIPTAP_EDITOR_SCHEMA_VERSION,
    format: TIPTAP_EDITOR_FORMAT,
    doc,
  }
}

export function isTiptapDocEnvelope(value: unknown): value is TiptapEditorDocEnvelope {
  return (
    isRecord(value) &&
    value.schema_version === TIPTAP_EDITOR_SCHEMA_VERSION &&
    value.format === TIPTAP_EDITOR_FORMAT &&
    isTiptapDoc(value.doc)
  )
}

export function getTiptapDocFromEnvelope(value: Json | null | undefined): JSONContent | null {
  return isTiptapDocEnvelope(value) ? value.doc : null
}

function createTextParagraph(text: string): JSONContent {
  return text
    ? {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      }
    : { type: 'paragraph' }
}

export function createTiptapDocFromLegacyMemo(memo: string | null | undefined): JSONContent {
  if (!memo?.trim()) return createEmptyTiptapDoc()

  return {
    type: 'doc',
    content: memo.split(/\r?\n/).map((line) => createTextParagraph(line)),
  }
}

export function getTiptapDocForEditor(
  memoDoc: Json | null | undefined,
  legacyMemo: string | null | undefined
): JSONContent {
  return getTiptapDocFromEnvelope(memoDoc) ?? createTiptapDocFromLegacyMemo(legacyMemo)
}

function mergeShareSectionsForTiptapFallback(shareSections: ShareSection[] | null | undefined) {
  if (!Array.isArray(shareSections)) return ''

  return shareSections
    .map((section) => {
      const title = typeof section.title === 'string' ? section.title.trim() : ''
      const body = typeof section.body === 'string' ? section.body.trim() : ''

      if (title && body) return `${title}\n${body}`
      if (title) return title

      return body
    })
    .filter(Boolean)
    .join('\n\n')
}

export function resolveShareBodyEditorDoc({
  shareBodyDoc,
  shareSections,
}: {
  shareBodyDoc: Json | null | undefined
  shareSections: ShareSection[] | null | undefined
}): JSONContent {
  return (
    getTiptapDocFromEnvelope(shareBodyDoc) ??
    createTiptapDocFromLegacyMemo(mergeShareSectionsForTiptapFallback(shareSections))
  )
}

function collectPlainText(node: JSONContent, lines: string[]) {
  if (typeof node.text === 'string') {
    lines[lines.length - 1] = `${lines[lines.length - 1] ?? ''}${node.text}`
  }

  if (node.type === 'hardBreak') {
    lines.push('')
  }

  node.content?.forEach((child) => collectPlainText(child, lines))

  if (
    node.type === 'paragraph' ||
    node.type === 'heading' ||
    node.type === 'listItem' ||
    node.type === 'tableRow'
  ) {
    lines.push('')
  }
}

export function getPlainTextFromTiptapDoc(doc: JSONContent | null | undefined): string {
  if (!doc) return ''

  const lines = ['']
  collectPlainText(doc, lines)

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
