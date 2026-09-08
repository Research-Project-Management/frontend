'use client';

import { useStarredFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { Star } from 'lucide-react';
import { StorageCollectionPage } from '../components/layout/StorageCollectionPage';
import { filterStarredFiles } from '../utils/starred.util';

export default function WorkspaceStarredPage() {
  const { mutate: handleToggleStar } = useToggleStarItem();
  const { mutate: handleDelete } = useDeleteItem();

  return (
    <StorageCollectionPage
      title="Starred"
      icon={Star}
      useDataHook={useStarredFiles}
      filterItems={filterStarredFiles}
      onToggleStar={(id) => handleToggleStar(id)}
      onDelete={(id) => handleDelete(id)}
    />
  );
}
