"use client";

import React, { useState, useRef, useMemo } from "react";
import { Tag, MinusCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { Item } from "@/features/library/types/core.types";
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

/** Individual Tag Item matching Zotero's exact clean tag list interaction style */
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
  const { name: tag } = tagMeta;
  const [value, setValue] = useState(tag);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(tag);
  }, [tag]);

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = value.trim();
    if (!trimmed) {
      onRemove(tag);
    } else if (trimmed !== tag) {
      onCommit(tag, trimmed);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-1.5 px-1.5 min-h-[26px] py-1 rounded-md transition-colors",
        isEditing && canEdit ? "bg-muted/60" : "hover:bg-muted/40",
      )}
    >
      <div className="size-4 shrink-0 flex items-center justify-center mt-0.5">
        <Tag
          className={cn(
            "size-3.5 transition-colors shrink-0",
            isEditing && canEdit
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
      </div>

      {isEditing && canEdit ? (
        <input
          ref={inputRef}
          type="text"
          aria-label={`Edit tag ${tag}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleBlur();
            } else if (e.key === "Escape") {
              setValue(tag);
              setIsEditing(false);
            }
          }}
          className="flex-1 min-w-0 bg-transparent text-foreground px-1 py-0.5 border-none outline-none ring-0 text-xs font-normal leading-snug font-sans"
        />
      ) : (
        <span
          onClick={() => {
            if (canEdit) {
              setIsEditing(true);
            }
          }}
          className={cn(
            "flex-1 min-w-0 text-foreground px-1 py-0.5 text-xs font-normal break-words leading-snug select-text font-sans",
            canEdit ? "cursor-text" : "cursor-default",
          )}
          title={tag}
        >
          {tag}
        </span>
      )}

      {canEdit && (
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
              className="size-5 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer invisible group-hover:visible max-md:visible focus-visible:visible relative before:absolute before:-inset-2.5 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors mt-0.5"
              aria-label={`Remove tag "${tag}"`}
            >
              <MinusCircle className="size-3.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Remove tag</TooltipContent>
        </Tooltip>
      )}
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

  const autocompleteSuggestions = useMemo(() => {
    const query = newTag.trim().toLowerCase();
    if (!isAdding || !query) return [];
    const existingSet = new Set(tags.map((t) => t.toLowerCase()));
    const seen = new Set<string>();
    const candidates = (catalogTags || []).filter((ct) => {
      if (!ct?.name) return false;
      const cleanedName = cleanSingleFrontendTag(ct.name) || ct.name.trim();
      const lower = cleanedName.toLowerCase();
      if (!lower || existingSet.has(lower) || seen.has(lower)) return false;
      if (!lower.includes(query)) return false;
      seen.add(lower);
      return true;
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

  if (tags.length === 0 && !isAdding && hideHeader) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5 text-xs select-none font-sans">
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
          <div className="flex items-start gap-1.5 px-1.5 min-h-[26px] py-1 rounded-md bg-muted/60">
            <div className="size-4 shrink-0 flex items-center justify-center mt-0.5">
              <Tag className="size-3.5 text-foreground shrink-0" />
            </div>
            <input
              ref={newTagInputRef}
              autoFocus
              type="text"
              placeholder="Add tag..."
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
              className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground px-1 py-0.5 border-none outline-none ring-0 text-xs font-normal leading-snug font-sans"
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
                  className="size-5 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer relative before:absolute before:-inset-2.5 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors mt-0.5"
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
              className="mt-1 ml-6 mr-1 p-1 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-20 max-h-40 overflow-y-auto scrollbar-thin"
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
                    "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-xs text-foreground hover:bg-muted cursor-pointer transition-colors",
                    idx === activeSuggestionIdx && "bg-muted font-medium",
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    <Tag className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{sug.name}</span>
                  </span>
                  {typeof sug.itemCount === "number" && sug.itemCount > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {sug.itemCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
