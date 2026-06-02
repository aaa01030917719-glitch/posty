import { TableKit } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import {
  PostyInlineMedia,
  type PostyInlineMediaItem,
} from './postyInlineMediaExtension'

export const POSTY_TIPTAP_FONT_SIZE_PRESETS = ['30px', '24px', '20px', '16px', '14px'] as const

export const POSTY_TIPTAP_COLOR_PRESETS = [
  '#222222',
  '#3f3f3f',
  '#6a6a6a',
  '#2563eb',
  '#2f6f66',
] as const

export function createPostyTiptapExtensions({
  getInlineMediaItem,
}: {
  getInlineMediaItem?: (mediaId: string) => PostyInlineMediaItem | null
} = {}) {
  return [
    StarterKit.configure({
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#2563eb] underline underline-offset-2',
          target: '_blank',
          rel: 'noreferrer noopener',
        },
      },
    }),
    TextStyleKit,
    PostyInlineMedia.configure({
      getMediaItem: getInlineMediaItem ?? (() => null),
    }),
    TableKit.configure({
      table: {
        resizable: false,
        HTMLAttributes: {
          class: 'posty-tiptap-table',
        },
      },
    }),
  ]
}
