'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Tag as TagIcon,
  X,
  Plus,
  MoreHorizontal,
  Search,
  Palette,
  Check,
  Hash,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useTags } from '@/features/library/sdk/queries/tags-notes.queries';
import { useLibraryNavigation } from '@/features/library/core/coordinator/navigation.coordinator';
import type { Tag } from '@/features/library/domain/types/tags.types';

/** Official Zotero 9-Color Tag Palette */
export const ZOTERO_TAG_COLORS = [
  { label: 'Red', value: '#ff6666' },
  { label: 'Orange', value: '#fb923c' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Green', value: '#4ade80' },
  { label: 'Cyan', value: '#22d3ee' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Magenta', value: '#f472b6' },
  { label: 'Gray', value: '#94a3b8' },
] as const;

export interface TagSelectorPaneProps {
  scopeId: string;
  canEdit?: boolean;
}

/**
 * Zotero 7-style Collapsible Tag Selector Pane for the Left Library Sidebar.
 * Supports:
 * - Instant tag filtering in the main catalog
 * - Colored tags with keyboard shortcuts (1-9)
 * - Tag renaming & automatic merging (when renamed to an existing tag)
 * - Bulk cleanup of automatic imported tags
 */
export function TagSelectorPane({
  scopeId,
  canEdit = true,
}: TagSelectorPaneProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const {
    tags,
    createTag,
    updateTag,
    deleteTag,
    deleteAutomaticTags,
    isDeletingAutomatic,
  } = useTags(scopeId);

  const nav = useLibraryNavigation();
  const activeTagFilter = nav.tag;

  // Sort tags: Colored/Shortcut tags pinned first (ordered by shortcut 1-9), then alphabetical
  const sortedFilteredTags = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = q
      ? tags.filter((t) => t.name.toLowerCase().includes(q))
      : [...tags];

    return list.sort((a, b) => {
      const aHasShortcut = typeof a.shortcut === 'number' && a.shortcut >= 1;
      const bHasShortcut = typeof b.shortcut === 'number' && b.shortcut >= 1;
      if (aHasShortcut && bHasShortcut) {
        return (a.shortcut || 99) - (b.shortcut || 99);
      }
      if (aHasShortcut) return -1;
      if (bHasShortcut) return 1;

      const aHasColor = Boolean(a.color);
      const bHasColor = Boolean(b.color);
      if (aHasColor && !bHasColor) return -1;
      if (!aHasColor && bHasColor) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [tags, filterText]);

  const handleToggleTagFilter = (tagName: string) => {
    if (activeTagFilter?.toLowerCase() === tagName.toLowerCase()) {
      nav.setTagFilter(undefined);
    } else {
      nav.setTagFilter(tagName);
    }
  };

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setIsCreating(false);
      return;
    }
    try {
      await createTag({ name: trimmed, type: 'MANUAL' });
      setNewTagName('');
      setIsCreating(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  const handleCommitRename = async (tag: Tag) => {
    const trimmed = renameValue.trim();
    setRenamingTagId(null);
    setRenameValue('');
    if (!trimmed || trimmed === tag.name) return;

    try {
      await updateTag({
        tagId: tag.id,
        data: { name: trimmed },
      });
      if (activeTagFilter?.toLowerCase() === tag.name.toLowerCase()) {
        nav.setTagFilter(trimmed);
      }
    } catch {
      // Error handled by mutation toast
    }
  };

  const handleAssignColor = async (tag: Tag, color: string | undefined) => {
    try {
      await updateTag({
        tagId: tag.id,
        data: { color: color || '' },
      });
    } catch {
      // Handled by toast
    }
  };

  const handleAssignShortcut = async (
    tag: Tag,
    shortcut: number | null,
  ) => {
    try {
      // If assigning a shortcut and the tag has no color yet, give it a default color from the palette
      const defaultColor =
        shortcut && !tag.color
          ? ZOTERO_TAG_COLORS[(shortcut - 1) % ZOTERO_TAG_COLORS.length].value
          : tag.color;

      await updateTag({
        tagId: tag.id,
        data: {
          shortcut,
          ...(defaultColor ? { color: defaultColor } : {}),
        },
      });
    } catch {
      // Handled by toast
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    try {
      await deleteTag(tag.id);
      if (activeTagFilter?.toLowerCase() === tag.name.toLowerCase()) {
        nav.setTagFilter(undefined);
      }
    } catch {
      // Handled by toast
    }
  };

  return (
    <div className="border-t border-border bg-background/60 flex flex-col shrink-0 select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-2.5 h-8">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-12 font-medium text-foreground hover:text-foreground/80 cursor-pointer outline-none flex-1 min-w-0 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <TagIcon className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="truncate">Tags</span>
          {tags.length > 0 && (
            <span className="text-10 font-mono text-muted-foreground px-1 py-0.2 rounded bg-muted">
              {tags.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {activeTagFilter && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => nav.setTagFilter(undefined)}
                  className="h-5 px-1.5 rounded text-10 font-medium bg-primary/15 text-primary hover:bg-primary/25 flex items-center gap-0.5 cursor-pointer transition-colors"
                >
                  <span className="max-w-[72px] truncate">{activeTagFilter}</span>
                  <X className="size-2.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Clear tag filter</TooltipContent>
            </Tooltip>
          )}

          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(true);
                    setIsCreating(true);
                  }}
                  className="size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer transition-colors"
                  aria-label="New tag"
                >
                  <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Create tag</TooltipContent>
            </Tooltip>
          )}

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Tag options"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <DropdownMenuItem
                  onClick={() => {
                    setIsExpanded(true);
                    setIsCreating(true);
                  }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Create New Tag...</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isDeletingAutomatic}
                  onClick={() => deleteAutomaticTags()}
                  className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <TagIcon className="size-3.5" />
                  <span>Delete Automatic Tags in Library</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-1.5 max-h-52">
          {/* Search input when there are > 4 tags */}
          {tags.length > 4 && (
            <div className="relative flex items-center">
              <Search className="size-3 text-muted-foreground absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter tags..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full h-6 pl-6 pr-6 text-11 rounded-md bg-muted/60 border border-border/60 focus:border-primary focus:bg-background outline-none text-foreground placeholder:text-muted-foreground transition-colors"
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  className="absolute right-1.5 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Inline Create Tag Input */}
          {isCreating && (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onBlur={handleCreateTag}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  } else if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewTagName('');
                  }
                }}
                className="flex-1 h-6 px-2 text-11 rounded-md bg-background border border-primary outline-none text-foreground"
              />
            </div>
          )}

          {/* Tag Chips / List */}
          {sortedFilteredTags.length === 0 ? (
            <div className="py-3 text-center text-11 text-muted-foreground">
              {filterText ? 'No matching tags' : 'No tags in this library yet'}
            </div>
          ) : (
            <div className="overflow-y-auto flex flex-wrap gap-1 pr-0.5 sidebar-scrollbar scrollbar-none [scrollbar-width:none]">
              {sortedFilteredTags.map((tag) => {
                const isSelected =
                  activeTagFilter?.toLowerCase() === tag.name.toLowerCase();
                const isRenaming = renamingTagId === tag.id;
                const itemCount = tag._count?.itemTags ?? 0;

                if (isRenaming) {
                  return (
                    <input
                      key={tag.id}
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleCommitRename(tag)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCommitRename(tag);
                        } else if (e.key === 'Escape') {
                          setRenamingTagId(null);
                          setRenameValue('');
                        }
                      }}
                      className="h-6 px-2 text-11 rounded-md bg-background border border-primary outline-none text-foreground w-full"
                    />
                  );
                }

                return (
                  <div
                    key={tag.id}
                    className={cn(
                      'group/tagchip inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md text-11 border transition-colors max-w-full',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-muted/60 hover:bg-muted text-foreground border-border/60',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleTagFilter(tag.name)}
                      className="inline-flex items-center gap-1 min-w-0 flex-1 cursor-pointer outline-none"
                      title={
                        tag.shortcut
                          ? `${tag.name} (Press ${tag.shortcut} on selected items to toggle)`
                          : `${tag.name} (${itemCount} items)`
                      }
                    >
                      {tag.color && (
                        <span
                          className="size-2 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span className="truncate max-w-[125px]">{tag.name}</span>
                      {typeof tag.shortcut === 'number' && (
                        <span
                          className={cn(
                            'text-9 font-mono px-1 rounded shrink-0',
                            isSelected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-background/80 text-muted-foreground',
                          )}
                        >
                          #{tag.shortcut}
                        </span>
                      )}
                      {itemCount > 0 && !tag.shortcut && (
                        <span
                          className={cn(
                            'text-9 font-mono shrink-0',
                            isSelected
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground',
                          )}
                        >
                          {itemCount}
                        </span>
                      )}
                    </button>

                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'size-4 flex items-center justify-center rounded opacity-0 group-hover/tagchip:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shrink-0',
                              isSelected
                                ? 'hover:bg-primary-foreground/20 text-primary-foreground'
                                : 'hover:bg-background text-muted-foreground hover:text-foreground',
                            )}
                            aria-label={`Manage tag ${tag.name}`}
                          >
                            <MoreHorizontal className="size-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 text-xs">
                          {/* Assign Color */}
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2 text-xs">
                              <Palette className="size-3.5" />
                              <span>Assign Color</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-40 text-xs">
                              {ZOTERO_TAG_COLORS.map((c) => (
                                <DropdownMenuItem
                                  key={c.value}
                                  onClick={() => handleAssignColor(tag, c.value)}
                                  className="gap-2 text-xs cursor-pointer"
                                >
                                  <span
                                    className="size-3 rounded-full shrink-0"
                                    style={{ backgroundColor: c.value }}
                                  />
                                  <span className="flex-1">{c.label}</span>
                                  {tag.color === c.value && (
                                    <Check className="size-3.5 text-foreground" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                              {tag.color && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleAssignColor(tag, undefined)}
                                    className="text-xs text-muted-foreground cursor-pointer"
                                  >
                                    Remove Color
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          {/* Assign Shortcut Key 1-9 */}
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2 text-xs">
                              <Hash className="size-3.5" />
                              <span>Shortcut Key (1–9)</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-44 text-xs">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <DropdownMenuItem
                                  key={num}
                                  onClick={() => handleAssignShortcut(tag, num)}
                                  className="gap-2 text-xs cursor-pointer"
                                >
                                  <span className="font-mono text-11 w-5">
                                    #{num}
                                  </span>
                                  <span className="flex-1">
                                    Press {num} in table
                                  </span>
                                  {tag.shortcut === num && (
                                    <Check className="size-3.5 text-foreground" />
                                  )}
                                </DropdownMenuItem>
                              ))}
                              {tag.shortcut && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleAssignShortcut(tag, null)}
                                    className="text-xs text-muted-foreground cursor-pointer"
                                  >
                                    Clear Shortcut Key
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />

                          {/* Rename / Merge Tag */}
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingTagId(tag.id);
                              setRenameValue(tag.name);
                            }}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <Pencil className="size-3.5" />
                            <span>Rename / Merge Tag...</span>
                          </DropdownMenuItem>

                          {/* Delete Tag */}
                          <DropdownMenuItem
                            onClick={() => handleDeleteTag(tag)}
                            className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete Tag</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default TagSelectorPane;
