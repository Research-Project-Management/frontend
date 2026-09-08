'use client';

import { useStarredFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';
import { Star } from 'lucide-react';
import { filterStarredFiles } from '../utils/starred.util';
import { ProjectStorageCollectionPage } from '../components/layout/ProjectStorageCollectionPage';

export default function StarredPage() {
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete } = useDeleteItem();

  return (
    <ProjectStorageCollectionPage
      title="Starred"
      icon={Star}
      useFilesHook={useStarredFiles}
      filterFiles={filterStarredFiles}
      onToggleStar={(id) => handleToggleStar(id)}
      onDelete={(id) => handleDelete(id)}
    />
  );
}
