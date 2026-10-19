import { redirect } from 'next/navigation';

export default async function DraftEditorRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string; draftId: string }>;
}) {
  const { projectId, draftId } = await params;
  redirect(`/projects/${projectId}/pages/${draftId}`);
}
