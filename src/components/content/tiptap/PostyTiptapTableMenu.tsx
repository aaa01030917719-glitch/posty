'use client'

import { useState, type MouseEvent, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'

type PostyTiptapTableMenuProps = {
  editor: Editor
  disabled?: boolean
}

function TableMenuButton({
  children,
  disabled = false,
  onPress,
}: {
  children: ReactNode
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        if (disabled) return
        onPress()
      }}
      className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function PostyTiptapTableMenu({
  editor,
  disabled = false,
}: PostyTiptapTableMenuProps) {
  const [message, setMessage] = useState('행과 열을 수정하려면 표 안의 셀을 먼저 클릭해주세요.')

  const keepEditorSelection = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
  }

  const isInsideList =
    editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('listItem')
  const canAddRow = editor.can().chain().focus().addRowAfter().run()
  const canDeleteRow = editor.can().chain().focus().deleteRow().run()
  const canAddColumn = editor.can().chain().focus().addColumnAfter().run()
  const canDeleteColumn = editor.can().chain().focus().deleteColumn().run()
  const canDeleteTable = editor.can().chain().focus().deleteTable().run()

  const insertTable = () => {
    if (disabled) return

    if (isInsideList) {
      setMessage('목록 밖의 새 문단에 커서를 두고 표를 삽입해주세요.')
      return
    }

    const didInsert = editor
      .chain()
      .focus()
      .insertContent({ type: 'paragraph' })
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .insertContent({ type: 'paragraph' })
      .run()

    setMessage(
      didInsert
        ? '3x3 표를 삽입했습니다.'
        : '현재 커서 위치에는 표를 삽입할 수 없습니다.'
    )
  }

  const runTableCommand = (label: string, command: () => boolean) => {
    if (disabled) return

    const didRun = command()
    setMessage(didRun ? `${label}했습니다.` : '표 안의 셀을 먼저 클릭해주세요.')
  }

  return (
    <div
      className="absolute right-4 top-full z-50 mt-2 w-[min(360px,calc(100vw-24px))] rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 shadow-lg"
      onMouseDown={keepEditorSelection}
    >
      <div className="flex flex-wrap gap-2">
        <TableMenuButton disabled={disabled} onPress={insertTable}>
          3x3 삽입
        </TableMenuButton>
        <TableMenuButton
          disabled={disabled || !canAddRow}
          onPress={() =>
            runTableCommand('행을 추가', () => editor.chain().focus().addRowAfter().run())
          }
        >
          행 추가
        </TableMenuButton>
        <TableMenuButton
          disabled={disabled || !canDeleteRow}
          onPress={() =>
            runTableCommand('행을 삭제', () => editor.chain().focus().deleteRow().run())
          }
        >
          행 삭제
        </TableMenuButton>
        <TableMenuButton
          disabled={disabled || !canAddColumn}
          onPress={() =>
            runTableCommand('열을 추가', () => editor.chain().focus().addColumnAfter().run())
          }
        >
          열 추가
        </TableMenuButton>
        <TableMenuButton
          disabled={disabled || !canDeleteColumn}
          onPress={() =>
            runTableCommand('열을 삭제', () => editor.chain().focus().deleteColumn().run())
          }
        >
          열 삭제
        </TableMenuButton>
        <TableMenuButton
          disabled={disabled || !canDeleteTable}
          onPress={() =>
            runTableCommand('표를 삭제', () => editor.chain().focus().deleteTable().run())
          }
        >
          표 삭제
        </TableMenuButton>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">{message}</p>
    </div>
  )
}
