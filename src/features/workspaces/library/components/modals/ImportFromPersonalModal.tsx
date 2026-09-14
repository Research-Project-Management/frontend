'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Loader2,
  BookOpen,
  Folder,
  FolderOpen,
  FileText,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';
import { Checkbox } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useViewItems } from '../../hooks/use-items';
import { useCollections } from '../../hooks/use-collections';
import { ItemService } from '../../services/item.service';
import { formatCreatorCompact, normalizeAuthors } from '../../utils/library.util';
import type { Item, Collection } from '../../types/library.types';

interface ImportFromPersonalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  existingTitles?: string[];
  onSuccess?: () => void;
}

export default function ImportFromPersonalModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  existingTitles = [],
  onSuccess,
}: ImportFromPersonalModalProps) {
  const [search, setSearch] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('all'); // 'all' | 'unfiled' | collectionId
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // 1. Query personal collections
  const { state: collectionsState } = useCollections('user');
  const personalCollections: Collection[] = collectionsState.collections || [];

  // 2. Query all personal items
  const { data, isLoading } = useViewItems('user', 'all');
  const personalItems: Item[] = useMemo(() => data?.items ?? [], [data?.items]);

  // Normalized existing titles set for O(1) duplicate detection
  const existingSet = useMemo(() => {
    return new Set(existingTitles.map((t) => t.toLowerCase().trim()));
  }, [existingTitles]);

  // Calculate item counts for each scope
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: personalItems.length,
      unfiled: 0,
    };
    for (const it of personalItems) {
      if (!it.collectionId) {
        counts.unfiled = (counts.unfiled || 0) + 1;
      } else {
        counts[it.collectionId] = (counts[it.collectionId] || 0) + 1;
      }
    }
    return counts;
  }, [personalItems]);

  // Filter items based on selected scope and search query
  const filteredItems = useMemo(() => {
    let list = personalItems;

    // Filter by collection scope
    if (selectedScope === 'unfiled') {
      list = list.filter((it) => !it.collectionId);
    } else if (selectedScope !== 'all') {
      list = list.filter((it) => it.collectionId === selectedScope);
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((it) => {
        const titleMatch = it.title?.toLowerCase().includes(q);
        const authorMatch = it.authors?.some((a: any) => {
          if (typeof a === 'string') return a.toLowerCase().includes(q);
          return `${a?.firstName || ''} ${a?.lastName || ''}`.toLowerCase().includes(q);
        });
        const yearMatch = it.year?.toString().includes(q);
        const doiMatch = it.doi?.toLowerCase().includes(q);
        return titleMatch || Boolean(authorMatch) || yearMatch || doiMatch;
      });
    }

    return list;
  }, [personalItems, selectedScope, search]);

  // Filter items eligible for selection (not already in the project)
  const selectableItems = useMemo(() => {
    return filteredItems.filter((it) => {
      const titleLower = (it.title || '').toLowerCase().trim();
      return !existingSet.has(titleLower);
    });
  }, [filteredItems, existingSet]);

  const isAllSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((it) => selectedIds.includes(it.id));

  const toggleSelectAll = () => {
    if (isAllSelectableSelected) {
      const viewIds = new Set(selectableItems.map((it) => it.id));
      setSelectedIds((prev) => prev.filter((id) => !viewIds.has(id)));
    } else {
      const viewIds = selectableItems.map((it) => it.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...viewIds])));
    }
  };

  const toggleSelect = (id: string, isAlreadyInProject: boolean) => {
    if (isAlreadyInProject) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    if (!selectedIds.length || !projectId) return;
    setIsImporting(true);
    try {
      const res = await ItemService.importFromPersonal(projectId, selectedIds);
      toast.success(
        `Imported ${res.importedCount ?? selectedIds.length} reference(s) into ${projectName}`
      );
      setSelectedIds([]);
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to import references');
    } finally {
      setIsImporting(false);
    }
  };

  // Helper to map collection ID to collection name
  const getCollectionName = (colId?: string | null) => {
    if (!colId) return null;
    const found = personalCollections.find((c) => c.id === colId);
    return found?.name || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[620px] flex flex-col p-0 gap-0 overflow-hidden border border-border bg-background shadow-none rounded-lg font-sans select-none">
        {/* Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-border flex flex-row items-center justify-between shrink-0 bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                Import from My Library
              </DialogTitle>
            </div>
            <p className="text-12 text-muted-foreground mt-0.5">
              Select references from your personal library to collaborate on in{' '}
              <span className="font-semibold text-foreground">{projectName}</span>.
            </p>
          </div>
        </DialogHeader>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column: My Library Collections Tree */}
          <aside className="w-60 shrink-0 border-r border-border bg-muted/15 flex flex-col overflow-hidden">
            <div className="px-3 py-2 text-11 font-medium text-muted-foreground tracking-tight border-b border-border/40 select-none">
              Personal Collections
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 thin-scrollbar">
              {/* All Items */}
              <button
                type="button"
                onClick={() => setSelectedScope('all')}
                className={cn(
                  "w-full h-8 px-2.5 flex items-center justify-between rounded-md text-12 transition-colors text-left cursor-pointer",
                  selectedScope === 'all'
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-normal"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">All References</span>
                </div>
                <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0">
                  {collectionCounts.all}
                </span>
              </button>

              {/* Collections List */}
              {personalCollections.map((col) => {
                const isSelected = selectedScope === col.id;
                const count = collectionCounts[col.id] || 0;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedScope(col.id)}
                    className={cn(
                      "w-full h-8 px-2.5 flex items-center justify-between rounded-md text-12 transition-colors text-left cursor-pointer",
                      isSelected
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-normal"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isSelected ? (
                        <FolderOpen className="size-3.5 shrink-0" strokeWidth={1.5} />
                      ) : (
                        <Folder className="size-3.5 shrink-0" strokeWidth={1.5} />
                      )}
                      <span className="truncate">{col.name}</span>
                    </div>
                    <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0">
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* Unfiled */}
              {collectionCounts.unfiled > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedScope('unfiled')}
                  className={cn(
                    "w-full h-8 px-2.5 flex items-center justify-between rounded-md text-12 transition-colors text-left cursor-pointer",
                    selectedScope === 'unfiled'
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-normal"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span className="truncate">Unfiled Items</span>
                  </div>
                  <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0">
                    {collectionCounts.unfiled}
                  </span>
                </button>
              )}
            </div>
          </aside>

          {/* Right Column: References List with Search & Actions */}
          <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {/* Search Bar & Select All Action */}
            <div className="p-3 border-b border-border bg-background flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search references by title, author, year, DOI..."
                  className="h-8 pl-8 pr-7 text-12 rounded-md bg-background focus-visible:ring-1"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {selectableItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-8 text-12 font-normal whitespace-nowrap cursor-pointer hover:bg-muted"
                >
                  {isAllSelectableSelected ? 'Deselect All' : `Select All (${selectableItems.length})`}
                </Button>
              )}
            </div>

            {/* References Table / List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60 thin-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mb-2" />
                  <span className="text-12 font-medium">Loading personal library...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground px-4">
                  <BookOpen className="size-6 mb-2 opacity-60" />
                  <p className="text-12 font-medium text-foreground">No references found</p>
                  <p className="text-11 text-muted-foreground mt-0.5 max-w-xs">
                    {search.trim()
                      ? 'No items match your search filter.'
                      : 'There are no references in this collection.'}
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const titleLower = (item.title || '').toLowerCase().trim();
                  const isAlreadyInProject = existingSet.has(titleLower);
                  const authorText = formatCreatorCompact(normalizeAuthors(item));
                  const colName = getCollectionName(item.collectionId);

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item.id, isAlreadyInProject)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-2.5 transition-colors select-none",
                        isAlreadyInProject
                          ? "opacity-50 cursor-not-allowed bg-muted/10"
                          : isSelected
                            ? "bg-muted/60 cursor-pointer"
                            : "hover:bg-muted/30 cursor-pointer"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isAlreadyInProject}
                        onCheckedChange={() => toggleSelect(item.id, isAlreadyInProject)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-12 font-medium text-foreground truncate leading-tight flex-1">
                            {item.title || 'Untitled Reference'}
                          </p>
                          {isAlreadyInProject && (
                            <span className="text-10 font-mono text-muted-foreground bg-muted border border-border px-1.5 py-0.2 rounded-sm shrink-0">
                              Already in project
                            </span>
                          )}
                          {colName && (
                            <span className="text-10 font-mono text-muted-foreground bg-muted/50 border border-border/60 px-1.5 py-0.2 rounded-sm shrink-0 truncate max-w-[120px]">
                              {colName}
                            </span>
                          )}
                        </div>

                        <p className="text-11 text-muted-foreground truncate mt-0.5">
                          {authorText ? `${authorText} ` : ''}
                          {item.year ? `(${item.year})` : ''}
                          {item.publicationTitle ? ` — ${item.publicationTitle}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
          <span className="text-11 text-muted-foreground font-mono">
            {selectedIds.length} reference(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-12 font-normal cursor-pointer hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={selectedIds.length === 0 || isImporting}
              className="h-8 text-12 font-normal gap-1.5 cursor-pointer"
            >
              {isImporting && <Loader2 className="size-3.5 animate-spin" />}
              <span>Import to Project ({selectedIds.length})</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
