'use client';

import { Star } from 'lucide-react';
import { useStarredFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { StoragePageTemplate } from '../components/layout/StoragePageTemplate';

export default function WorkspaceStarredPage() {
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete } = useDeleteItem();

  return (
    <StoragePageTemplate
      title="Starred"
      icon={Star}
      useFilesHook={useStarredFiles}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
    />
  );
}
