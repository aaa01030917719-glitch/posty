'use client'

import { useState, type MouseEvent, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Redo2,
  Strikethrough,
  Table,
  Type,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { POSTY_TIPTAP_FONT_SIZE_PRESETS } from './postyTiptapExtensions'
import { PostyTiptapLinkPopover } from './PostyTiptapLinkPopover'
import { PostyTiptapTableMenu } from './PostyTiptapTableMenu'

type PostyTiptapToolbarProps = {
  editor: Editor
  disabled?: boolean
}

type OpenPopover = 'size' | 'color' | 'link' | 'table' | null
type SavedSelectionRange = { from: number; to: number } | null

const POSTY_TIPTAP_COLOR_PRESETS = [
  '#222222',
  '#3F3F3F',
  '#6A6A6A',
  '#980000',
  '#FF0000',
  '#FF9900',
  '#FFFF00',
  '#00FF00',
  '#00FFFF',
  '#4A86E8',
  '#0000FF',
  '#9900FF',
  '#FF00FF',
] as const

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  icon: Icon,
  label,
  onPress,
  text = false,
}: {
  active?: boolean
  children?: ReactNode
  disabled?: boolean
  icon?: LucideIcon
  label: string
  onPress: () => void
  text?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault()
        if (disabled) return
        onPress()
      }}
      className={[
        'flex h-8 shrink-0 items-center justify-center rounded-[4px] border border-transparent text-[var(--color-text-secondary)] transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40',
        text ? 'min-w-8 px-2 text-[11px] font-semibold' : 'w-8',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-body)]',
      ].join(' ')}
    >
      {Icon ? <Icon size={14} /> : children}
    </button>
  )
}

