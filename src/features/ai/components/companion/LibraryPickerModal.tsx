'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Search,
  FileText,
  Loader2,
  Folder,
  Layers,
  X,
  Check,
} from 'lucide-react';
import {
  ItemsService,
  CollectionsService,
  isProjectScope,
  type Item,
  type Collection,
} from '@/features/library';
import { LibraryEmptyState } from '@/features/library/components/content/LibraryEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { buildTree } from '@/features/library/components/sidebar/tree-helpers';
import type { TreeNode } from '@/features/library/components/sidebar/sidebar.types';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

interface LibraryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  onSelectItem?: (item: { id: string; name: string; size: number }) => void;
  onSelectItems?: (items: Array<{ id: string; name: string; size: number }>) => void;
}

export function LibraryPickerModal({
  isOpen,
  onClose,
  projectId,
  onSelectItem,
  onSelectItems,
}: LibraryPickerModalProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<string, Item>>(new Map());

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedItems(new Map());
      setSearch('');
      setSelectedCollectionId(null);
      setError(null);
      setCollectionsError(null);
    }
  }, [isOpen]);

  // Load collections
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setCollectionsLoading(true);
    setCollectionsError(null);

    const targetScope = projectId && isProjectScope(projectId) ? projectId : 'user';

    CollectionsService.getAll(targetScope)
      .then((res: any) => {
        if (!isMounted) return;
        const list =
          res?.collections ||
          res?.data?.collections ||
          (Array.isArray(res?.data) ? res.data : null) ||
          (Array.isArray(res) ? res : []);
        setCollections(list);
        setCollectionsError(null);
      })
      .catch((err: any) => {
        console.error('[LibraryPickerModal] Failed to load collections:', err);
        if (isMounted) setCollectionsError(err?.message || 'Failed to load collections');
      })
      .finally(() => {
        if (isMounted) setCollectionsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId]);

  // Load library items
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const targetScope = projectId && isProjectScope(projectId) ? projectId : 'user';
      const res = await ItemsService.getAll(targetScope, {
        search: search.trim() || undefined,
        collectionId: selectedCollectionId || undefined,
        limit: 100,
      });
      const list = res?.items || (res as any)?.data || (res as any)?.papers || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (err: any) {
      console.error('[LibraryPickerModal] Failed to load items:', err);
      setError(err?.message || 'Failed to load library papers');
    } finally {
      setLoading(false);
    }
  }, [projectId, search, selectedCollectionId]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  const collectionTree = useMemo(() => {
    return buildTree(collections);
  }, [collections]);

  const selectedCollectionName = useMemo(() => {
    if (!selectedCollectionId) return undefined;
    const findInTree = (nodes: TreeNode[]): string | undefined => {
      for (const node of nodes) {
        if (node.id === selectedCollectionId) return node.name;
        if (node.children) {
          const res = findInTree(node.children);
          if (res) return res;
        }
      }
      return undefined;
    };
    return findInTree(collectionTree) || collections.find((c) => c.id === selectedCollectionId)?.name;
  }, [collectionTree, collections, selectedCollectionId]);

  const toggleSelect = (item: Item) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item);
      }
      return next;
    });
  };

  // Immediate attach on double-click
  const handleDoubleClick = (item: Item) => {
    const payload = {
      id: item.id,
      name: item.title || 'Untitled Document',
      size: item.primaryFile?.size || item.size || 0,
    };
    onSelectItem?.(payload);
    onSelectItems?.([payload]);
    toast.success(`Attached "${payload.name}" to chat`);
    onClose();
  };

  // Batch confirm
  const handleConfirm = () => {
    if (selectedItems.size === 0) return;
    const list = Array.from(selectedItems.values()).map((item) => ({
      id: item.id,
      name: item.title || 'Untitled Document',
      size: item.primaryFile?.size || item.size || 0,
    }));

    if (onSelectItems) {
      onSelectItems(list);
    } else if (onSelectItem) {
      list.forEach((item) => onSelectItem(item));
    }

    toast.success(`Attached ${list.length} ${list.length === 1 ? 'paper' : 'papers'} to chat`);
    onClose();
  };

  const renderCollectionNode = (node: TreeNode, depth = 0) => {
    const isSelected = selectedCollectionId === node.id;
    const count = node.itemCount ?? node.paperCount;

    return (
      <React.Fragment key={node.id}>
        <button
          type="button"
          onClick={() => setSelectedCollectionId(node.id || null)}
          className={cn(
            'w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors',
            isSelected
              ? 'bg-muted text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          title={node.name}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Folder className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="truncate">{node.name}</span>
          </div>
          {typeof count === 'number' && count > 0 && (
            <span className="text-10 text-muted-foreground tabular-nums shrink-0 font-mono">
              {count}
            </span>
          )}
        </button>

        {node.children && node.children.length > 0 && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderCollectionNode(child, depth + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] h-[600px] flex flex-col p-0 overflow-hidden rounded-lg bg-background border border-border shadow-raised-400">
        {/* ── Header: Title only, no icon and no subtitle as instructed ── */}
        <DialogHeader className="px-5 py-3.5 border-b border-border flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground">
            Import from Library
          </DialogTitle>
        </DialogHeader>

        {/* ── Search Bar: Not full-width, no select all button ── */}
        <div className="px-4 py-2 border-b border-border flex items-center shrink-0">
          <div className="relative w-64 sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search papers..."
              className="w-full h-8 pl-8 pr-7 text-13 rounded-md border border-border bg-background hover:border-foreground/30 focus:border-border focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground outline-none transition-colors"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* ── Main Body: Sidebar + List ── */}
        <div className="flex-1 flex min-h-0">
          {/* Left Sidebar: Collections only (no types section) */}
          <div className="w-48 sm:w-52 border-r border-border p-2 overflow-y-auto space-y-1 shrink-0 select-none">
            <p className="px-2 pb-1.5 text-11 font-medium text-muted-foreground">
              Collections
            </p>

            <button
              type="button"
              onClick={() => setSelectedCollectionId(null)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors',
                selectedCollectionId === null
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="truncate">All Papers</span>
              </div>
            </button>

            {collectionsLoading ? (
              <div className="px-2 py-2 flex items-center gap-1.5 text-11 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : collectionsError ? (
              <div className="px-2 py-2 text-11 text-muted-foreground/60 italic">
                Failed to load collections
              </div>
            ) : collectionTree.length === 0 ? (
              <div className="px-2 py-2 text-11 text-muted-foreground/60 italic">
                No collections
              </div>
            ) : (
              <div className="space-y-0.5 pt-0.5">
                {collectionTree.map((node) => renderCollectionNode(node, 0))}
              </div>
            )}
          </div>

          {/* Right Main Content: Paper List (Only title, separated by lines not touching borders) */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-2">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-foreground">
                <Loader2 className="size-5 animate-spin text-muted-foreground mb-2" />
                <span className="text-12 text-muted-foreground">Loading library papers...</span>
              </div>
            ) : error ? (
              <PlaneErrorState
                title="Failed to load papers"
                description={error}
                className="min-h-0 py-8 px-4"
              />
            ) : items.length === 0 ? (
              <LibraryEmptyState
                search={search}
                collectionId={selectedCollectionId || undefined}
                collectionName={selectedCollectionName}
                canEdit={false}
                className="min-h-0 py-8 px-4"
              />
            ) : (
              <div className="space-y-0.5">
                {items.map((item, idx) => {
                  const isSelected = selectedItems.has(item.id);

                  return (
                    <React.Fragment key={item.id}>
                      <div
                        onClick={() => toggleSelect(item)}
                        onDoubleClick={() => handleDoubleClick(item)}
                        className={cn(
                          'group relative flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors cursor-pointer select-none',
                          isSelected
                            ? 'bg-primary/[0.06] text-primary'
                            : 'hover:bg-muted/60 text-foreground'
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={cn(
                            'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background group-hover:border-foreground/40'
                          )}
                        >
                          {isSelected && <Check className="size-3 stroke-[2.5]" />}
                        </div>

                        {/* Title only */}
                        <span
                          className={cn(
                            'text-13 truncate flex-1 leading-normal',
                            isSelected ? 'font-medium text-primary' : 'font-normal text-foreground'
                          )}
                          title={item.title || 'Untitled Document'}
                        >
                          {item.title || 'Untitled Document'}
                        </span>
                      </div>

                      {/* Separator line not touching borders */}
                      {idx < items.length - 1 && (
                        <div className="h-px bg-border/40 mx-3 my-0.5" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: Actions only, zero quantity numbers ── */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0 select-none">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={selectedItems.size === 0}
            className="h-8 px-3.5 text-12 font-medium rounded-md cursor-pointer shadow-none"
          >
            Attach
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
