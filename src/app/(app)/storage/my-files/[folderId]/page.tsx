import { redirect } from 'next/navigation';

export default async function StorageFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  redirect(`/storage?view=my-files&folder=${encodeURIComponent(folderId)}`);
}
