import { useState } from 'react';
import { toast } from 'sonner';
import { CollectionService, useCollections } from '../../data';
import type { MoveToTrashTarget } from '../modals/TrashModal';
import type { Collection, CollectionInput } from '../../types/library.types';

interface UseCollectionActionsParams {
  collectionService: ReturnType<typeof useCollections>;
  effectiveScopeId: string;
  collections: Collection[];
}

export function useCollectionActions({
  collectionService,
  effectiveScopeId,
  collections,
}: UseCollectionActionsParams) {
  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [trashTarget, setTrashTarget] = useState<MoveToTrashTarget | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Inline rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = (data: CollectionInput) => {
    const rawParent = data.parentId ?? data.parent ?? createParentId ?? null;
    const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
    collectionService.actions.create(
      {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
        parent: cleanParentId,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setCreateParentId(null);
        },
      },
    );
  };

  const openCreateSub = (parentId: string, _parentName?: string) => {
    setCreateParentId(parentId);
    setCreateOpen(true);
  };

  const openCreateRoot = () => {
    setCreateParentId(null);
    setCreateOpen(true);
  };

  const startRename = (collectionId: string, name: string) => {
    setRenamingId(collectionId);
    setRenameValue(name);
  };

  const submitRename = (collectionId: string) => {
    if (collectionId !== '__cancel__') {
      const trimmed = renameValue.trim();
      if (trimmed) collectionService.actions.update({ collectionId, name: trimmed });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDelete = (collectionId: string) => {
    const target = collections.find((c) => c.id === collectionId);
    setTrashTarget({
      type: 'collection',
      id: collectionId,
      title: target?.name || 'Untitled Collection',
    });
    setIsTrashOpen(true);
  };

  const handleDeleteWithItems = (collectionId: string) => {
    const target = collections.find((c) => c.id === collectionId);
    setTrashTarget({
      type: 'collection',
      id: collectionId,
      title: target?.name || 'Untitled Collection',
    });
    setIsTrashOpen(true);
  };

  const handleConfirmTrash = () => {
    if (!trashTarget?.id) return;
    collectionService.actions.delete(trashTarget.id);
  };

  const handleMove = (collectionId: string, newParentId: string | null) => {
    collectionService.actions.update({ collectionId, parent: newParentId });
  };

  const handleCopy = (collectionId: string, targetParentId: string | null) => {
    const target = collections.find((c) => c.id === collectionId);
    if (!target) return;
    collectionService.actions.create({
      name: `${target.name} (Copy)`,
      description: target.description,
      color: target.color,
      icon: target.icon,
      parent: targetParentId,
    });
  };

  const handleExportBibtex = async (collectionId: string, name: string) => {
    const toastId = toast.loading(`Exporting BibTeX for "${name}"...`, { id: 'collection-export' });
    try {
      const res = await CollectionService.exportBibtex(effectiveScopeId, collectionId);
      const bibtex = res?.bibtex;
      if (!bibtex) {
        toast.warning('No citations found in this collection.', { id: toastId });
        return;
      }
      const filename = res?.filename || `${name.toLowerCase().replace(/\s+/g, '_')}.bib`;
      const blob = new Blob([bibtex], { type: 'application/x-bibtex;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const count = res?.total;
      toast.success(count ? `Exported ${count} items to ${filename}` : `Exported to ${filename}`, { id: toastId });
    } catch (err: any) {
      toast.error('Failed to export BibTeX', { description: err?.message, id: toastId });
    }
  };

  const handleExportBundle = async (collectionId: string, name: string) => {
    const toastId = toast.loading(`Preparing bundle for "${name}"...`, { id: 'bundle-export' });
    try {
      const data = await CollectionService.exportBundle(effectiveScopeId, collectionId);
      if (!data) {
        toast.error('Failed to export bundle', { id: toastId });
        return;
      }
      const filename = `${name.toLowerCase().replace(/\s+/g, '_')}_bundle.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported bundle with ${data?.totalPapers ?? 0} items and ${data?.totalFiles ?? 0} files`, { id: toastId });
    } catch (err: any) {
      toast.error('Failed to export bundle', { description: err?.message, id: toastId });
    }
  };

  return {
    modals: {
      createOpen,
      setCreateOpen,
      createParentId,
      setCreateParentId,
      trashTarget,
      isTrashOpen,
      setIsTrashOpen,
    },
    rename: {
      renamingId,
      renameValue,
      setRenameValue,
    },
    handlers: {
      handleCreate,
      openCreateSub,
      openCreateRoot,
      startRename,
      submitRename,
      handleDelete,
      handleDeleteWithItems,
      handleConfirmTrash,
      handleMove,
      handleCopy,
      handleExportBibtex,
      handleExportBundle,
    },
  };
}
