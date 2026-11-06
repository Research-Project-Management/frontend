"use client";

import React, { useState, useRef, useMemo } from "react";
import { Tag, MinusCircle, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { Item } from "@/features/library/domain/types/core.types";
import {
  normalizeTags,
  cleanSingleFrontendTag,
  extractStructuredItemTags,
  buildCanonicalTagsPatch,
  type StructuredItemTag,
} from "@/features/library/domain/metadata.mapper";
import { useTags } from "@/features/library/core/coordinator/saved-search-builder.coordinator";

export { buildCanonicalTagsPatch };

interface TagsSectionProps {
  item?: Item;
  scopeId?: string;
  precomputedTags?: string[];
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  onCancelAdding?: () => void;
  canEdit?: boolean;
}

/** Individual Tag Item matching InfoSection's exact InlineField input interaction style */
function TagItemInput({
  tagMeta,
  onCommit,
  onRemove,
  canEdit = true,
}: {
  tagMeta: StructuredItemTag;
  onCommit: (oldTag: string, newTag: string) => void;
  onRemove: (tag: string) => void;
  canEdit?: boolean;
}) {
  const { name: tag, type, color } = tagMeta;
  const isAutomatic = type === "automatic";
  const [value, setValue] = useState(tag);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(tag);
  }, [tag]);

  const renderLeadingIcon = () => {
    if (color) {
      return (
        <span
          className="size-2.5 rounded-full shrink-0 border border-border/40"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      );
    }
    return (
      <Tag className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    );
  };

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 px-1.5 py-0.5 min-h-[28px] rounded-md">
        <div className="size-4 shrink-0 flex items-center justify-center">
          {renderLeadingIcon()}
        </div>
        <span className="flex-1 min-w-0 h-auto text-foreground px-1.5 py-0.5 text-xs font-normal break-words leading-snug select-text flex items-center font-sans">
          {tag}
        </span>
        {isAutomatic && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="px-1 py-0.5 rounded text-[10px] font-medium leading-none text-muted-foreground bg-muted/60 shrink-0">
                Auto
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Automatic tag extracted from paper metadata
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  const handleBlur = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onRemove(tag);
    } else if (trimmed !== tag) {
      onCommit(tag, trimmed);
    }
  };

  return (
    <div className="group flex items-center gap-2 px-1.5 py-0.5 min-h-[28px] rounded-md">
      <div className="size-4 shrink-0 flex items-center justify-center">
        {renderLeadingIcon()}
      </div>

      {/* Synchronized with InfoSection's InlineField input style */}
      <Tooltip>
        <TooltipTrigger asChild>
          <input
            ref={inputRef}
            type="text"
            aria-label={`Edit tag ${tag}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBlur();
                inputRef.current?.blur();
              } else if (e.key === "Escape") {
                setValue(tag);
                inputRef.current?.blur();
              }
            }}
            className="flex-1 min-w-0 h-6 bg-transparent text-foreground px-1.5 py-0.5 rounded-md border border-transparent hover:bg-muted focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-xs font-normal focus:outline-none focus-visible:outline-none font-sans cursor-pointer focus:cursor-text transition-colors"
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          {isAutomatic ? `${tag} (Automatic keyword)` : tag}
        </TooltipContent>
      </Tooltip>

      {isAutomatic && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="px-1 py-0.5 rounded text-[10px] font-medium leading-none text-muted-foreground bg-muted/60 shrink-0 select-none">
              Auto
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            Automatic tag extracted from paper metadata
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(tag);
            }}
            className="size-5 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer invisible group-hover:visible max-md:visible focus-visible:visible relative before:absolute before:-inset-2.5 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
            aria-label={`Remove tag "${tag}"`}
          >
            <MinusCircle className="size-3.5 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Remove tag</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function TagsSection({
  item,
  scopeId,
  onUpdateItem,
  precomputedTags,
  hideHeader = false,
  forceAdding = false,
  onCancelAdding,
  canEdit = true,
}: TagsSectionProps) {
  const [newTag, setNewTag] = useState("");
  const [isAdding, setIsAdding] = useState(forceAdding && canEdit);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const skipNextBlurCommitRef = useRef(false);

  const { tags: catalogTags } = useTags(scopeId, {
    enabled: Boolean(scopeId),
  });

  React.useEffect(() => {
    if (forceAdding && canEdit) {
      setIsAdding(true);
    }
  }, [forceAdding, canEdit]);

  const structuredTags: StructuredItemTag[] = useMemo(() => {
    const extracted = extractStructuredItemTags(item, catalogTags);
    if (!precomputedTags) return extracted;
    const byLower = new Map(
      extracted.map((st) => [st.name.toLowerCase(), st] as const),
    );
    return precomputedTags.map((name) => {
      const existing = byLower.get(name.toLowerCase());
      return (
        existing ?? {
          name,
          type: "manual" as const,
        }
      );
    });
  }, [item, catalogTags, precomputedTags]);

  const tags: string[] = useMemo(
    () =>
      precomputedTags ??
      (structuredTags.length > 0
        ? structuredTags.map((t) => t.name)
        : item
          ? normalizeTags(item)
          : []),
    [precomputedTags, structuredTags, item],
  );

  const automaticTagsCount = useMemo(
    () => structuredTags.filter((t) => t.type === "automatic").length,
    [structuredTags],
  );

  const autocompleteSuggestions = useMemo(() => {
    if (!isAdding) return [];
    const query = newTag.trim().toLowerCase();
    const existingSet = new Set(tags.map((t) => t.toLowerCase()));
    const candidates = (catalogTags || []).filter((ct) => {
      if (!ct?.name) return false;
      const lower = ct.name.trim().toLowerCase();
      if (!lower || existingSet.has(lower)) return false;
      return !query || lower.includes(query);
    });
    return candidates
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return (b.itemCount ?? 0) - (a.itemCount ?? 0);
      })
      .slice(0, 6);
  }, [isAdding, newTag, tags, catalogTags]);

  const saveTags = (
    updatedTags: string[],
    overrideTypes?: Map<string, "manual" | "automatic">,
  ) => {
    if (!onUpdateItem) return;
    onUpdateItem(
      buildCanonicalTagsPatch(
        updatedTags,
        structuredTags,
        overrideTypes,
      ) as Partial<Item>,
      { silent: true },
    );
  };

  const commitNewTagValue = (rawInput: string) => {
    skipNextBlurCommitRef.current = true;
    const trimmed = rawInput.trim();
    if (trimmed) {
      const cleaned = cleanSingleFrontendTag(trimmed);
      if (!cleaned) {
        toast.warning(`Tag "${trimmed}" is invalid or disallowed`, {
          id: "tag-invalid-warning",
        });
      } else if (!tags.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
        const updated = [...tags, cleaned];
        const overrides = new Map<string, "manual" | "automatic">([
          [cleaned.toLowerCase(), "manual"],
        ]);
        saveTags(updated, overrides);
      }
    }
    setNewTag("");
    setActiveSuggestionIdx(-1);
    setIsAdding(false);
    onCancelAdding?.();
  };

  const handleAddTag = () => {
    if (skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false;
      return;
    }
    commitNewTagValue(newTag);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const targetLower = tagToRemove.toLowerCase();
    const updated = tags.filter((t) => t.toLowerCase() !== targetLower);
    saveTags(updated);
  };

  const handleClearAutomaticTags = () => {
    const manualOnly = structuredTags
      .filter((t) => t.type !== "automatic")
      .map((t) => t.name);
    const removedCount = tags.length - manualOnly.length;
    if (removedCount <= 0) return;
    saveTags(manualOnly);
    toast.success(`Cleared ${removedCount} automatic tag(s) from this item`, {
      id: "clear-item-auto-tags",
    });
  };

  const handleCommitEdit = (oldTag: string, updatedTag: string) => {
    const cleaned = cleanSingleFrontendTag(updatedTag);
    if (!cleaned) {
      if (updatedTag.trim()) {
        toast.warning(`Tag "${updatedTag.trim()}" is invalid or disallowed`, {
          id: "tag-invalid-warning",
        });
        return;
      }
      handleRemoveTag(oldTag);
      return;
    }
    const seen = new Set<string>();
    const deduplicated: string[] = [];
    for (const t of tags.map((curr) => (curr === oldTag ? cleaned : curr))) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(t);
      }
    }
    const overrides = new Map<string, "manual" | "automatic">([
      [cleaned.toLowerCase(), "manual"],
    ]);
    saveTags(deduplicated, overrides);
  };

  return (
    <div className="flex flex-col gap-1 text-xs select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1 px-1.5">
          <h3 className="text-12 font-medium text-foreground">Tags</h3>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="size-5 flex items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer transition-colors"
                  aria-label="Add tag"
                >
                  <Plus
                    className="size-3.5 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Add tag</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {tags.length === 0 && !isAdding && (
        <div className="flex items-center justify-between px-1.5 py-1 text-12 text-muted-foreground select-none">
          <span>No tags assigned</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-11 font-medium text-foreground hover:underline cursor-pointer"
            >
              Add tag
            </button>
          )}
        </div>
      )}

      {/* List of tags using InfoSection's exact synchronized input style */}
      {structuredTags.map((tagMeta) => (
        <TagItemInput
          key={tagMeta.name}
          tagMeta={tagMeta}
          onCommit={handleCommitEdit}
          onRemove={handleRemoveTag}
          canEdit={canEdit}
        />
      ))}

      {/* Adding Tag Row with Catalog Autocomplete */}
      {isAdding && (
        <div className="relative flex flex-col">
          <div className="flex items-center gap-2 px-1.5 py-0.5 min-h-[28px] rounded-md">
            <div className="size-4 shrink-0 flex items-center justify-center">
              <Tag className="size-3.5 text-muted-foreground shrink-0" />
            </div>
            <input
              ref={newTagInputRef}
              autoFocus
              type="text"
              aria-label="New tag name"
              value={newTag}
              onChange={(e) => {
                setNewTag(e.target.value);
                setActiveSuggestionIdx(-1);
              }}
              onBlur={handleAddTag}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && autocompleteSuggestions.length > 0) {
                  e.preventDefault();
                  setActiveSuggestionIdx((prev) =>
                    prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0,
                  );
                } else if (
                  e.key === "ArrowUp" &&
                  autocompleteSuggestions.length > 0
                ) {
                  e.preventDefault();
                  setActiveSuggestionIdx((prev) =>
                    prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1,
                  );
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (
                    activeSuggestionIdx >= 0 &&
                    activeSuggestionIdx < autocompleteSuggestions.length
                  ) {
                    commitNewTagValue(
                      autocompleteSuggestions[activeSuggestionIdx].name,
                    );
                  } else {
                    commitNewTagValue(newTag);
                  }
                } else if (e.key === "Escape") {
                  skipNextBlurCommitRef.current = true;
                  setIsAdding(false);
                  setNewTag("");
                  setActiveSuggestionIdx(-1);
                  onCancelAdding?.();
                }
              }}
              className="flex-1 min-w-0 h-6 bg-background text-foreground px-1.5 py-0.5 rounded-md border border-primary focus:ring-1 focus:ring-primary outline-none text-xs font-normal focus:outline-none focus-visible:outline-none font-sans"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    setIsAdding(false);
                    setNewTag("");
                    setActiveSuggestionIdx(-1);
                    onCancelAdding?.();
                  }}
                  className="size-5 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer relative before:absolute before:-inset-2.5 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                  aria-label="Cancel adding tag"
                >
                  <MinusCircle className="size-3.5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Cancel</TooltipContent>
            </Tooltip>
          </div>

          {autocompleteSuggestions.length > 0 && (
            <div
              role="listbox"
              aria-label="Suggested tags"
              className="mt-1 ml-6 mr-1 rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1 z-20 max-h-40 overflow-y-auto"
            >
              {autocompleteSuggestions.map((sug, idx) => (
                <button
                  key={sug.id || sug.name}
                  type="button"
                  role="option"
                  aria-selected={idx === activeSuggestionIdx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitNewTagValue(sug.name);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                    idx === activeSuggestionIdx &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    {sug.color ? (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: sug.color }}
                      />
                    ) : (
                      <Tag className="size-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{sug.name}</span>
                  </span>
                  {typeof sug.itemCount === "number" && sug.itemCount > 0 && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {sug.itemCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {canEdit && automaticTagsCount > 0 && !isAdding && (
        <div className="flex items-center justify-end px-1.5 pt-1">
          <button
            type="button"
            onClick={handleClearAutomaticTags}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Clear automatic tags from this item"
          >
            <Sparkles className="size-3 shrink-0" />
            <span>Clear automatic ({automaticTagsCount})</span>
          </button>
        </div>
      )}
    </div>
  );
}
