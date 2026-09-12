'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname, useParams } from 'next/navigation';
import { Filter, ChevronDown, X, Check, Loader2 } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useTags } from '../hooks/use-tags';
import { useItems } from '../hooks/use-items';
import { useCollections } from '../hooks/use-collections';
import { normalizeTags } from '../utils/library.util';
import { isPaperInCollection, getDescendantIds } from '../utils/filter.util';
import type { TagWithCount } from '../services/tag.service';
import { Button } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";

interface TagSelectorProps {
  workspaceId: string;
  className?: string;
}

export default function TagSelector({ workspaceId, className }: TagSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams() as { workspaceId?: string; collectionId?: string };
  const collectionId = params?.collectionId;
  const activeFilter = searchParams.get('filter');

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
      const activeLower = activeTags.map((t) => t.toLowerCase());
      relevantItems = visibleItems.filter((item) => {
        const itemTags = normalizeTags(item).map((t) => t.toLowerCase());
        return activeLower.every((at) => itemTags.includes(at));
      });
    }
    const set = new Set<string>();
    for (const item of relevantItems) {
      const itemTags = normalizeTags(item);
      for (const t of itemTags) {
        set.add(t.toLowerCase());
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
    <div className={cn("border-t border-border flex flex-col bg-background select-none shrink-0 w-full", className)}>
      {/* Search & Filter Bar (Zotero-style: input on left, filter dropdown on right) */}
      <div className="p-2 pb-1.5 flex items-center gap-1.5">
        <div className="relative flex-1 flex items-center min-w-0">
          <input
            type="text"
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Filter Tags"
            className="h-7 w-full rounded-md border border-border bg-background px-2.5 pr-6 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {tagSearch ? (
            <button
              type="button"
              onClick={() => setTagSearch('')}
              className="absolute right-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3 shrink-0" />
            </button>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-7 px-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              aria-label="Tag options"
            >
              <Filter className="size-3.5 shrink-0" />
              <ChevronDown className="size-2.5 opacity-70 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={6}
            collisionPadding={16}
            className="w-[280px] p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-xs space-y-0.5 font-sans z-50"
          >
            {/* Selected tag counter */}
            <div className="px-3 py-1.5 text-xs text-muted-foreground select-none font-normal">
              {activeTags.length === 1
                ? '1 tag selected'
                : `${activeTags.length} tags selected`}
            </div>

            {/* Deselect All */}
            <DropdownMenuItem
              disabled={activeTags.length === 0}
              onClick={handleDeselectAll}
              className="flex items-center px-3 py-1.5 text-xs font-normal cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>Deselect All</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border" />

            {/* Show Automatic */}
            <DropdownMenuItem
              onClick={() => setShowAutomatic(!showAutomatic)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-normal cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted"
            >
              <div className="size-3.5 flex items-center justify-center shrink-0">
                {showAutomatic && <Check className="size-3.5 text-foreground shrink-0" />}
              </div>
              <span>Show Automatic</span>
            </DropdownMenuItem>

            {/* Display All Tags in This Library */}
            <DropdownMenuItem
              onClick={() => setShowAllTagsInLibrary(!showAllTagsInLibrary)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-normal cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted"
            >
              <div className="size-3.5 flex items-center justify-center shrink-0">
                {showAllTagsInLibrary && <Check className="size-3.5 text-foreground shrink-0" />}
              </div>
              <span>Display All Tags in This Library</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-border" />

            {/* Delete Automatic Tags */}
            <DropdownMenuItem
              disabled={automaticCount === 0}
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="flex items-center px-3 py-1.5 text-xs font-normal cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <span>Delete Automatic Tags in This Library...</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tags list (clean text only, hover/active harmonized with sidebar design) */}
      <div className="max-h-56 overflow-y-auto px-2 pb-2 space-y-0.5">
        {isLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Loader2 className="size-3 animate-spin text-foreground shrink-0" />
            <span>Loading tags...</span>
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="py-3 px-2 text-center text-xs text-muted-foreground">
            {tagSearch ? 'No matching tags' : 'No tags in library'}
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
                  "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left cursor-pointer select-none",
                  isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-foreground hover:bg-muted font-normal"
                )}
                title={`${tag.name} (${itemCount})`}
              >
                <span className="truncate flex-1 tracking-tight">
                  {tag.name}
                </span>

                <span className={cn(
                  "text-11 tabular-nums shrink-0",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground font-normal"
                )}>
                  {itemCount}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog for Deleting Automatic Tags */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[500px] w-full p-7 rounded-lg bg-background border border-border gap-6">
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
              className="h-9 px-4 text-xs font-medium rounded-md text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteAutomaticConfirm}
              disabled={isDeletingAutomatic}
              className="h-9 px-4 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 gap-1.5"
            >
              {isDeletingAutomatic ? (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              ) : null}
              <span>Delete Automatic Tags</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
