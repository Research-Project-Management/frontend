"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  MoreHorizontal,
  Palette,
  Check,
  Hash,
  Pencil,
  Trash2,
  Scissors,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { TAG_PALETTE_COLORS } from "@/features/library/core/coordinator/facet-filter.coordinator";
import type { TagWithCount } from "@/features/library/domain/types/tags.types";

export interface FilterTagsSectionProps {
  matchingTags: Array<{ tag: TagWithCount; score: number }>;
  activeTags: string[];
  onTagToggle: (name: string) => void;
  showAutomaticTags?: boolean;
  onToggleShowAutomaticTags?: (show: boolean) => void;
  onCreateTag?: (params: {
    name: string;
    color?: string;
    type?: string;
  }) => Promise<unknown>;
  onUpdateTag?: (params: {
    tagId: string;
    data: {
      name?: string;
      color?: string;
      type?: string;
      shortcut?: number | null;
    };
  }) => Promise<unknown>;
  onDeleteTag?: (tagId: string) => Promise<unknown>;
  onDeleteAutomaticTags?: () => Promise<unknown>;
  isDeletingAutomatic?: boolean;
}

export function FilterTagsSection({
  matchingTags,
  activeTags,
  onTagToggle,
  showAutomaticTags = true,
  onToggleShowAutomaticTags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onDeleteAutomaticTags,
  isDeletingAutomatic = false,
}: FilterTagsSectionProps) {
  const [tagsOpen, setTagsOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleCreate = async () => {
    const trimmed = newTagName.trim();
    setIsCreating(false);
    setNewTagName("");
    if (!trimmed || !onCreateTag) return;
    try {
      await onCreateTag({ name: trimmed, type: "manual" });
    } catch {
      // Handled by mutation toast
    }
  };

  const handleCommitRename = async (tag: TagWithCount) => {
    const trimmed = renameValue.trim();
    setRenamingTagId(null);
    setRenameValue("");
    if (!trimmed || trimmed === tag.name || !onUpdateTag) return;
    try {
      await onUpdateTag({
        tagId: tag.id,
        data: { name: trimmed },
      });
    } catch {
      // Handled by mutation toast
    }
  };

  const handleSplitTag = async (tag: TagWithCount) => {
    if (!onCreateTag || !onDeleteTag) return;
    const parts = tag.name
      .split(/[;,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length <= 1) return;
    try {
      for (const part of parts) {
        await onCreateTag({
          name: part,
          color: tag.color,
          type: "manual",
        });
      }
      await onDeleteTag(tag.id);
    } catch {
      // Handled by mutation toast
    }
  };

  const handleAssignColor = async (
    tag: TagWithCount,
    color: string | undefined,
  ) => {
    if (!onUpdateTag) return;
    try {
      await onUpdateTag({
        tagId: tag.id,
        data: { color: color || "" },
      });
    } catch {
      // Handled by mutation toast
    }
  };

  const handleAssignShortcut = async (
    tag: TagWithCount,
    shortcut: number | null,
  ) => {
    if (!onUpdateTag) return;
    try {
      const defaultColor =
        shortcut && (!tag.color || tag.color === "#3b82f6")
          ? TAG_PALETTE_COLORS[(shortcut - 1) % TAG_PALETTE_COLORS.length].value
          : tag.color;

      await onUpdateTag({
        tagId: tag.id,
        data: {
          shortcut,
          ...(defaultColor ? { color: defaultColor } : {}),
        },
      });
    } catch {
      // Handled by mutation toast
    }
  };

  if (matchingTags.length === 0 && !isCreating && !onCreateTag) {
    return null;
  }

  return (
    <div className="-mx-2 px-2 border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
      <div className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground select-none">
        <button
          type="button"
          onClick={() => setTagsOpen(!tagsOpen)}
          className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
        >
          <span>Tags</span>
          {matchingTags.length > 0 && (
            <span className="text-10 font-mono text-muted-foreground">
              ({matchingTags.length})
            </span>
          )}
        </button>

        <div className="flex items-center gap-0.5">
          {onCreateTag && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTagsOpen(true);
                setIsCreating(true);
              }}
              className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="New tag"
              title="Create new tag"
            >
              <Plus className="size-3.5 shrink-0" />
            </button>
          )}

          {(onToggleShowAutomaticTags || onCreateTag) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Tag options"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-xs">
                {onToggleShowAutomaticTags && (
                  <DropdownMenuItem
                    onClick={() =>
                      onToggleShowAutomaticTags(!showAutomaticTags)
                    }
                    className="gap-2 text-xs cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        showAutomaticTags ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span>Show Automatic Tags</span>
                  </DropdownMenuItem>
                )}
                {onCreateTag && (
                  <DropdownMenuItem
                    onClick={() => {
                      setTagsOpen(true);
                      setIsCreating(true);
                    }}
                    className="gap-2 text-xs cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Create New Tag...</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            type="button"
            onClick={() => setTagsOpen(!tagsOpen)}
            className="size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer"
            aria-label={tagsOpen ? "Collapse tags" : "Expand tags"}
          >
            {tagsOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>
        </div>
      </div>

      {tagsOpen && (
        <div className="pt-1 select-none space-y-1">
          {isCreating && (
            <div className="px-1">
              <input
                autoFocus
                type="text"
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onBlur={() => void handleCreate()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreate();
                  } else if (e.key === "Escape") {
                    setIsCreating(false);
                    setNewTagName("");
                  }
                }}
                className="w-full h-6 px-2 text-12 rounded-md bg-background border border-primary outline-none text-foreground"
              />
            </div>
          )}

          <div className="max-h-44 overflow-y-auto space-y-0.5 no-scrollbar">
            {matchingTags.map(({ tag }) => {
              const isSelected = activeTags.some(
                (t) => t.toLowerCase() === tag.name.toLowerCase(),
              );
              const tagCount = tag._count?.itemTags ?? tag.itemCount ?? 0;
              const isAuto =
                (tag.type || "manual").toLowerCase() === "automatic";
              const hasCustomColor = Boolean(
                tag.color && tag.color !== "#3b82f6",
              );

              if (renamingTagId === tag.id) {
                return (
                  <div key={tag.id} className="px-1 py-0.5">
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void handleCommitRename(tag)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleCommitRename(tag);
                        } else if (e.key === "Escape") {
                          setRenamingTagId(null);
                          setRenameValue("");
                        }
                      }}
                      className="w-full h-6 px-2 text-12 rounded-md bg-background border border-primary outline-none text-foreground"
                    />
                  </div>
                );
              }

              return (
                <div
                  key={tag.id}
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={isSelected}
                  onClick={() => onTagToggle(tag.name)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      onTagToggle(tag.name);
                    }
                  }}
                  className={cn(
                    "group/tagrow flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    isSelected
                      ? "bg-muted font-medium"
                      : "hover:bg-muted font-normal",
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none shrink-0"
                  />

                  {(hasCustomColor || typeof tag.shortcut === "number") &&
                    tag.color && (
                      <span
                        className="size-2 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}

                  <span className="flex-1 min-w-0 truncate leading-snug tracking-tight text-12">
                    {tag.name}
                  </span>

                  {isAuto && (
                    <span
                      className="shrink-0 text-[9px] font-mono uppercase px-1 rounded bg-muted text-muted-foreground"
                      title="Automatic tag"
                    >
                      auto
                    </span>
                  )}

                  {typeof tag.shortcut === "number" && (
                    <span
                      className="shrink-0 text-10 font-mono px-1 rounded bg-primary/10 text-primary"
                      title={`Shortcut key ${tag.shortcut}`}
                    >
                      #{tag.shortcut}
                    </span>
                  )}

                  {tagCount > 0 && (
                    <span className="shrink-0 text-11 font-mono text-muted-foreground">
                      {tagCount}
                    </span>
                  )}

                  {onUpdateTag && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="size-4 flex items-center justify-center rounded opacity-0 group-hover/tagrow:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground hover:bg-background transition-opacity shrink-0 cursor-pointer"
                          aria-label={`Manage tag ${tag.name}`}
                        >
                          <MoreHorizontal className="size-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="gap-2 text-xs">
                            <Palette className="size-3.5" />
                            <span>Assign Color</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-40 text-xs">
                            {TAG_PALETTE_COLORS.map((c) => (
                              <DropdownMenuItem
                                key={c.value}
                                onClick={() =>
                                  void handleAssignColor(tag, c.value)
                                }
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
                            {hasCustomColor && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    void handleAssignColor(tag, undefined)
                                  }
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Remove Color
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="gap-2 text-xs">
                            <Hash className="size-3.5" />
                            <span>Shortcut Key (1–9)</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-44 text-xs">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                              <DropdownMenuItem
                                key={num}
                                onClick={() =>
                                  void handleAssignShortcut(tag, num)
                                }
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
                            {typeof tag.shortcut === "number" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    void handleAssignShortcut(tag, null)
                                  }
                                  className="text-xs text-muted-foreground cursor-pointer"
                                >
                                  Clear Shortcut Key
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />

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

                        {/[;,]/.test(tag.name) && (
                          <DropdownMenuItem
                            onClick={() => void handleSplitTag(tag)}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <Scissors className="size-3.5" />
                            <span>Split Tag...</span>
                          </DropdownMenuItem>
                        )}

                        {onDeleteTag && (
                          <DropdownMenuItem
                            onClick={() => void onDeleteTag(tag.id)}
                            className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Delete Tag</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
export default FilterTagsSection;