function ToolbarPopoverButton({
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
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        if (disabled) return
        onPress()
      }}
      className={[
        'inline-flex h-8 min-w-[56px] items-center justify-center rounded-[6px] border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border-default)] text-[var(--color-text-body)] hover:bg-[var(--color-bg-subtle)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-[var(--color-border-soft)]" />
}

export function PostyTiptapToolbar({ editor, disabled = false }: PostyTiptapToolbarProps) {
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [linkSelectionRange, setLinkSelectionRange] = useState<SavedSelectionRange>(null)

  const togglePopover = (popover: Exclude<OpenPopover, null>) => {
    setOpenPopover((current) => (current === popover ? null : popover))
  }

  const closePopover = () => {
    setOpenPopover(null)
  }

  const toggleLinkPopover = () => {
    if (openPopover === 'link') {
      closePopover()
      return
    }

    const { from, to } = editor.state.selection

    setLinkSelectionRange({ from, to })
    setOpenPopover('link')
  }

  const keepEditorSelection = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div className="toolbar-wrap relative shrink-0 overflow-visible border-b border-[var(--color-border-soft)] px-4 sm:px-6 lg:px-11">
      <div className="toolbar flex min-h-10 min-w-max items-center gap-1 overflow-x-auto py-1">
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          label="제목"
          onPress={() => {
            closePopover()
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }}
          text
        >
          제목
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('paragraph')}
          disabled={disabled}
          label="본문"
          onPress={() => {
            closePopover()
            editor.chain().focus().setParagraph().run()
          }}
          text
        >
          본문
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('textStyle', { fontSize: '14px' })}
          disabled={disabled}
          label="작게"
          onPress={() => {
            closePopover()
            editor.chain().focus().setFontSize('14px').run()
          }}
          text
        >
          작게
        </ToolbarButton>
        <div className="relative shrink-0">
          <ToolbarButton
            active={openPopover === 'size'}
            disabled={disabled}
            icon={Type}
            label="글씨 크기"
            onPress={() => togglePopover('size')}
          />
        </div>
        <ToolbarButton
          active={editor.isActive('bold')}
          disabled={disabled}
          icon={Bold}
          label="굵게"
          onPress={() => {
            closePopover()
            editor.chain().focus().toggleBold().run()
          }}
        />
        <ToolbarButton
          active={editor.isActive('italic')}
          disabled={disabled}
          icon={Italic}
          label="이탤릭"
          onPress={() => {
            closePopover()
            editor.chain().focus().toggleItalic().run()
          }}
        />
        <ToolbarButton
          active={editor.isActive('strike')}
          disabled={disabled}
          icon={Strikethrough}
          label="취소선"
          onPress={() => {
            closePopover()
            editor.chain().focus().toggleStrike().run()
          }}
        />
        <ToolbarButton
          active={editor.isActive('bulletList')}
          disabled={disabled}
          icon={List}
          label="말머리"
          onPress={() => {
            closePopover()
            editor.chain().focus().toggleBulletList().run()
          }}
        />
        <ToolbarButton
          active={editor.isActive('orderedList')}
          disabled={disabled}
          icon={ListOrdered}
          label="번호목록"
          onPress={() => {
            closePopover()
            editor.chain().focus().toggleOrderedList().run()
          }}
        />
        <div className="relative shrink-0">
          <ToolbarButton
            active={editor.isActive('link') || openPopover === 'link'}
            disabled={disabled}
            icon={Link2}
            label="링크"
            onPress={toggleLinkPopover}
          />
        </div>
        <ToolbarButton
          disabled={disabled}
          icon={Minus}
          label="구분선"
          onPress={() => {
            closePopover()
            editor.chain().focus().setHorizontalRule().run()
          }}
        />
        <ToolbarButton
          disabled
          icon={ImagePlus}
          label="본문 이미지 삽입은 다음 단계에서 연결합니다"
          onPress={() => undefined}
        />
        <div className="relative shrink-0">
          <ToolbarButton
            active={openPopover === 'table' || editor.isActive('table')}
            disabled={disabled}
            icon={Table}
            label="표"
            onPress={() => togglePopover('table')}
          />
        </div>
        <div className="relative shrink-0">
          <ToolbarButton
            active={openPopover === 'color'}
            disabled={disabled}
            icon={Palette}
            label="글씨 색상"
            onPress={() => togglePopover('color')}
          />
        </div>
        <Divider />
        <ToolbarButton
          disabled={disabled || !editor.can().chain().focus().undo().run()}
          icon={Undo2}
          label="되돌리기 Ctrl+Z"
          onPress={() => {
            closePopover()
            editor.chain().focus().undo().run()
          }}
        />
        <ToolbarButton
          disabled={disabled || !editor.can().chain().focus().redo().run()}
          icon={Redo2}
          label="다시 실행 Ctrl+Y"
          onPress={() => {
            closePopover()
            editor.chain().focus().redo().run()
          }}
        />
      </div>
      {openPopover === 'size' ? (
        <div
          className="absolute left-4 top-full z-50 mt-2 flex w-[min(280px,calc(100vw-24px))] flex-wrap gap-2 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 shadow-lg"
          onMouseDown={keepEditorSelection}
        >
          {POSTY_TIPTAP_FONT_SIZE_PRESETS.map((fontSize) => (
            <ToolbarPopoverButton
              key={fontSize}
              active={editor.isActive('textStyle', { fontSize })}
              disabled={disabled}
              onPress={() => {
                editor.chain().focus().setFontSize(fontSize).run()
                closePopover()
              }}
            >
              {fontSize}
            </ToolbarPopoverButton>
          ))}
          <ToolbarPopoverButton
            disabled={disabled}
            onPress={() => {
              editor.chain().focus().unsetFontSize().run()
              closePopover()
            }}
          >
            기본 크기
          </ToolbarPopoverButton>
        </div>
      ) : null}
      {openPopover === 'link' ? (
        <PostyTiptapLinkPopover
          editor={editor}
          disabled={disabled}
          selectionRange={linkSelectionRange}
          onClose={closePopover}
        />
      ) : null}
      {openPopover === 'table' ? (
        <PostyTiptapTableMenu editor={editor} disabled={disabled} />
      ) : null}
      {openPopover === 'color' ? (
        <div
          className="absolute right-4 top-full z-50 mt-2 flex w-[min(260px,calc(100vw-24px))] flex-wrap gap-2 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 shadow-lg"
          onMouseDown={keepEditorSelection}
        >
          {POSTY_TIPTAP_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              disabled={disabled}
              title={color}
              aria-label={`글씨 색상 ${color}`}
              onMouseDown={(event) => {
                event.preventDefault()
                if (disabled) return
                editor.chain().focus().setColor(color).run()
                closePopover()
              }}
              className={[
                'h-8 w-8 rounded-full border transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40',
                editor.isActive('textStyle', { color })
                  ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent-soft)]'
                  : 'border-[var(--color-border-default)]',
              ].join(' ')}
              style={{ backgroundColor: color }}
            />
          ))}
          <ToolbarPopoverButton
            disabled={disabled}
            onPress={() => {
              editor.chain().focus().unsetColor().run()
              closePopover()
            }}
          >
            기본 색상
          </ToolbarPopoverButton>
        </div>
      ) : null}
    </div>
  )
}
