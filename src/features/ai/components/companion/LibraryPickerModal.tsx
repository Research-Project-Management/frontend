'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Search,
  BookOpen,
  FileText,
  Loader2,
  Folder,
  Layers,
  X,
  Check,
  Calendar,
  User,
} from 'lucide-react';
import { ItemsService, CollectionsService, type Item, type Collection } from '@/features/library';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

interface LibraryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  onSelectItem?: (item: { id: string; name: string; size: number }) => void;
  onSelectItems?: (items: Array<{ id: string; name: string; size: number }>) => void;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  journalArticle: 'Journal Article',
  conferencePaper: 'Conference',
  book: 'Book',
  bookSection: 'Book Section',
  preprint: 'Preprint',
  thesis: 'Thesis',
  report: 'Report',
  document: 'Document',
};

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
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<string, Item>>(new Map());

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedItems(new Map());
      setSearch('');
      setSelectedCollectionId(null);
      setSelectedType(null);
    }
  }, [isOpen]);

  // Load collections
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setCollectionsLoading(true);
    CollectionsService.getAll(projectId || undefined)
      .then((res) => {
        if (!isMounted) return;
        const list = res?.collections || (Array.isArray(res) ? res : []);
        setCollections(list);
      })
      .catch((err) => {
        console.error('[LibraryPickerModal] Failed to load collections:', err);
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
      const res = await ItemsService.getAll(projectId || undefined, {
        search: search.trim() || undefined,
        collectionId: selectedCollectionId || undefined,
        itemType: selectedType || undefined,
        limit: 100,
      });
      const list = res?.items || (res as any)?.data || (res as any)?.papers || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (err) {
      console.error('[LibraryPickerModal] Failed to load items:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, search, selectedCollectionId, selectedType]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

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

  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Map());
    } else {
      const next = new Map<string, Item>();
      items.forEach((item) => next.set(item.id, item));
      setSelectedItems(next);
    }
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
    toast.success(`Attached "${item.title || 'Document'}" to chat`);
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

  const activeCollectionName = useMemo(() => {
    if (!selectedCollectionId) return 'All Library';
    const found = collections.find((c) => c.id === selectedCollectionId);
    return found?.name || 'Collection';
  }, [collections, selectedCollectionId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-2xl max-h-[85vh] h-[640px] flex flex-col p-0 overflow-hidden rounded-lg bg-popover border border-border shadow-xl'>
        {/* Header */}
        <DialogHeader className='px-5 py-3.5 border-b border-border bg-background shrink-0'>
          <div className='flex items-center justify-between'>
            <DialogTitle className='text-14 font-semibold text-foreground flex items-center gap-2'>
              <BookOpen className='size-4 text-primary shrink-0' />
              <span>Import from Library</span>
            </DialogTitle>
          </div>
          <p className='text-11 text-muted-foreground mt-0.5 text-left'>
            Select papers and reference documents to attach to your AI conversation context.
          </p>
        </DialogHeader>

        {/* Search & Top Action Bar */}
        <div className='px-4 py-2.5 border-b border-border bg-background flex items-center gap-2 shrink-0'>
          <div className='relative flex-1'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search by title, author, year, venue...'
              className='w-full h-8 pl-8 pr-7 text-12 rounded-md border border-border bg-muted/30 focus:bg-background outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all shadow-2xs'
              autoFocus
            />
            {search && (
              <button
                type='button'
                onClick={() => setSearch('')}
                className='absolute right-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer'
              >
                <X className='size-3' />
              </button>
            )}
          </div>

          {items.length > 0 && (
            <button
              type='button'
              onClick={handleSelectAll}
              className='h-8 px-2.5 rounded-md border border-border hover:bg-muted text-11 font-medium text-foreground transition-colors cursor-pointer shrink-0 shadow-2xs'
            >
              {selectedItems.size === items.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {/* Main Body: Master-Detail Layout */}
        <div className='flex-1 flex min-h-0 bg-background'>
          {/* Left Sidebar: Collections & Type Filters */}
          <div className='w-48 sm:w-52 border-r border-border bg-muted/15 p-2 overflow-y-auto space-y-3 shrink-0 select-none'>
            {/* Collections */}
            <div>
              <p className='px-2 py-1 text-10 font-semibold text-muted-foreground uppercase tracking-wider'>
                Collections
              </p>
              <div className='space-y-0.5 mt-0.5'>
                <button
                  type='button'
                  onClick={() => setSelectedCollectionId(null)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                    selectedCollectionId === null
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted font-normal'
                  )}
                >
                  <Layers className='size-3.5 shrink-0' />
                  <span className='truncate flex-1'>All Papers</span>
                </button>

                {collectionsLoading ? (
                  <div className='px-2 py-2 flex items-center gap-1.5 text-11 text-muted-foreground'>
                    <Loader2 className='size-3 animate-spin' />
                    <span>Loading...</span>
                  </div>
                ) : (
                  collections.map((col) => (
                    <button
                      key={col.id}
                      type='button'
                      onClick={() => setSelectedCollectionId(col.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                        selectedCollectionId === col.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted font-normal'
                      )}
                      title={col.name}
                    >
                      <Folder className='size-3.5 shrink-0 opacity-70' />
                      <span className='truncate flex-1'>{col.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Document Types Filter */}
            <div>
              <p className='px-2 py-1 text-10 font-semibold text-muted-foreground uppercase tracking-wider'>
                Types
              </p>
              <div className='space-y-0.5 mt-0.5'>
                <button
                  type='button'
                  onClick={() => setSelectedType(null)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                    selectedType === null
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted font-normal'
                  )}
                >
                  <span>All Types</span>
                </button>
                {['journalArticle', 'conferencePaper', 'preprint', 'book', 'thesis'].map((t) => (
                  <button
                    key={t}
                    type='button'
                    onClick={() => setSelectedType(t === selectedType ? null : t)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-11 text-left cursor-pointer transition-colors',
                      selectedType === t
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground hover:bg-muted font-normal'
                    )}
                  >
                    <span className='truncate'>{ITEM_TYPE_LABELS[t] || t}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Main Content: Paper List */}
          <div className='flex-1 flex flex-col min-w-0 overflow-y-auto p-2 space-y-1.5'>
            {loading ? (
              <div className='flex flex-col items-center justify-center py-16 text-foreground'>
                <Loader2 className='size-5 animate-spin text-primary mb-2' />
                <span className='text-12 text-muted-foreground'>Loading library papers...</span>
              </div>
            ) : items.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 text-center px-4'>
                <FileText className='size-8 text-muted-foreground/40 mb-2' />
                <p className='text-13 font-medium text-foreground'>No papers found</p>
                <p className='text-11 text-muted-foreground mt-0.5 max-w-[280px]'>
                  {search
                    ? `No results matching "${search}". Try searching another title or author.`
                    : 'No documents in this collection yet. Add papers to your library.'}
                </p>
              </div>
            ) : (
              items.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const authorsStr = (item.authors || []).join(', ');
                const venueStr = item.publicationTitle || item.journal || item.publisher || '';
                const typeLabel = ITEM_TYPE_LABELS[item.itemType || ''] || item.itemType;

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item)}
                    onDoubleClick={() => handleDoubleClick(item)}
                    className={cn(
                      'group relative flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none',
                      isSelected
                        ? 'border-primary/60 bg-primary/[0.04] shadow-2xs'
                        : 'border-border/60 bg-card hover:bg-muted/40 hover:border-border'
                    )}
                  >
                    {/* Custom Checkbox */}
                    <div
                      className={cn(
                        'size-4 rounded border flex items-center justify-center mt-0.5 shrink-0 transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-background group-hover:border-muted-foreground/60'
                      )}
                    >
                      {isSelected && <Check className='size-3 stroke-[3]' />}
                    </div>

                    {/* Paper Content */}
                    <div className='min-w-0 flex-1 space-y-1'>
                      <p className='text-12 font-medium text-foreground tracking-tight leading-snug line-clamp-2'>
                        {item.title || 'Untitled Document'}
                      </p>

                      <div className='flex items-center gap-2 text-11 text-muted-foreground flex-wrap'>
                        {authorsStr && (
                          <span className='truncate max-w-[200px] flex items-center gap-1'>
                            <User className='size-3 shrink-0 opacity-70' />
                            {authorsStr}
                          </span>
                        )}

                        {item.year && (
                          <span className='inline-flex items-center gap-1 shrink-0 font-mono text-10 px-1.5 py-0.5 rounded bg-muted text-foreground'>
                            <Calendar className='size-2.5 shrink-0 opacity-70' />
                            {item.year}
                          </span>
                        )}

                        {venueStr && (
                          <span className='truncate max-w-[140px] italic text-10'>
                            {venueStr}
                          </span>
                        )}

                        {typeLabel && (
                          <span className='text-9 uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground shrink-0'>
                            {typeLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className='px-4 py-3 border-t border-border bg-background flex items-center justify-between shrink-0'>
          <div className='flex items-center gap-2'>
            <span className='text-12 font-medium text-foreground'>
              {selectedItems.size > 0 ? (
                <span>
                  <strong className='text-primary'>{selectedItems.size}</strong> paper{selectedItems.size === 1 ? '' : 's'} selected
                </span>
              ) : (
                <span className='text-muted-foreground'>Showing in {activeCollectionName}</span>
              )}
            </span>

            {selectedItems.size > 0 && (
              <button
                type='button'
                onClick={() => setSelectedItems(new Map())}
                className='text-11 text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer'
              >
                Clear
              </button>
            )}
          </div>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground transition-colors cursor-pointer shadow-2xs'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
              className='h-8 px-4 rounded-md bg-primary text-white hover:bg-primary-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-12 font-medium transition-all cursor-pointer shadow-2xs'
            >
              Attach {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
