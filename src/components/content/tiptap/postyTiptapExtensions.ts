import { TableKit } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

export const POSTY_TIPTAP_FONT_SIZE_PRESETS = ['30px', '24px', '20px', '16px', '14px'] as const

export const POSTY_TIPTAP_COLOR_PRESETS = [
  '#222222',
  '#3f3f3f',
  '#6a6a6a',
  '#2563eb',
  '#2f6f66',
] as const

export function createPostyTiptapExtensions() {
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
