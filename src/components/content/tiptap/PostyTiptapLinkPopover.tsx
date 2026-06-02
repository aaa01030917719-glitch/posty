'use client'

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react'
import type { Editor } from '@tiptap/react'

type PostyTiptapLinkPopoverProps = {
  editor: Editor
  disabled?: boolean
  onClose: () => void
  selectionRange: { from: number; to: number } | null
}

export function PostyTiptapLinkPopover({
  editor,
  disabled = false,
  onClose,
  selectionRange,
}: PostyTiptapLinkPopoverProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const currentHref = editor.getAttributes('link').href as string | undefined
    setUrlDraft(currentHref ?? '')

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [editor])

  const stopPopoverEvent = (
    event: ClipboardEvent<HTMLElement> | KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>
  ) => {
    event.stopPropagation()
  }

  const applyLink = () => {
    if (disabled) return

    const href = urlDraft.trim()

    if (!href) {
      setError('URL을 입력해주세요.')
      return
    }

    const command = editor.chain().focus()

    if (selectionRange && selectionRange.from !== selectionRange.to) {
      command.setTextSelection(selectionRange).setLink({
        href,
        target: '_blank',
        rel: 'noreferrer noopener',
      })
    } else {
      command.extendMarkRange('link').setLink({
        href,
        target: '_blank',
        rel: 'noreferrer noopener',
      })
    }

    command.run()
    onClose()
  }

  const removeLink = () => {
    if (disabled) return

    const command = editor.chain().focus()

    if (selectionRange && selectionRange.from !== selectionRange.to) {
      command.setTextSelection(selectionRange).unsetLink()
    } else {
      command.extendMarkRange('link').unsetLink()
    }

    command.run()
    onClose()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()

    if (event.key === 'Enter') {
      event.preventDefault()
      applyLink()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const handleButtonMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      className="absolute left-4 top-full z-50 mt-2 w-[min(360px,calc(100vw-24px))] rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 shadow-lg"
      onMouseDown={stopPopoverEvent}
      onClick={stopPopoverEvent}
      onKeyDown={stopPopoverEvent}
      onPaste={stopPopoverEvent}
    >
      <label className="block text-xs font-semibold text-[var(--color-text-body)]">
        <span className="mb-1.5 block">링크 URL</span>
        <input
          ref={inputRef}
          type="url"
          value={urlDraft}
          disabled={disabled}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onPaste={(event) => event.stopPropagation()}
          onChange={(event) => {
            setUrlDraft(event.target.value)
            setError(null)
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="https://example.com"
          className="h-9 w-full rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 text-xs font-medium text-[var(--color-text-body)] outline-none transition-[border-color,box-shadow] focus:border-[var(--color-accent)] focus:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>
      {error ? <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={disabled || !editor.isActive('link')}
          onMouseDown={handleButtonMouseDown}
          onClick={(event) => {
            event.stopPropagation()
            removeLink()
          }}
          className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          링크 해제
        </button>
        <button
          type="button"
          onMouseDown={handleButtonMouseDown}
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          className="inline-flex h-8 items-center justify-center rounded-[6px] border border-[var(--color-border-default)] px-3 text-xs font-semibold text-[var(--color-text-body)] transition-colors hover:bg-[var(--color-bg-subtle)]"
        >
          취소
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={handleButtonMouseDown}
          onClick={(event) => {
            event.stopPropagation()
            applyLink()
          }}
          className="inline-flex h-8 items-center justify-center rounded-[6px] bg-[var(--color-accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  )
}
