'use client';

import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { useLibraryViewStore, useLibraryModalStore } from '../../store';

export function TopbarBulkBar() {
  const selectedIds = useLibraryViewStore((s) => s.selectedIds);
  const clearSelection = useLibraryViewStore((s) => s.clearSelection);
  const openModal = useLibraryModalStore((s) => s.openModal);

  if (selectedIds.size === 0) return null;

  const count = selectedIds.size;

  const handleDelete = () => {
    openModal('DELETE_ITEMS', {
      itemIds: Array.from(selectedIds),
    });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs animate-in fade-in slide-in-from-top-1 duration-150">
      <span className="font-medium text-foreground">
        {count} {count === 1 ? 'item' : 'items'} selected
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={clearSelection}
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3 mr-1" />
        Deselect
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        className="h-6 px-2 text-xs"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Delete
      </Button>
    </div>
  );
}
