'use client';

import { useTrash, useRestoreItem, usePermanentlyDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { Trash2 } from 'lucide-react';
import { StorageCollectionPage } from '../components/layout/StorageCollectionPage';
import { filterTrashFiles } from '../utils/trash.util';

export default function WorkspaceTrashPage() {
  const { mutate: handleRestore } = useRestoreItem();
  const { mutate: handlePermanentlyDelete } = usePermanentlyDeleteItem();

  return (
    <StorageCollectionPage
      title="Trash"
      icon={Trash2}
      useDataHook={useTrash}
      filterItems={filterTrashFiles}
      onRestore={(id) => handleRestore(id)}
      onDelete={(id) => handlePermanentlyDelete(id)}
      isTrash={true}
    />
  );
}
