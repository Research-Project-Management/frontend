'use client';

import { useSharedFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { Share2 } from 'lucide-react';
import { StorageCollectionPage } from '../components/layout/StorageCollectionPage';
import { filterSharedFiles } from '../utils/shared.util';

export default function WorkspaceSharedPage() {
  const { mutate: handleToggleStar } = useToggleStarItem();
  const { mutate: handleDelete } = useDeleteItem();

  return (
    <StorageCollectionPage
      title="Shared"
      icon={Share2}
      useDataHook={useSharedFiles}
      filterItems={filterSharedFiles}
      onToggleStar={(id) => handleToggleStar(id)}
      onDelete={(id) => handleDelete(id)}
    />
  );
}
