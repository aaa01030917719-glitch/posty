import { notFound } from 'next/navigation'
import { TiptapEditorPrototype } from '@/components/content/tiptap/TiptapEditorPrototype'

export default function TiptapPrototypePage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return <TiptapEditorPrototype />
}
