'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname, useParams } from 'next/navigation';
import {
  Tag,
  Search,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useTags } from '../hooks/use-tags';
import { useItems } from '../hooks/use-items';
import { useCollections } from '../hooks/use-collections';
import { normalizeTags } from '../utils/library.util';
import { isPaperInCollection, getDescendantIds } from '../utils/filter.util';
import type { TagWithCount } from '../services/tags.service';
import { Button } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";

function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <div
      className={cn(
        'size-3.5 rounded-sm border flex items-center justify-center transition-colors shrink-0',
        checked
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-border bg-background hover:border-border'
      )}
    >
      {checked && <Check className="size-2.5 stroke-[1.75] text-primary-foreground shrink-0" />}
    </div>
  );
}

export interface TagFilterPopoverProps {
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
  className?: string;
}

export function TagFilterPopover({
  scopeId: propScopeId,
  projectId: propProjectId,
  workspaceId: propWorkspaceId,
  className,
}: TagFilterPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get('filter');
  const params = useParams() as { collectionId?: string };
  const collectionId = params?.collectionId;

  const scopeId = propScopeId || propProjectId || propWorkspaceId || 'user';

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

  const { tags, isLoading, deleteAutomaticTags, isDeletingAutomatic } = useTags(scopeId);
  const { allPapers } = useItems({ scopeId, collectionId: '' });
  const { state: collectionsState } = useCollections(scopeId);
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

  if (!scopeId) return null;

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative size-8 rounded-md border border-border shadow-2xs transition-colors outline-none cursor-pointer select-none inline-flex items-center justify-center",
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
          className="w-72 max-h-[85vh] p-3 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 overflow-hidden font-sans flex flex-col gap-2.5 select-none"
        >
          {/* 1. Search Input at Top (no divider line underneath) */}
          <div className="relative flex items-center shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="h-8 w-full pl-8 pr-7 text-12 bg-background border border-border rounded-md outline-none focus:outline-none focus:border-border focus:ring-0 placeholder:text-muted-foreground text-foreground shadow-none"
            />
            {tagSearch ? (
              <button
                type="button"
                onClick={() => setTagSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-md"
                aria-label="Clear search"
              >
                <X className="size-3 shrink-0" />
              </button>
            ) : null}
          </div>

          {/* 2. Active Tag Chips (when tags are active) */}
          {activeTags.length > 0 && (
            <div className="p-2 rounded-md bg-muted/40 shrink-0">
              <div className="flex items-center justify-between pb-1 px-0.5 select-none">
                <span className="text-11 font-medium text-muted-foreground">
                  Active filters ({activeTags.length})
                </span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-11 text-primary hover:underline cursor-pointer font-medium"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeTags.map((tagName) => (
                  <span
                    key={tagName}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-11 font-medium select-none max-w-full"
                  >
                    <span className="break-words leading-tight">{tagName}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTag(tagName)}
                      className="hover:bg-primary-hover rounded-xs p-0.5 cursor-pointer"
                      aria-label={`Remove tag ${tagName}`}
                    >
                      <X className="size-2.5 shrink-0 text-primary-foreground" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Tags List */}
          <div className="flex-1 max-h-60 overflow-y-auto space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pr-0.5">
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

                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.name)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-2 py-1.5 rounded-md text-12 transition-colors text-left cursor-pointer select-none group",
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-foreground hover:bg-muted font-normal"
                    )}
                    title={tag.name}
                  >
                    <div className="pt-0.5 shrink-0">
                      <FilterCheckbox checked={isActive} />
                    </div>
                    <span className="flex-1 min-w-0 break-words whitespace-normal leading-snug tracking-tight text-12">
                      {tag.name}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* 4. Display Options Section */}
          <div className="border-t border-border pt-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex w-full items-center justify-between px-1 py-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
            >
              <span>Display options</span>
              {isAdvancedOpen ? (
                <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              )}
            </button>

            {isAdvancedOpen && (
              <div className="pt-1.5 space-y-1 select-none">
                <label className="flex items-center gap-2.5 py-1 px-1 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={showAutomatic}
                    onChange={(e) => setShowAutomatic(e.target.checked)}
                    className="sr-only"
                  />
                  <FilterCheckbox checked={showAutomatic} />
                  <span className="text-12 font-normal leading-none">Show automatic tags</span>
                </label>

                <label className="flex items-center gap-2.5 py-1 px-1 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={showAllTagsInLibrary}
                    onChange={(e) => setShowAllTagsInLibrary(e.target.checked)}
                    className="sr-only"
                  />
                  <FilterCheckbox checked={showAllTagsInLibrary} />
                  <span className="text-12 font-normal leading-none">Display all tags in library</span>
                </label>

                {automaticCount > 0 && (
                  <div className="pt-1.5 border-t border-border mt-1">
                    <button
                      type="button"
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      disabled={isDeletingAutomatic}
                      className="w-full flex items-center justify-between px-1.5 py-1.5 text-12 text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                        <span>Delete automatic tags</span>
                      </span>
                      <span className="font-mono text-11 font-medium">({automaticCount})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Confirmation Dialog for Deleting Automatic Tags */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[520px] w-full p-6 rounded-lg bg-background border border-border gap-6 shadow-raised-200">
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
              className="h-9 px-4 text-xs font-medium rounded-md text-foreground hover:bg-muted cursor-pointer shadow-2xs"
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
