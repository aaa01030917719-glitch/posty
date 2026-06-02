'use client'

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import {
  createTiptapDocEnvelope,
  getPlainTextFromTiptapDoc,
  type TiptapEditorDocEnvelope,
} from '@/lib/content-editor-doc'
import {
  POSTY_TIPTAP_COLOR_PRESETS,
  POSTY_TIPTAP_FONT_SIZE_PRESETS,
  createPostyTiptapExtensions,
} from './postyTiptapExtensions'
import './postyTiptapEditor.css'

type PostyTiptapEditorProps = {
  value: JSONContent
  disabled?: boolean
  placeholder?: string
  onChange: (envelope: TiptapEditorDocEnvelope, plainText: string) => void
  bodyHeader?: ReactNode
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  onPress,
}: {
  active?: boolean
  children: ReactNode
  disabled?: boolean
  onPress: () => void
}) {
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (disabled) return
    onPress()
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={handleMouseDown}
      className={[
        'h-8 rounded-[6px] border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-body)] hover:bg-[var(--color-bg-subtle)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function PostyTiptapEditor({
  value,
  disabled = false,
  placeholder,
  onChange,
  bodyHeader,
}: PostyTiptapEditorProps) {
  const [tableMessage, setTableMessage] = useState(
    'Click inside a table cell before editing rows or columns.'
  )
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
        Loading editor...
      </div>
    )
  }

  const applyLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', previousUrl ?? 'https://')

    if (url === null) return

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const toggleBulletList = () => {
    editor.chain().focus().toggleBulletList().run()
  }

  const toggleOrderedList = () => {
    editor.chain().focus().toggleOrderedList().run()
  }

  const insertTable = () => {
    const isInsideList =
      editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('listItem')

    if (isInsideList) {
      setTableMessage('Place the cursor in a new paragraph outside the list before inserting a table.')
      return
    }

    const didInsert = editor
      .chain()
      .focus()
      .insertContent({ type: 'paragraph' })
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .insertContent({ type: 'paragraph' })
      .run()

    setTableMessage(
      didInsert
        ? 'Table inserted. Click a cell before adding or deleting rows and columns.'
        : 'Could not insert a table at the current cursor position.'
    )
  }

  const runTableCommand = (label: string, command: () => boolean) => {
    const didRun = command()
    setTableMessage(
      didRun
        ? `${label} complete.`
        : 'Click inside a table cell before editing rows or columns.'
    )
  }

  const canAddRow = editor.can().chain().focus().addRowAfter().run()
  const canDeleteRow = editor.can().chain().focus().deleteRow().run()
  const canAddColumn = editor.can().chain().focus().addColumnAfter().run()
  const canDeleteColumn = editor.can().chain().focus().deleteColumn().run()
  const canDeleteTable = editor.can().chain().focus().deleteTable().run()

  return (
    <div className="flex flex-col gap-3">
      {bodyHeader}

      <section className="flex flex-col gap-3 rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3">
        <div className="flex flex-wrap gap-2">
          <ToolbarButton
            active={editor.isActive('paragraph')}
            disabled={disabled}
            onPress={() => editor.chain().focus().setParagraph().run()}
          >
            Paragraph
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 1 })}
            disabled={disabled}
            onPress={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            30px
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            disabled={disabled}
            onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            Heading
          </ToolbarButton>
          <ToolbarButton disabled={disabled} active={editor.isActive('bold')} onPress={() => editor.chain().focus().toggleBold().run()}>
            Bold
          </ToolbarButton>
          <ToolbarButton disabled={disabled} active={editor.isActive('italic')} onPress={() => editor.chain().focus().toggleItalic().run()}>
            Italic
          </ToolbarButton>
          <ToolbarButton disabled={disabled} active={editor.isActive('strike')} onPress={() => editor.chain().focus().toggleStrike().run()}>
            Strike
          </ToolbarButton>
          <ToolbarButton disabled={disabled} active={editor.isActive('bulletList')} onPress={toggleBulletList}>
            Bullet
          </ToolbarButton>
          <ToolbarButton disabled={disabled} active={editor.isActive('orderedList')} onPress={toggleOrderedList}>
            Numbered
          </ToolbarButton>
          <ToolbarButton disabled={disabled} onPress={() => editor.chain().focus().setHorizontalRule().run()}>
            Divider
          </ToolbarButton>
          <ToolbarButton disabled={disabled} active={editor.isActive('link')} onPress={applyLink}>
            Link
          </ToolbarButton>
          <ToolbarButton disabled={disabled || !editor.can().undo()} onPress={() => editor.chain().focus().undo().run()}>
            Undo
          </ToolbarButton>
          <ToolbarButton disabled={disabled || !editor.can().redo()} onPress={() => editor.chain().focus().redo().run()}>
            Redo
          </ToolbarButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Font size</span>
          {POSTY_TIPTAP_FONT_SIZE_PRESETS.map((fontSize) => (
            <ToolbarButton
              key={fontSize}
              active={editor.isActive('textStyle', { fontSize })}
              disabled={disabled}
              onPress={() => editor.chain().focus().setFontSize(fontSize).run()}
            >
              {fontSize}
            </ToolbarButton>
          ))}
          <ToolbarButton disabled={disabled} onPress={() => editor.chain().focus().unsetFontSize().run()}>
            Reset size
          </ToolbarButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Color</span>
          {POSTY_TIPTAP_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              disabled={disabled}
              aria-label={`Apply text color ${color}`}
              onMouseDown={(event) => {
                event.preventDefault()
                if (disabled) return
                editor.chain().focus().setColor(color).run()
              }}
              className="h-8 w-8 rounded-[6px] border border-[var(--color-border-default)] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: color }}
            />
          ))}
          <ToolbarButton disabled={disabled} onPress={() => editor.chain().focus().unsetColor().run()}>
            Reset color
          </ToolbarButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Table</span>
          <ToolbarButton disabled={disabled} onPress={insertTable}>
            Insert 3x3
          </ToolbarButton>
          <ToolbarButton disabled={disabled || !canAddRow} onPress={() => runTableCommand('Add row', () => editor.chain().focus().addRowAfter().run())}>
            Add row
          </ToolbarButton>
          <ToolbarButton disabled={disabled || !canDeleteRow} onPress={() => runTableCommand('Delete row', () => editor.chain().focus().deleteRow().run())}>
            Delete row
          </ToolbarButton>
          <ToolbarButton disabled={disabled || !canAddColumn} onPress={() => runTableCommand('Add column', () => editor.chain().focus().addColumnAfter().run())}>
            Add column
          </ToolbarButton>
          <ToolbarButton disabled={disabled || !canDeleteColumn} onPress={() => runTableCommand('Delete column', () => editor.chain().focus().deleteColumn().run())}>
            Delete column
          </ToolbarButton>
          <ToolbarButton disabled={disabled || !canDeleteTable} onPress={() => runTableCommand('Delete table', () => editor.chain().focus().deleteTable().run())}>
            Delete table
          </ToolbarButton>
          <span className="basis-full text-xs text-[var(--color-text-muted)]">
            {tableMessage}
          </span>
        </div>
      </section>

      <section className="posty-tiptap-editor rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-4">
        <EditorContent editor={editor} />
      </section>
    </div>
  )
}
