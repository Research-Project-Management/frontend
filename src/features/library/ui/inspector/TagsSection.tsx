"use client";

import React, { useState, useRef } from "react";
import { Tag, MinusCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { Item } from "@/features/library/domain/types/library.types";
import {
  normalizeTags,
  cleanSingleFrontendTag,
} from "@/features/library/domain/metadata";

interface TagsSectionProps {
  item?: Item;
  paper?: Item;
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
  onUpdatePaper?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
  onUpdateTags?: (tags: string[]) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  onCancelAdding?: () => void;
  canEdit?: boolean;
}

/** Individual Tag Item matching InfoSection's exact InlineField input interaction style */
function TagItemInput({
  tag,
  onCommit,
  onRemove,
  canEdit = true,
}: {
  tag: string;
  onCommit: (oldTag: string, newTag: string) => void;
  onRemove: (tag: string) => void;
  canEdit?: boolean;
}) {
  const [value, setValue] = useState(tag);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(tag);
  }, [tag]);

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 px-1.5 py-0.5 min-h-[28px] rounded-md">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Tag className="size-3.5 text-muted-foreground shrink-0" />
        </div>
        <span className="flex-1 min-w-0 h-auto text-foreground px-1.5 py-0.5 text-xs font-normal break-words leading-snug select-text flex items-center font-sans">
          {tag}
        </span>
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
        <Tag className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
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
        <TooltipContent side="top">{tag}</TooltipContent>
      </Tooltip>

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
        <TooltipContent side="top">{`Remove tag "${tag}"`}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function TagsSection(props: TagsSectionProps) {
  const item = props.item || props.paper;
  const onUpdateItem = props.onUpdateItem || props.onUpdatePaper;
  const {
    onUpdateTags,
    hideHeader = false,
    forceAdding = false,
    onCancelAdding,
    canEdit = true,
  } = props;

  const [newTag, setNewTag] = useState("");
  const [isAdding, setIsAdding] = useState(forceAdding && canEdit);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (forceAdding && canEdit) {
      setIsAdding(true);
    }
  }, [forceAdding, canEdit]);

  const tags: string[] = React.useMemo(
    () => (item ? normalizeTags(item) : []),
    [item],
  );

  const saveTags = (updatedTags: string[]) => {
    if (onUpdateTags) onUpdateTags(updatedTags);
    if (onUpdateItem)
      onUpdateItem({ tags: updatedTags, silent: true }, { silent: true });
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed) {
      const cleaned = cleanSingleFrontendTag(trimmed);
      if (!cleaned) {
        toast.warning(`Tag "${trimmed}" is invalid or disallowed`, {
          id: "tag-invalid-warning",
        });
      } else if (!tags.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
        const updated = [...tags, cleaned];
        saveTags(updated);
      }
    }
    setNewTag("");
    setIsAdding(false);
    onCancelAdding?.();
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
    saveTags(deduplicated);
  };

  if (tags.length === 0 && !isAdding && hideHeader && !canEdit) {
    return null;
  }

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

      {/* Empty state inline Add action */}
      {tags.length === 0 && !isAdding && canEdit && (
        <div className="pt-0.5 px-1.5">
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-11 text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
          >
            <Plus className="size-3" strokeWidth={1.5} />
            Add tag
          </button>
        </div>
      )}

      {/* List of tags using InfoSection's exact synchronized input style */}
      {tags.map((tag) => (
        <TagItemInput
          key={tag}
          tag={tag}
          onCommit={handleCommitEdit}
          onRemove={handleRemoveTag}
          canEdit={canEdit}
        />
      ))}

      {/* Adding Tag Row */}
      {isAdding && (
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
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={handleAddTag}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
                newTagInputRef.current?.blur();
              } else if (e.key === "Escape") {
                setIsAdding(false);
                setNewTag("");
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
      )}
    </div>
  );
}
