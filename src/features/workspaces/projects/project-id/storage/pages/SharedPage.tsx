'use client';

import { useSharedFiles, useToggleStarItem, useDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';
import { Share2 } from 'lucide-react';
import { filterSharedFiles } from '../utils/shared.util';
import { ProjectStorageCollectionPage } from '../components/layout/ProjectStorageCollectionPage';

export default function SharedPage() {
  const { mutateAsync: handleToggleStar } = useToggleStarItem();
  const { mutateAsync: handleDelete } = useDeleteItem();

  return (
    <ProjectStorageCollectionPage
      title="Shared"
      icon={Share2}
      useFilesHook={useSharedFiles}
      filterFiles={filterSharedFiles}
      onToggleStar={(id) => handleToggleStar(id)}
      onDelete={(id) => handleDelete(id)}
    />
  );
}
