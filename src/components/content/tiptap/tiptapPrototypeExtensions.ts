import { FileHandler } from '@tiptap/extension-file-handler'
import { Image } from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

export const TIPTAP_FONT_SIZE_PRESETS = ['30px', '24px', '20px', '16px', '14px'] as const

export const TIPTAP_COLOR_PRESETS = [
  '#222222',
  '#3f3f3f',
  '#6a6a6a',
  '#2563eb',
  '#2f6f66',
] as const

type CreatePrototypeExtensionsOptions = {
  onFileDrop?: (files: File[]) => void
}

export function createTiptapPrototypeExtensions({
  onFileDrop,
}: CreatePrototypeExtensionsOptions = {}) {
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
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'posty-tiptap-image',
      },
    }),
    FileHandler.configure({
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      onDrop: (_currentEditor, files) => {
        onFileDrop?.(files)
      },
      onPaste: (_currentEditor, files) => {
        onFileDrop?.(files)
      },
    }),
  ]
}
