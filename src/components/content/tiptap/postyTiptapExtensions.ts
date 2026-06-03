import { TableKit } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import {
  PostyInlineMedia,
  type PostyInlineMediaItem,
} from './postyInlineMediaExtension'

export const POSTY_TIPTAP_FONT_SIZE_PRESETS = [
  '40px',
  '36px',
  '32px',
  '30px',
  '28px',
  '24px',
  '20px',
  '18px',
  '16px',
  '14px',
] as const

export const POSTY_TIPTAP_COLOR_PRESETS = [
  '#222222',
  '#3F3F3F',
  '#6A6A6A',
  '#980000',
  '#FF0000',
  '#FF9900',
  '#EAB308',
  '#22C55E',
  '#38BDF8',
  '#4A86E8',
  '#0000FF',
  '#9900FF',
  '#EC4899',
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
