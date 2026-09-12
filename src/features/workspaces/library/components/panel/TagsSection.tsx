'use client';

import React, { useState, useRef } from 'react';
import { Tag, MinusCircle } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { Item } from '@/features/workspaces/library/types/library.types';
import { normalizeTags } from '@/features/workspaces/library/utils/library.util';

interface TagsSectionProps {
  onUpdatePaper?: (data: Partial<Item>) => void;
  paper: Item;
  onUpdateTags?: (tags: string[]) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  onCancelAdding?: () => void;
}

/** Individual Tag Item matching InfoSection's exact InlineField input interaction style */
function TagItemInput({
  tag,
  onCommit,
  onRemove,
}: {
  tag: string;
  onCommit: (oldTag: string, newTag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [value, setValue] = useState(tag);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(tag);
  }, [tag]);

  const handleBlur = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onRemove(tag);
    } else if (trimmed !== tag) {
      onCommit(tag, trimmed);
    }
  };

  return (
    <div className="group flex items-center gap-1.5 px-1 py-0.5 min-h-7">
      <div className="size-4 shrink-0 flex items-center justify-center">
        <Tag className="size-3.5 text-foreground shrink-0" />
      </div>

      {/* Synchronized with InfoSection's InlineField input style */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleBlur();
            inputRef.current?.blur();
          } else if (e.key === 'Escape') {
            setValue(tag);
            inputRef.current?.blur();
          }
        }}
        className="flex-1 min-w-0 h-7 bg-transparent text-foreground px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-xs font-normal truncate focus:outline-none focus-visible:outline-none font-sans cursor-pointer focus:cursor-text"
        title={tag}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(tag);
        }}
        className="size-5 shrink-0 flex items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer invisible group-hover:visible focus-visible:visible"
        title={`Remove tag "${tag}"`}
        aria-label={`Remove tag "${tag}"`}
      >
        <MinusCircle className="size-3.5 text-foreground shrink-0" />
      </button>
    </div>
  );
}

export default function TagsSection({
  paper,
  onUpdateTags,
  onUpdatePaper,
  hideHeader = false,
  forceAdding = false,
  onCancelAdding,
}: TagsSectionProps) {
  const [newTag, setNewTag] = useState('');
  const [isAdding, setIsAdding] = useState(forceAdding);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (forceAdding) {
      setIsAdding(true);
    }
  }, [forceAdding]);

  const tags: string[] = React.useMemo(() => normalizeTags(paper), [paper]);

  const saveTags = (updatedTags: string[]) => {
    if (onUpdateTags) onUpdateTags(updatedTags);
    if (onUpdatePaper) onUpdatePaper({ tags: updatedTags as any });
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const updated = [...tags, trimmed];
      saveTags(updated);
      setNewTag('');
      setIsAdding(false);
      onCancelAdding?.();
    } else {
      setIsAdding(false);
      setNewTag('');
      onCancelAdding?.();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    saveTags(updated);
  };

  const handleCommitEdit = (oldTag: string, updatedTag: string) => {
    const updated = tags.map((t) => (t === oldTag ? updatedTag : t));
    saveTags(Array.from(new Set(updated)));
  };

  return (
    <div className="space-y-0.5 text-xs select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1 px-1">
          <h3 className="text-xs font-medium text-foreground">Tags</h3>
        </div>
      )}

      {/* List of tags using InfoSection's exact synchronized input style */}
      {tags.map((tag) => (
        <TagItemInput
          key={tag}
          tag={tag}
          onCommit={handleCommitEdit}
          onRemove={handleRemoveTag}
        />
      ))}

      {/* Adding Tag Row */}
      {isAdding && (
        <div className="flex items-center gap-1.5 px-1 py-0.5 min-h-7">
          <div className="size-4 shrink-0 flex items-center justify-center">
            <Tag className="size-3.5 text-foreground shrink-0" />
          </div>
          <input
            ref={newTagInputRef}
            autoFocus
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={handleAddTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
                newTagInputRef.current?.blur();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setNewTag('');
                onCancelAdding?.();
              }
            }}
            className="flex-1 min-w-0 h-7 bg-background text-foreground px-2 py-1 rounded-md border border-primary focus:ring-1 focus:ring-primary outline-none text-xs font-normal truncate focus:outline-none focus-visible:outline-none font-sans"
          />
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewTag('');
              onCancelAdding?.();
            }}
            className="size-5 shrink-0 flex items-center justify-center rounded-md text-foreground hover:bg-muted cursor-pointer"
            title="Cancel"
            aria-label="Cancel adding tag"
          >
            <MinusCircle className="size-3.5 text-foreground shrink-0" />
          </button>
        </div>
      )}

      {/* Empty State when no tags and not adding */}
      {tags.length === 0 && !isAdding && (
        <div
          onClick={() => setIsAdding(true)}
          className="px-2 py-1 text-xs text-foreground cursor-pointer"
        >
          No tags
        </div>
      )}
    </div>
  );
}
