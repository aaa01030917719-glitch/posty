'use client'

import { useEffect, useMemo, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import {
  createTiptapDocEnvelope,
  getPlainTextFromTiptapDoc,
  type TiptapEditorDocEnvelope,
} from '@/lib/content-editor-doc'
import { createPostyTiptapExtensions } from './postyTiptapExtensions'
import { PostyTiptapToolbar } from './PostyTiptapToolbar'
import './postyTiptapEditor.css'

type PostyTiptapEditorProps = {
  value: JSONContent
  disabled?: boolean
  placeholder?: string
  onChange: (envelope: TiptapEditorDocEnvelope, plainText: string) => void
  bodyHeader?: ReactNode
}

export function PostyTiptapEditor({
  value,
  disabled = false,
  placeholder,
  onChange,
  bodyHeader,
}: PostyTiptapEditorProps) {
  const extensions = useMemo(() => createPostyTiptapExtensions(), [])

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[360px] rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-4 py-3 text-[var(--color-text-primary)] outline-none',
        'data-placeholder': placeholder ?? '',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextDoc = currentEditor.getJSON()
      onChange(createTiptapDocEnvelope(nextDoc), getPlainTextFromTiptapDoc(nextDoc))
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  if (!editor) {
    return (
      <div className="rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-5 text-sm text-[var(--color-text-muted)]">
        에디터를 불러오는 중입니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {bodyHeader}
      <PostyTiptapToolbar editor={editor} disabled={disabled} />

      <section className="posty-tiptap-editor rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-4">
        <EditorContent editor={editor} />
      </section>
    </div>
  )
}
