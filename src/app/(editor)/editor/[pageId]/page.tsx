import { redirect } from 'next/navigation';

export default async function LegacyEditorRedirectPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  redirect(`/pages/${encodeURIComponent(pageId)}`);
}
