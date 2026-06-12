'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import { Fragment, Slice } from '@tiptap/pm/model'
import {
  createTiptapDocEnvelope,
  getPlainTextFromTiptapDoc,
  type TiptapEditorDocEnvelope,
} from '@/lib/content-editor-doc'
import { createPostyTiptapExtensions } from './postyTiptapExtensions'
import { PostyTiptapToolbar } from './PostyTiptapToolbar'
import type { PostyInlineMediaItem } from './postyInlineMediaExtension'
import './postyTiptapEditor.css'

type PostyTiptapEditorProps = {
  value: JSONContent
  disabled?: boolean
  placeholder?: string
  onChange: (envelope: TiptapEditorDocEnvelope, plainText: string) => void
  bodyHeader?: ReactNode
  inlineMediaItems?: PostyInlineMediaItem[]
  onUploadInlineImages?: (files: File[]) => Promise<PostyInlineMediaItem[]>
  uploadDisabled?: boolean
}

export function PostyTiptapEditor({
  value,
  disabled = false,
  placeholder,
  onChange,
  bodyHeader,
  inlineMediaItems = [],
  onUploadInlineImages,
  uploadDisabled = false,
}: PostyTiptapEditorProps) {
  const inlineMediaItemsRef = useRef<PostyInlineMediaItem[]>(inlineMediaItems)
  const uploadInlineImagesHandlerRef = useRef<(files: File[], position?: number) => void>(
    () => undefined
  )
  const [inlineImageUploading, setInlineImageUploading] = useState(false)
  const extensions = useMemo(
    () =>
      createPostyTiptapExtensions({
        getInlineMediaItem: (mediaId) =>
          inlineMediaItemsRef.current.find((item) => item.id === mediaId) ?? null,
      }),
    []
  )

  useEffect(() => {
    inlineMediaItemsRef.current = inlineMediaItems
  }, [inlineMediaItems])

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[360px] px-0 py-3 text-[var(--color-text-primary)] outline-none',
        'data-placeholder': placeholder ?? '',
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])

        if (files.some((file) => file.type.startsWith('image/'))) {
          event.preventDefault()
          uploadInlineImagesHandlerRef.current(files, view.state.selection.from)
          return true
        }

        const html = event.clipboardData?.getData('text/html') ?? ''
        const plainText = event.clipboardData?.getData('text/plain') ?? ''

        if (html || !plainText.includes('\n')) return false

        event.preventDefault()
        const lines = plainText.replace(/\r\n?/g, '\n').split('\n')
        const paragraphs = lines.map((line) =>
          line
            ? view.state.schema.nodes.paragraph.create(null, view.state.schema.text(line))
            : view.state.schema.nodes.paragraph.create()
        )

        view.dispatch(
          view.state.tr.replaceSelection(new Slice(Fragment.fromArray(paragraphs), 0, 0))
        )
        return true
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? [])

        if (!files.some((file) => file.type.startsWith('image/'))) return false

        event.preventDefault()
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos

        uploadInlineImagesHandlerRef.current(files, position ?? view.state.selection.from)
        return true
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

  const uploadInlineImages = async (files: File[], position?: number) => {
    if (!editor || disabled || uploadDisabled || inlineImageUploading || !onUploadInlineImages) {
      return
    }

    setInlineImageUploading(true)

    try {
      const uploadedItems = await onUploadInlineImages(files)

      if (uploadedItems.length === 0) return

      inlineMediaItemsRef.current = [
        ...inlineMediaItemsRef.current.filter(
          (item) => !uploadedItems.some((uploadedItem) => uploadedItem.id === item.id)
        ),
        ...uploadedItems,
      ]

      let nextPosition = position

      uploadedItems.forEach((item) => {
        const chain = editor.chain().focus()

        if (typeof nextPosition === 'number') {
          chain.setTextSelection(nextPosition)
        }

        chain
          .setPostyInlineMedia({
            mediaId: item.id,
            size: 'medium',
            alt: '',
          })
          .run()

        nextPosition = editor.state.selection.to
      })
    } finally {
      setInlineImageUploading(false)
    }
  }
  uploadInlineImagesHandlerRef.current = (files, position) => {
    void uploadInlineImages(files, position)
  }

  if (!editor) {
    return (
      <div className="rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-5 text-sm text-[var(--color-text-muted)]">
        에디터를 불러오는 중입니다.
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {bodyHeader}
      <PostyTiptapToolbar
        editor={editor}
        disabled={disabled}
        imageUploadDisabled={uploadDisabled || !onUploadInlineImages}
        imageUploading={inlineImageUploading}
        onUploadImages={(files) => uploadInlineImages(files)}
      />

      <section className="posty-tiptap-editor min-w-0 px-4 pb-4 sm:px-6 lg:px-11">
        <EditorContent editor={editor} />
      </section>
    </div>
  )
}
