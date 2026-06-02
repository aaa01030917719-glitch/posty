'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { X } from 'lucide-react'
import type {
  PostyInlineMediaItem,
  PostyInlineMediaOptions,
  PostyInlineMediaSize,
} from './postyInlineMediaExtension'

const INLINE_MEDIA_SIZE_PRESETS: PostyInlineMediaSize[] = [
  'original',
  'small',
  'medium',
  'large',
  'full',
]

const SIZE_LABELS: Record<PostyInlineMediaSize, string> = {
  original: '원본',
  small: '작게',
  medium: '중간',
  large: '크게',
  full: '꽉 채우기',
}

const SIZE_CLASS_NAMES: Record<PostyInlineMediaSize, string> = {
  original: 'max-w-full',
  small: 'w-[180px] max-w-full',
  medium: 'w-[320px] max-w-full',
  large: 'w-[520px] max-w-full',
  full: 'w-full',
}

function getNodeSize(value: unknown): PostyInlineMediaSize {
  return INLINE_MEDIA_SIZE_PRESETS.includes(value as PostyInlineMediaSize)
    ? (value as PostyInlineMediaSize)
    : 'medium'
}

function getMediaItem(props: NodeViewProps): PostyInlineMediaItem | null {
  const mediaId = props.node.attrs.mediaId as string | null | undefined
  const options = props.extension.options as PostyInlineMediaOptions

  return mediaId ? options.getMediaItem(mediaId) : null
}

export function PostyInlineMediaNodeView(props: NodeViewProps) {
  const size = getNodeSize(props.node.attrs.size)
  const alt = (props.node.attrs.alt as string | null | undefined) ?? ''
  const media = getMediaItem(props)
  const label = alt || media?.fileName || '본문 이미지'

  return (
    <NodeViewWrapper
      as="figure"
      data-posty-inline-media
      className={[
        'posty-inline-media group my-4 max-w-full',
        props.selected ? 'is-selected' : '',
      ].join(' ')}
    >
      <div className={['posty-inline-media__frame', SIZE_CLASS_NAMES[size]].join(' ')}>
        {media?.signedUrl ? (
          <img
            src={media.signedUrl}
            alt={label}
            draggable={false}
            className="block h-auto max-h-[720px] w-full max-w-full rounded-[6px] object-contain"
          />
        ) : (
          <div className="flex min-h-[140px] w-full items-center justify-center rounded-[6px] border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-4 text-center text-xs font-medium text-[var(--color-text-muted)]">
            이미지를 불러올 수 없습니다.
          </div>
        )}

        <div
          className={[
            'posty-inline-media__controls',
            props.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          ].join(' ')}
          contentEditable={false}
        >
          <div className="flex max-w-[min(520px,calc(100vw-40px))] flex-wrap items-center gap-1 rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1 shadow-lg">
            {INLINE_MEDIA_SIZE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => props.updateAttributes({ size: preset })}
                className={[
                  'h-7 rounded-[5px] px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]',
                  size === preset
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-body)] hover:bg-[var(--color-bg-subtle)]',
                ].join(' ')}
              >
                {SIZE_LABELS[preset]}
              </button>
            ))}
            <button
              type="button"
              onClick={props.deleteNode}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-bg-surface))] focus-visible:outline-none focus-visible:[box-shadow:var(--focus-ring)]"
              aria-label="본문 이미지 삭제"
              title="본문 이미지 삭제"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  )
}
