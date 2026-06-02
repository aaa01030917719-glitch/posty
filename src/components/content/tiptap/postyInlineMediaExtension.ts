import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { PostyInlineMediaNodeView } from './PostyInlineMediaNodeView'

export type PostyInlineMediaSize = 'original' | 'small' | 'medium' | 'large' | 'full'

export type PostyInlineMediaItem = {
  id: string
  signedUrl: string | null
  fileName: string
}

export type PostyInlineMediaAttrs = {
  mediaId: string
  size?: PostyInlineMediaSize
  alt?: string
}

export type PostyInlineMediaOptions = {
  getMediaItem: (mediaId: string) => PostyInlineMediaItem | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    postyInlineMedia: {
      setPostyInlineMedia: (attrs: PostyInlineMediaAttrs) => ReturnType
    }
  }
}

export const POSTY_INLINE_MEDIA_SIZE_PRESETS: PostyInlineMediaSize[] = [
  'original',
  'small',
  'medium',
  'large',
  'full',
]

export const PostyInlineMedia = Node.create<PostyInlineMediaOptions>({
  name: 'postyInlineMedia',

  group: 'block',

  atom: true,

  draggable: true,

  selectable: true,

  addOptions() {
    return {
      getMediaItem: () => null,
    }
  },

  addAttributes() {
    return {
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes) => ({
          'data-media-id': attributes.mediaId,
        }),
      },
      size: {
        default: 'medium',
        parseHTML: (element) => element.getAttribute('data-size') || 'medium',
        renderHTML: (attributes) => ({
          'data-size': attributes.size,
        }),
      },
      alt: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-alt') || '',
        renderHTML: (attributes) => ({
          'data-alt': attributes.alt,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-posty-inline-media]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-posty-inline-media': 'true',
      }),
    ]
  },

  addCommands() {
    return {
      setPostyInlineMedia:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              mediaId: attrs.mediaId,
              size: attrs.size ?? 'medium',
              alt: attrs.alt ?? '',
            },
          }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(PostyInlineMediaNodeView)
  },
})
