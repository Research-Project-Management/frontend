'use client';

import { Trash2 } from 'lucide-react';
import { useTrash, useRestoreItem, usePermanentlyDeleteItem } from '@/features/workspaces/storage/hooks/use-storage';
import { StoragePageTemplate } from '../components/layout/StoragePageTemplate';

export default function WorkspaceTrashPage() {
  const { mutateAsync: handleRestore } = useRestoreItem();
  const { mutateAsync: handlePermanentlyDelete } = usePermanentlyDeleteItem();

  return (
    <StoragePageTemplate
      title="Trash"
      icon={Trash2}
      useFilesHook={useTrash}
      onRestore={handleRestore}
      onDelete={handlePermanentlyDelete}
      isTrash={true}
    />
  );
}
