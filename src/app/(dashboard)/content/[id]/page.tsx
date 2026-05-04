import { ContentEditorShell } from '@/components/content/ContentEditorShell'

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <ContentEditorShell cardId={id} />
    </div>
  )
}
