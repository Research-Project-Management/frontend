'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  X,
  ExternalLink,
  Loader2,
  Search,
  Plus,
} from 'lucide-react';
import { useRelations, useViewItems, useCollections } from '../../data';
import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui';
import type { Item, RelatedItem } from '@/features/library/types/library.types';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

interface RelatedSectionProps {
  paper: Item;
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
  onSelectPaper?: (paperId: string) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  isAddOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
  canEdit?: boolean;
}

export default function RelatedSection({
  paper,
  scopeId,
  projectId,
  workspaceId,
  onSelectPaper,
  hideHeader = false,
  forceAdding = false,
  isAddOpen,
  onAddOpenChange,
  canEdit = true,
}: RelatedSectionProps) {
  const activeScopeId =
    scopeId ||
    projectId ||
    paper.projectId ||
    workspaceId ||
    'user';

  const { relatedItems, isLoading, link, unlink, isLinking } = useRelations(
    activeScopeId,
    paper.id || '',
  );
  const { data: allItemsRes } = useViewItems(activeScopeId, 'all');
  const collectionsState = useCollections(activeScopeId);
  const collections = collectionsState?.state?.collections || [];

  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const isModalOpen = isAddOpen !== undefined ? isAddOpen : internalAddOpen;
  const setModalOpen = onAddOpenChange || setInternalAddOpen;

  useEffect(() => {
    if (forceAdding && canEdit) {
      setModalOpen(true);
    }
  }, [forceAdding, canEdit, setModalOpen]);

  // Modal State
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const relatedList: RelatedItem[] = relatedItems;

  // Filter available items for linking (excluding current paper & already linked papers)
  const availableItems = useMemo(() => {
    const all = allItemsRes?.items || [];
    const linkedIdSet = new Set(relatedList.map((r) => r.id));

    return all.filter((targetItem: Item) => {
      if (!targetItem?.id || targetItem.id === paper.id) return false;
      if (linkedIdSet.has(targetItem.id)) return false;

      // Filter by Collection if selected
      if (selectedCollectionFilter && selectedCollectionFilter !== 'all') {
        const itemColIds = targetItem.collectionIds || [];
        const itemCols = targetItem.collections || [];
        const singleColId = targetItem.collectionId;

        const inColIds = itemColIds.includes(selectedCollectionFilter);
        const inColObjs = itemCols.some(
          (c) => c.id === selectedCollectionFilter,
        );
        const inSingle = singleColId === selectedCollectionFilter;

        if (!inColIds && !inColObjs && !inSingle) return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (targetItem.title || '').toLowerCase().includes(q);
        const authorMatch = (targetItem.authors || []).some((a: string) =>
          a.toLowerCase().includes(q),
        );
        const yearMatch = String(targetItem.year || '').includes(q);
        if (!titleMatch && !authorMatch && !yearMatch) return false;
      }

      return true;
    });
  }, [allItemsRes?.items, relatedList, paper.id, selectedCollectionFilter, searchQuery]);

  const handleToggleSelect = (id: string) => {
    setSelectedTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTargetIds.size === availableItems.length) {
      setSelectedTargetIds(new Set());
    } else {
      setSelectedTargetIds(new Set(availableItems.map((i) => i.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedTargetIds(new Set());
  };

  const handleLinkConfirm = async () => {
    if (selectedTargetIds.size === 0) return;
    const targets = Array.from(selectedTargetIds);

    try {
      await link({
        targetItemIds: targets,
        relationType: 'related',
      });

      setSelectedTargetIds(new Set());
      setSearchQuery('');
      setSelectedCollectionFilter('all');
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to link items');
      // Keep modal open and selection intact so user can retry
    }
  };

  const handleUnlink = async (targetItemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await unlink({ targetItemId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to unlink item');
    }
  };

  // Empty state when no related items exist
  if (!isLoading && relatedList.length === 0 && !isModalOpen) {
    return (
      <div className="py-2.5 px-3 text-center text-11 text-muted-foreground flex flex-col items-center justify-center gap-1.5 font-sans">
        <span>No related items.</span>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-6 text-11 text-foreground hover:bg-muted px-2 gap-1 cursor-pointer font-normal"
          >
            <Plus className="size-3 text-foreground" strokeWidth={1.5} />
            <span>Link paper</span>
          </Button>
        )}
      </div>
    );
  }

  const isAllSelected =
    availableItems.length > 0 && selectedTargetIds.size === availableItems.length;

  return (
    <div className="space-y-2 text-12 min-w-0">
      {/* Header bar (optional if embedded in inspector accordion) */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-12 font-medium text-foreground">
            Related
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Add related item"
              aria-label="Add related item"
            >
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-3 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-3.5 animate-spin shrink-0" strokeWidth={1.5} />
          <span className="text-11">Loading related items...</span>
        </div>
      )}

      {/* Relations list */}
      {!isLoading && relatedList.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-md overflow-hidden bg-transparent">
          {relatedList.map((item) => (
            <div
              key={item.id}
              className="px-2.5 py-1.5 hover:bg-muted flex items-center justify-between gap-2 group cursor-pointer transition-colors"
              onClick={() => onSelectPaper?.(item.id)}
              title={item.title || 'Untitled Item'}
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="size-4 shrink-0 flex items-center justify-center pt-0.5">
                  <FileText className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-normal text-foreground break-words leading-snug text-12 group-hover:underline">
                    {item.title || 'Untitled Item'}
                  </p>
                  {(item.authors?.length || item.year) && (
                    <p className="text-11 text-muted-foreground break-words leading-snug mt-0.5">
                      {[item.authors?.join(', '), item.year].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {item.doi && (
                  <a
                    href={`https://doi.org/${encodeURIComponent(item.doi)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="p-1 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors"
                    title={`Open DOI: ${item.doi}`}
                    aria-label="Open DOI"
                  >
                    <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.5} />
                  </a>
                )}

                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => handleUnlink(item.id, e)}
                    className="p-1 rounded-md text-foreground hover:bg-muted invisible group-hover:visible cursor-pointer transition-colors"
                    title="Unlink item"
                    aria-label="Unlink item"
                  >
                    <X className="size-3.5 shrink-0" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Related Item Dialog (Zotero Parity) */}
      <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[580px] bg-background text-foreground p-5 space-y-3.5 shadow-raised-200 border border-border rounded-lg">
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-13 font-semibold text-foreground">
              Add Related Items
            </DialogTitle>
            <DialogDescription className="text-11 text-muted-foreground break-words leading-snug">
              Select one or more items to relate with &ldquo;{paper.title || 'Current Reference'}&rdquo;
            </DialogDescription>
          </DialogHeader>

          {/* Controls Bar */}
          <div className="space-y-2 pt-0.5">
            {/* Filter row: Search + Collection */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              {/* Search Bar */}
              <div className="relative sm:col-span-8 flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none shrink-0" strokeWidth={1.5} />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, author, year..."
                  className="w-full pl-8 pr-2.5 text-12 bg-background text-foreground placeholder:text-muted-foreground rounded-md border-border h-8 shadow-none"
                />
              </div>

              {/* Collection Filter */}
              <div className="sm:col-span-4">
                <Select
                  value={selectedCollectionFilter}
                  onValueChange={setSelectedCollectionFilter}
                >
                  <SelectTrigger className="w-full h-8 text-12 rounded-md border-border bg-background text-foreground" title="Filter by collection">
                    <SelectValue placeholder="All Collections" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                    <SelectItem value="all" className="rounded-md text-12">
                      All Collections
                    </SelectItem>
                    {collections.map((col: any) => (
                      <SelectItem key={col.id} value={col.id} className="rounded-md text-12">
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selection status and batch actions */}
            <div className="flex items-center justify-between px-1 text-11 text-muted-foreground">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={availableItems.length === 0}
                  className="text-foreground cursor-pointer font-medium disabled:opacity-50"
                >
                  {isAllSelected ? 'Deselect All' : 'Select All'}
                </button>
                <span>•</span>
                <span>
                  {availableItems.length} available
                </span>
              </div>

              {selectedTargetIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">
                    {selectedTargetIds.size} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-foreground cursor-pointer underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Multi-select Items List */}
            <div className="max-h-[300px] min-h-[160px] overflow-y-auto space-y-0.5 border border-border rounded-md p-1 bg-background thin-scrollbar">
              {availableItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-1">
                  <FileText className="size-5 text-muted-foreground shrink-0 opacity-60" strokeWidth={1.5} />
                  <p className="text-12">No matching items available to relate</p>
                  <p className="text-11 text-muted-foreground">
                    {searchQuery ? 'Try changing your search terms or collection filter' : 'All available items are already linked'}
                  </p>
                </div>
              ) : (
                availableItems.map((targetItem: Item) => {
                  const isChecked = selectedTargetIds.has(targetItem.id);
                  const authorYear = [targetItem.authors?.join(', '), targetItem.year]
                    .filter(Boolean)
                    .join(' • ');

                  return (
                    <div
                      key={targetItem.id}
                      onClick={() => handleToggleSelect(targetItem.id)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded-md text-12 flex items-center gap-2.5 cursor-pointer transition-colors',
                        isChecked
                          ? 'bg-muted text-foreground'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {/* Checkbox */}
                      <Checkbox
                        checked={isChecked}
                        className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none"
                      />

                      {/* Item Icon */}
                      <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="font-normal break-words leading-snug text-12 text-foreground" title={targetItem.title || 'Untitled Reference'}>
                          {targetItem.title || 'Untitled Reference'}
                        </p>
                        {authorYear && (
                          <p className="text-11 text-muted-foreground break-words leading-snug">
                            {authorYear}
                          </p>
                        )}
                      </div>

                      {/* Year pill */}
                      {targetItem.year && (
                        <span className="text-11 text-muted-foreground shrink-0 font-mono">
                          {targetItem.year}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Dialog Footer Actions */}
            <div className="pt-2 flex justify-between items-center gap-2 border-t border-border">
              <span className="text-11 text-muted-foreground">
                {selectedTargetIds.size > 0
                  ? `${selectedTargetIds.size} item(s) will be linked bidirectionally`
                  : 'Select items from above to link'}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-12 text-muted-foreground hover:bg-muted cursor-pointer rounded-md"
                  onClick={() => {
                    setModalOpen(false);
                    setSelectedTargetIds(new Set());
                    setSearchQuery('');
                    setSelectedCollectionFilter('all');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  disabled={selectedTargetIds.size === 0 || isLinking}
                  onClick={handleLinkConfirm}
                  className="h-8 px-4 text-12 cursor-pointer font-medium rounded-md flex items-center gap-1.5"
                >
                  {isLinking && <Loader2 className="size-3.5 animate-spin shrink-0" strokeWidth={1.5} />}
                  <span>
                    {isLinking
                      ? 'Linking...'
                      : selectedTargetIds.size > 1
                      ? `Link (${selectedTargetIds.size}) Items`
                      : 'Link Item'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}




