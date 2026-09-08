'use client';

import { useTrash, useRestoreItem, usePermanentlyDeleteItem } from '@/features/workspaces/projects/project-id/storage/hooks/use-storage';
import { Trash2 } from 'lucide-react';
import { filterTrashFiles } from '../utils/trash.util';
import { ProjectStorageCollectionPage } from '../components/layout/ProjectStorageCollectionPage';

export default function ProjectTrashPage() {
  const { mutateAsync: handleRestore } = useRestoreItem();
  const { mutateAsync: handlePermanentlyDelete } = usePermanentlyDeleteItem();

  return (
    <ProjectStorageCollectionPage
      title="Trash"
      icon={Trash2}
      useFilesHook={useTrash}
      filterFiles={filterTrashFiles}
      onRestore={(id) => handleRestore(id)}
      onDelete={(id) => handlePermanentlyDelete(id)}
      isTrash={true}
    />
  );
}
