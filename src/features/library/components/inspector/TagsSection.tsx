'use client';

import React, { useState, useRef } from 'react';
import { Tag, MinusCircle, Plus } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui";
import type { Item } from '@/features/library/types/library.types';
import { normalizeTags, cleanSingleFrontendTag } from '../../domain';

interface TagsSectionProps {
  onUpdatePaper?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
  paper: Item;
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
      <div className="flex items-center gap-[8px] px-[8px] py-[5px] min-h-[34px] rounded-md">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Tag className="size-3.5 text-foreground shrink-0" />
        </div>
        <span className="flex-1 min-w-0 h-auto text-foreground px-[8px] py-[5px] text-xs font-normal break-words leading-snug select-text flex items-center font-sans">
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
    <div className="group flex items-center gap-[8px] px-[8px] py-[5px] min-h-[34px] rounded-md">
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
        className="flex-1 min-w-0 h-[26px] bg-transparent text-foreground px-[8px] py-[5px] rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-xs font-normal focus:outline-none focus-visible:outline-none font-sans cursor-pointer focus:cursor-text"
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
  canEdit = true,
}: TagsSectionProps) {
  const [newTag, setNewTag] = useState('');
  const [isAdding, setIsAdding] = useState(forceAdding && canEdit);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (forceAdding && canEdit) {
      setIsAdding(true);
    }
  }, [forceAdding, canEdit]);

  const tags: string[] = React.useMemo(() => normalizeTags(paper), [paper]);

  const saveTags = (updatedTags: string[]) => {
    if (onUpdateTags) onUpdateTags(updatedTags);
    if (onUpdatePaper) onUpdatePaper({ tags: updatedTags, silent: true } as any, { silent: true });
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    const cleaned = cleanSingleFrontendTag(trimmed) || trimmed;
    if (cleaned && !tags.includes(cleaned)) {
      const updated = [...tags, cleaned];
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
    const cleaned = cleanSingleFrontendTag(updatedTag) || updatedTag.trim();
    if (!cleaned) {
      handleRemoveTag(oldTag);
      return;
    }
    const updated = tags.map((t) => (t === oldTag ? cleaned : t));
    saveTags(Array.from(new Set(updated)));
  };

  if (tags.length === 0 && !isAdding) {
    return (
      <div className="py-2 px-1.5 text-center text-11 text-muted-foreground flex flex-col items-center justify-center gap-1.5 font-sans">
        <span>No tags assigned.</span>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="h-6 text-11 text-foreground hover:bg-muted px-2 gap-1 cursor-pointer font-normal"
          >
            <Plus className="size-3 text-foreground" strokeWidth={1.5} />
            <span>Add tag</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-[5px] text-xs select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-[5px] px-[8px]">
          <h3 className="text-12 font-medium text-foreground">Tags</h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="Add tag"
              aria-label="Add tag"
            >
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          )}
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
        <div className="flex items-center gap-[8px] px-[8px] py-[5px] min-h-[34px] rounded-md">
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
            className="flex-1 min-w-0 h-[26px] bg-background text-foreground px-[8px] py-[5px] rounded-md border border-primary focus:ring-1 focus:ring-primary outline-none text-xs font-normal focus:outline-none focus-visible:outline-none font-sans"
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
    </div>
  );
}
