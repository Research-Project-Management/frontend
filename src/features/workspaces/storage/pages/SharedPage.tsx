'use client';

import { Share2 } from 'lucide-react';
import { useSharedFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { StoragePageTemplate } from '../components/layout/StoragePageTemplate';

export default function WorkspaceSharedPage() {
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete } = useDeleteItem();

  return (
    <StoragePageTemplate
      title="Shared"
      icon={Share2}
      useFilesHook={useSharedFiles}
      onToggleStar={handleToggleStar}
      onDelete={handleDelete}
    />
  );
}
