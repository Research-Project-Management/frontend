'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  X,
  ExternalLink,
  Loader2,
  Search,
  Check,
} from 'lucide-react';
import { useRelations } from '@/features/library/hooks/use-relations';
import { useViewItems } from '@/features/library/hooks/use-items';
import { useCollections } from '@/features/library/hooks/use-collections';
import { Button } from '@/shared/components/ui';
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

const RELATION_TYPE_OPTIONS = [
  { value: 'related', label: 'Related Work' },
  { value: 'cites', label: 'Cites' },
  { value: 'cited_by', label: 'Cited By' },
  { value: 'is_preprint_of', label: 'Preprint Of' },
  { value: 'is_published_version_of', label: 'Published Version Of' },
  { value: 'extends', label: 'Extends' },
  { value: 'replicates', label: 'Replicates' },
  { value: 'supplements', label: 'Supplements' },
  { value: 'uses_dataset', label: 'Uses Dataset' },
  { value: 'rebuts', label: 'Rebuts' },
  { value: 'survey_of', label: 'Survey Of' },
];

const RELATION_TYPE_LABELS: Record<string, string> = {
  related: 'Related',
  cites: 'Cites',
  cited_by: 'Cited by',
  is_preprint_of: 'Preprint of',
  is_published_version_of: 'Published as',
  extends: 'Extends',
  replicates: 'Replicates',
  supplements: 'Supplements',
  uses_dataset: 'Uses dataset',
  rebuts: 'Rebuts',
  survey_of: 'Survey of',
};

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
    (paper as any)?.projectId ||
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
  const [selectedRelationType, setSelectedRelationType] = useState<string>('related');
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
        const itemColIds: string[] = (targetItem as any).collectionIds || [];
        const itemCols: any[] = (targetItem as any).collections || [];
        const singleColId = (targetItem as any).collectionId;

        const inColIds = itemColIds.includes(selectedCollectionFilter);
        const inColObjs = itemCols.some(
          (c) => c.collectionId === selectedCollectionFilter || c.id === selectedCollectionFilter,
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
        relationType: selectedRelationType,
      });

      setSelectedTargetIds(new Set());
      setSelectedRelationType('related');
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

  // If there are no items and modal is closed, show nothing (clean zero empty state)
  if (!isLoading && relatedList.length === 0 && !isModalOpen) {
    return null;
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
        <div className="divide-y divide-border/40 border border-border rounded-md overflow-hidden bg-transparent">
          {relatedList.map((item) => {
            const hasSemanticBadge =
              item.relationType && item.relationType !== 'related';
            const badgeLabel =
              RELATION_TYPE_LABELS[item.relationType] || item.relationType;

            return (
              <div
                key={item.id}
                className="px-2.5 py-1.5 hover:bg-muted/60 flex items-center justify-between gap-2 group cursor-pointer transition-colors"
                onClick={() => onSelectPaper?.(item.id)}
                title={item.title || 'Untitled Item'}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="size-4 shrink-0 flex items-center justify-center pt-0.5">
                    <FileText className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-normal text-foreground truncate text-12 group-hover:underline">
                      {item.title || 'Untitled Item'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {(item.authors?.length || item.year) && (
                        <span className="text-11 text-muted-foreground truncate">
                          {[item.authors?.join(', '), item.year].filter(Boolean).join(' • ')}
                        </span>
                      )}
                      {hasSemanticBadge && (
                        <span className="text-10 font-medium px-1.5 py-0.2 rounded border border-border bg-muted/60 text-muted-foreground shrink-0 leading-tight">
                          {badgeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {item.doi && (
                    <a
                      href={`https://doi.org/${encodeURIComponent(item.doi)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
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
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted invisible group-hover:visible cursor-pointer transition-colors"
                      title="Unlink item"
                      aria-label="Unlink item"
                    >
                      <X className="size-3.5 shrink-0" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Related Item Dialog (Zotero Parity) */}
      <Dialog open={isModalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[580px] bg-background text-foreground p-5 space-y-3.5 shadow-raised-200 border border-border rounded-lg">
          <DialogHeader className="p-0 space-y-1">
            <DialogTitle className="text-13 font-semibold text-foreground">
              Add Related Items
            </DialogTitle>
            <DialogDescription className="text-11 text-muted-foreground truncate">
              Select one or more items to relate with &ldquo;{paper.title || 'Current Reference'}&rdquo;
            </DialogDescription>
          </DialogHeader>

          {/* Controls Bar */}
          <div className="space-y-2 pt-0.5">
            {/* Filter row: Search + Collection + Relation Type */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              {/* Search Bar */}
              <div className="relative sm:col-span-6 flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none shrink-0" strokeWidth={1.5} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, author, year..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-12 bg-background text-foreground placeholder:text-muted-foreground rounded-md border border-border focus:border-border outline-none transition-colors h-8"
                />
              </div>

              {/* Collection Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedCollectionFilter}
                  onChange={(e) => setSelectedCollectionFilter(e.target.value)}
                  className="w-full px-2 py-1 text-12 bg-background text-foreground rounded-md border border-border focus:border-border outline-none cursor-pointer h-8 truncate"
                  title="Filter by collection"
                >
                  <option value="all">All Collections</option>
                  {collections.map((col: any) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Relation Type Selector */}
              <div className="sm:col-span-3">
                <select
                  value={selectedRelationType}
                  onChange={(e) => setSelectedRelationType(e.target.value)}
                  className="w-full px-2 py-1 text-12 bg-background text-foreground rounded-md border border-border focus:border-border outline-none cursor-pointer h-8 truncate"
                  title="Relationship type"
                >
                  {RELATION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selection status and batch actions */}
            <div className="flex items-center justify-between px-1 text-11 text-muted-foreground">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={availableItems.length === 0}
                  className="hover:text-foreground cursor-pointer font-medium disabled:opacity-50"
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
                    className="hover:text-foreground cursor-pointer underline text-muted-foreground"
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
                          : 'text-foreground hover:bg-muted/50',
                      )}
                    >
                      {/* Checkbox */}
                      <div
                        className={cn(
                          'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                          isChecked
                            ? 'bg-foreground border-foreground text-background'
                            : 'border-border bg-background',
                        )}
                      >
                        {isChecked && <Check className="size-3 stroke-[2.5]" />}
                      </div>

                      {/* Item Icon */}
                      <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="font-normal truncate text-12 text-foreground" title={targetItem.title || 'Untitled Reference'}>
                          {targetItem.title || 'Untitled Reference'}
                        </p>
                        {authorYear && (
                          <p className="text-11 text-muted-foreground truncate">
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




