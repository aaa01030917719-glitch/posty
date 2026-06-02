'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import {
  TIPTAP_COLOR_PRESETS,
  TIPTAP_FONT_SIZE_PRESETS,
  createTiptapPrototypeExtensions,
} from './tiptapPrototypeExtensions'
import './tiptapPrototype.css'

const SAMPLE_DOC: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Tiptap prototype' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Bold, italic, lists, links, colors, font sizes, and tables are kept as structured JSON.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List item one' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List item two' }] }],
        },
      ],
    },
  ],
}

const IMAGE_SAMPLE_URL =
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=960&q=80'

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  onPress,
}: {
  active?: boolean
  children: React.ReactNode
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

export function TiptapEditorPrototype() {
  const [jsonSnapshot, setJsonSnapshot] = useState<JSONContent>(SAMPLE_DOC)
  const [fileHandlerMessage, setFileHandlerMessage] = useState<string | null>(null)
  const [tableMessage, setTableMessage] = useState(
    'Click inside a table cell before editing rows or columns.'
  )

  const extensions = useMemo(
    () =>
      createTiptapPrototypeExtensions({
        onFileDrop: (files) => {
          setFileHandlerMessage(
            `${files.length} file(s) detected. Supabase upload is intentionally not connected in this prototype.`
          )
        },
      }),
    []
  )

  const editor = useEditor({
    extensions,
    content: SAMPLE_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[360px] rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] px-4 py-3 text-[var(--color-text-primary)] outline-none',
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      setJsonSnapshot(currentEditor.getJSON())
    },
    onUpdate: ({ editor: currentEditor }) => {
      setJsonSnapshot(currentEditor.getJSON())
    },
  })

  if (!editor) {
    return (
      <div className="rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-5 text-sm text-[var(--color-text-muted)]">
        Loading Tiptap prototype...
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

  const refreshJson = () => {
    setJsonSnapshot(editor.getJSON())
  }

  const resetPrototypeContent = () => {
    editor.chain().focus().setContent(SAMPLE_DOC).run()
    setJsonSnapshot(SAMPLE_DOC)
    setTableMessage('Test content reset. Place the cursor in a fresh paragraph before inserting a table.')
  }

  const insertPrototypeTable = () => {
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          Development prototype
        </p>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Tiptap editor prototype
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-muted)]">
          This page is isolated from production content editing, Supabase CRUD, legacy RichTextEditor,
          and draft snapshots. Use it only to inspect Tiptap editing behavior and JSON output.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-3">
        <div className="flex flex-wrap gap-2">
          <ToolbarButton
            active={editor.isActive('paragraph')}
            onPress={() => editor.chain().focus().setParagraph().run()}
          >
            Paragraph
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 1 })}
            onPress={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            30px heading
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            Heading
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('bold')} onPress={() => editor.chain().focus().toggleBold().run()}>
            Bold
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('italic')} onPress={() => editor.chain().focus().toggleItalic().run()}>
            Italic
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('strike')} onPress={() => editor.chain().focus().toggleStrike().run()}>
            Strike
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onPress={() => editor.chain().focus().toggleBulletList().run()}
          >
            Bullet
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onPress={() => editor.chain().focus().toggleOrderedList().run()}
          >
            Numbered
          </ToolbarButton>
          <ToolbarButton onPress={() => editor.chain().focus().setHorizontalRule().run()}>
            Divider
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('link')} onPress={applyLink}>
            Link
          </ToolbarButton>
          <ToolbarButton disabled={!editor.can().undo()} onPress={() => editor.chain().focus().undo().run()}>
            Undo
          </ToolbarButton>
          <ToolbarButton disabled={!editor.can().redo()} onPress={() => editor.chain().focus().redo().run()}>
            Redo
          </ToolbarButton>
          <ToolbarButton onPress={resetPrototypeContent}>
            테스트 내용 초기화
          </ToolbarButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Font size</span>
          {TIPTAP_FONT_SIZE_PRESETS.map((fontSize) => (
            <ToolbarButton
              key={fontSize}
              active={editor.isActive('textStyle', { fontSize })}
              onPress={() => editor.chain().focus().setFontSize(fontSize).run()}
            >
              {fontSize}
            </ToolbarButton>
          ))}
          <ToolbarButton onPress={() => editor.chain().focus().unsetFontSize().run()}>
            Reset size
          </ToolbarButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Color</span>
          {TIPTAP_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Apply text color ${color}`}
              onMouseDown={(event) => {
                event.preventDefault()
                editor.chain().focus().setColor(color).run()
              }}
              className="h-8 w-8 rounded-[6px] border border-[var(--color-border-default)]"
              style={{ backgroundColor: color }}
            />
          ))}
          <ToolbarButton onPress={() => editor.chain().focus().unsetColor().run()}>
            Reset color
          </ToolbarButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Table</span>
          <ToolbarButton onPress={insertPrototypeTable}>
            Insert 3x3
          </ToolbarButton>
          <ToolbarButton
            disabled={!canAddRow}
            onPress={() => runTableCommand('Add row', () => editor.chain().focus().addRowAfter().run())}
          >
            Add row
          </ToolbarButton>
          <ToolbarButton
            disabled={!canDeleteRow}
            onPress={() => runTableCommand('Delete row', () => editor.chain().focus().deleteRow().run())}
          >
            Delete row
          </ToolbarButton>
          <ToolbarButton
            disabled={!canAddColumn}
            onPress={() => runTableCommand('Add column', () => editor.chain().focus().addColumnAfter().run())}
          >
            Add column
          </ToolbarButton>
          <ToolbarButton
            disabled={!canDeleteColumn}
            onPress={() => runTableCommand('Delete column', () => editor.chain().focus().deleteColumn().run())}
          >
            Delete column
          </ToolbarButton>
          <ToolbarButton
            disabled={!canDeleteTable}
            onPress={() => runTableCommand('Delete table', () => editor.chain().focus().deleteTable().run())}
          >
            Delete table
          </ToolbarButton>
          <span className="basis-full text-xs text-[var(--color-text-muted)]">
            행과 열을 수정하려면 표 안의 셀을 먼저 클릭해주세요. {tableMessage}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Image/FileHandler</span>
          <ToolbarButton onPress={() => editor.chain().focus().setImage({ src: IMAGE_SAMPLE_URL, alt: 'Temporary prototype image' }).run()}>
            Insert sample image URL
          </ToolbarButton>
          {fileHandlerMessage && (
            <span className="text-xs text-[var(--color-text-muted)]">{fileHandlerMessage}</span>
          )}
        </div>
      </section>

      <section className="tiptap-prototype-editor rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-4">
        <EditorContent editor={editor} />
      </section>

      <section className="rounded-[8px] border border-[var(--color-border-soft)] bg-[var(--color-bg-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Current editor JSON</h2>
          <ToolbarButton onPress={refreshJson}>Refresh JSON</ToolbarButton>
        </div>
        <pre className="max-h-[420px] overflow-auto rounded-[8px] bg-[var(--color-bg-subtle)] p-3 text-xs leading-5 text-[var(--color-text-body)]">
          {JSON.stringify(jsonSnapshot, null, 2)}
        </pre>
      </section>
    </div>
  )
}
