import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Folder · Storage' };

export default async function StorageFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  redirect(`/storage?view=my-files&folder=${encodeURIComponent(folderId)}`);
}
