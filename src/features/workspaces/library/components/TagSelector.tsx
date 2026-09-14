'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname, useParams } from 'next/navigation';
import {
  Tag,
  Search,
  X,
  Check,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useTags } from '../hooks/use-tags';
import { useItems } from '../hooks/use-items';
import { useCollections } from '../hooks/use-collections';
import { normalizeTags } from '../utils/library.util';
import { isPaperInCollection, getDescendantIds } from '../utils/filter.util';
import type { TagWithCount } from '../services/tag.service';
import { Button } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Checkbox } from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';

export interface TagFilterPopoverProps {
  workspaceId?: string;
  className?: string;
}

export function TagFilterPopover({
  workspaceId: propWorkspaceId,
  className,
}: TagFilterPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get('filter');
  const params = useParams() as { workspaceId?: string; collectionId?: string };
  const collectionId = params?.collectionId;

  const { workspace } = useWorkspace(propWorkspaceId || params?.workspaceId);
  const workspaceId = propWorkspaceId || workspace?.id || params?.workspaceId || '';

  const [isOpen, setIsOpen] = useState(false);

  // Multi-tag selection: parse all tags from URL searchParams
  const activeTags = useMemo(() => {
    const raw = searchParams.getAll('tag');
    if (!raw.length) return [];
    return raw
      .flatMap((t) => t.split(','))
      .map((t) => decodeURIComponent(t.trim()))
      .filter(Boolean);
  }, [searchParams]);

  const { tags, isLoading, deleteAutomaticTags, isDeletingAutomatic } = useTags(workspaceId);
  const { allPapers } = useItems({ workspaceId, collectionId: '' });
  const { state: collectionsState } = useCollections(workspaceId);
  const collections = collectionsState.collections;

  const [tagSearch, setTagSearch] = useState('');
  const [showAutomatic, setShowAutomatic] = useState(true);
  const [showAllTagsInLibrary, setShowAllTagsInLibrary] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Helper to identify automatic tags (supports both 'automatic' and legacy 'academic')
  const isAutomaticTag = (t: TagWithCount) => t.type === 'automatic' || t.type === 'academic';

  // Toggle individual tag in multi-select mode
  const handleToggleTag = (tagName: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const lower = tagName.toLowerCase();
    let nextTags: string[];

    if (activeTags.some((t) => t.toLowerCase() === lower)) {
      nextTags = activeTags.filter((t) => t.toLowerCase() !== lower);
    } else {
      nextTags = [...activeTags, tagName];
    }

    nextParams.delete('tag');
    if (nextTags.length > 0) {
      nextParams.set('tag', nextTags.join(','));
    }
    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // Deselect all tags
  const handleDeselectAll = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('tag');
    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // Compute descendant collection IDs if a collection is selected
  const descendantIds = useMemo(
    () => (collectionId ? getDescendantIds(collectionId, collections) : undefined),
    [collectionId, collections],
  );

  // Filter items visible in the current library view (collection, trash, unfiled, etc.)
  const visibleItems = useMemo(() => {
    if (!allPapers || allPapers.length === 0) return [];
    let items = allPapers;
    if (activeFilter === 'trash') {
      items = items.filter((item) => Boolean(item.deletedAt));
    } else {
      items = items.filter((item) => !item.deletedAt);
    }
    if (collectionId) {
      if (descendantIds && descendantIds.size > 0) {
        items = items.filter((item) => item.collectionId && descendantIds.has(item.collectionId));
      } else {
        items = items.filter((item) => isPaperInCollection(item, collectionId));
      }
    } else if (activeFilter === 'unfiled') {
      items = items.filter((item) => !item.collectionId);
    }
    return items;
  }, [allPapers, collectionId, descendantIds, activeFilter]);

  // When showAllTagsInLibrary is false, only show tags from items in the current view (and matching active tags)
  const visibleTagNames = useMemo(() => {
    if (showAllTagsInLibrary) return null;
    let relevantItems = visibleItems;
    if (activeTags.length > 0) {
      const activeLower = activeTags.map((t: string) => t.toLowerCase());
      relevantItems = visibleItems.filter((item) => {
        const itemTags = normalizeTags(item).map((t: string) => t.toLowerCase());
        return activeLower.every((at) => itemTags.includes(at));
      });
    }
    const set = new Set<string>();
    for (const item of relevantItems) {
      const itemTags = normalizeTags(item);
      for (const t of itemTags) {
        set.add((t as string).toLowerCase());
      }
    }
    return set;
  }, [showAllTagsInLibrary, visibleItems, activeTags]);

  const filteredTags = useMemo(() => {
    let list = tags.filter((t: TagWithCount) => {
      const count = t._count?.itemTags ?? 0;
      if (count > 0) return true;
      const lower = t.name.toLowerCase();
      return activeTags.some((at) => at.toLowerCase() === lower);
    });

    if (!showAutomatic) {
      list = list.filter((t: TagWithCount) => !isAutomaticTag(t));
    }
    if (!showAllTagsInLibrary && visibleTagNames) {
      list = list.filter((t: TagWithCount) => {
        const lower = t.name.toLowerCase();
        // Always preserve currently selected active tags so the user can deselect them
        if (activeTags.some((at) => at.toLowerCase() === lower)) return true;
        return visibleTagNames.has(lower);
      });
    }
    if (tagSearch.trim()) {
      const q = tagSearch.toLowerCase().trim();
      list = list.filter((t: TagWithCount) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [tags, showAutomatic, showAllTagsInLibrary, visibleTagNames, activeTags, tagSearch]);

  const automaticCount = useMemo(() => {
    return tags.filter(isAutomaticTag).length;
  }, [tags]);

  const handleDeleteAutomaticConfirm = async () => {
    await deleteAutomaticTags();
    setIsConfirmDeleteOpen(false);
    // If any active tag was automatic and removed, update activeTags in URL
    if (activeTags.length > 0) {
      const remainingActive = activeTags.filter((activeTagName) => {
        const found = tags.find((t: TagWithCount) => t.name.toLowerCase() === activeTagName.toLowerCase());
        return found && !isAutomaticTag(found);
      });
      if (remainingActive.length !== activeTags.length) {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete('tag');
        if (remainingActive.length > 0) {
          nextParams.set('tag', remainingActive.join(','));
        }
        const query = nextParams.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      }
    }
  };

  if (!workspaceId) return null;

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative size-8 rounded-md border border-border transition-colors outline-none cursor-pointer select-none inline-flex items-center justify-center",
                  activeTags.length > 0
                    ? "bg-muted text-foreground"
                    : "bg-background hover:bg-muted text-foreground",
                  className
                )}
                aria-label="Filter items by tags"
              >
                <Tag className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                {activeTags.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-foreground" />
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-12">
            {activeTags.length > 0 ? 'Tags (active)' : 'Filter by tags'}
          </TooltipContent>
        </Tooltip>

        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={6}
          className="w-80 p-0 rounded-md border border-border bg-popover text-popover-foreground shadow-none z-50 overflow-hidden font-sans"
        >
          {/* 1. Header */}
          <div className="h-10 px-3 border-b border-border flex items-center justify-between bg-muted/40 select-none">
            <div className="flex items-center gap-2">
              <Tag className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              <span className="text-12 font-medium text-foreground">Tags</span>
            </div>

            <div className="flex items-center gap-1.5">
              {activeTags.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-11 text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline mr-1"
                >
                  Clear all
                </button>
              )}

              {/* Advanced Options Toggle Button */}
              <button
                type="button"
                onClick={() => setIsAdvancedOpen((v) => !v)}
                className={cn(
                  "size-6 flex items-center justify-center rounded-sm transition-colors cursor-pointer",
                  isAdvancedOpen
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-label="Toggle advanced options"
                title="Advanced options"
              >
                <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* 2. Search Input */}
          <div className="p-2 border-b border-border/60 bg-background flex items-center gap-1.5">
            <div className="relative flex-1 flex items-center">
              <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search tags..."
                className="h-7 w-full rounded-md border border-border bg-background pl-8 pr-7 text-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {tagSearch ? (
                <button
                  type="button"
                  onClick={() => setTagSearch('')}
                  className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-sm"
                >
                  <X className="size-3 shrink-0" />
                </button>
              ) : null}
            </div>
          </div>

          {/* 3. Active Tag Chips (if any) */}
          {activeTags.length > 0 && (
            <div className="px-2.5 py-1.5 flex flex-wrap gap-1 max-h-20 overflow-y-auto border-b border-border/40 bg-muted/20 thin-scrollbar">
              {activeTags.map((tagName) => (
                <span
                  key={tagName}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-11 text-foreground border border-border"
                >
                  <span className="truncate max-w-[120px]">{tagName}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleTag(tagName)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-sm"
                    aria-label={`Remove tag ${tagName}`}
                  >
                    <X className="size-2.5 shrink-0" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 4. Tags List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5 thin-scrollbar">
            {isLoading ? (
              <div className="py-6 text-center text-12 text-muted-foreground flex items-center justify-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
                <span>Loading tags...</span>
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="py-6 px-3 text-center text-12 text-muted-foreground">
                {tagSearch ? 'No matching tags found' : 'No tags in this library'}
              </div>
            ) : (
              filteredTags.map((tag: TagWithCount) => {
                const isActive = activeTags.some(
                  (t) => t.toLowerCase() === tag.name.toLowerCase()
                );
                const itemCount = tag._count?.itemTags ?? 0;

                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.name)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-12 transition-colors text-left cursor-pointer select-none",
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-foreground hover:bg-muted font-normal"
                    )}
                    title={`${tag.name} (${itemCount})`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={cn(
                        "size-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isActive
                          ? "bg-foreground border-foreground text-background"
                          : "border-border bg-background"
                      )}>
                        {isActive && <Check className="size-2.5 text-background stroke-[1.75] shrink-0" />}
                      </div>
                      <span className="truncate tracking-tight">{tag.name}</span>
                    </div>

                    <span className={cn(
                      "text-11 font-mono tabular-nums shrink-0",
                      isActive ? "text-foreground font-medium" : "text-muted-foreground font-normal"
                    )}>
                      {itemCount}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* 5. Advanced Options Collapsible */}
          {isAdvancedOpen && (
            <div className="p-3 space-y-2.5 border-t border-border bg-muted/20 text-12 select-none">
              <div className="text-11 font-medium text-muted-foreground tracking-tight">
                Advanced options
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-foreground">
                <Checkbox
                  checked={showAutomatic}
                  onCheckedChange={(checked) => setShowAutomatic(!!checked)}
                  className="size-3.5"
                />
                <span className="text-12 font-normal leading-none">Show automatic tags</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-foreground">
                <Checkbox
                  checked={showAllTagsInLibrary}
                  onCheckedChange={(checked) => setShowAllTagsInLibrary(!!checked)}
                  className="size-3.5"
                />
                <span className="text-12 font-normal leading-none">Display all tags in library</span>
              </label>

              <div className="pt-1.5 border-t border-border/50">
                <button
                  type="button"
                  disabled={automaticCount === 0}
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="w-full flex items-center gap-2 px-2 py-1 text-12 text-destructive hover:bg-destructive/10 rounded-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                >
                  <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span>Delete automatic tags ({automaticCount})</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. Footer summary */}
          <div className="h-8 px-3 border-t border-border bg-muted/40 flex items-center justify-between text-11 text-muted-foreground select-none">
            <span className="font-mono">{filteredTags.length} tag{filteredTags.length === 1 ? '' : 's'}</span>
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center gap-1 font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="size-3 shrink-0" strokeWidth={1.5} />
              <span>{isAdvancedOpen ? 'Hide options' : 'Options'}</span>
              <ChevronDown className={cn("size-3 shrink-0 transition-transform duration-200", isAdvancedOpen && "rotate-180")} />
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation Dialog for Deleting Automatic Tags */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[500px] w-full p-7 rounded-lg bg-background border border-border gap-6 shadow-none">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
              Delete Automatic Tags in This Library?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
              Are you sure you want to delete all automatically generated tags in this library? This will permanently remove {automaticCount} automatic tag{automaticCount === 1 ? '' : 's'} extracted during paper ingestion. Manual tags created by users will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmDeleteOpen(false)}
              disabled={isDeletingAutomatic}
              className="h-9 px-4 text-xs font-medium rounded-md text-foreground hover:bg-muted cursor-pointer shadow-none"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteAutomaticConfirm}
              disabled={isDeletingAutomatic}
              className="h-9 px-4 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 gap-1.5 cursor-pointer shadow-none"
            >
              {isDeletingAutomatic ? (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              ) : null}
              <span>Delete Automatic Tags</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TagFilterPopover;
export { TagFilterPopover as TagSelector };
