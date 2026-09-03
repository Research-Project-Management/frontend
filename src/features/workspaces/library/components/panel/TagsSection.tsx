'use client';

import React, { useState, useRef } from 'react';
import { Plus, Tag, MinusCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';

interface TagsSectionProps {
  onUpdatePaper?: (data: Partial<CatalogItem>) => void;
  paper: CatalogItem;
  onUpdateTags?: (tags: string[]) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
  onCancelAdding?: () => void;
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
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (forceAdding) {
      setIsAdding(true);
    }
  }, [forceAdding]);

  const tags: string[] = React.useMemo(() => {
    const rawUserTags = Array.isArray((paper as any)?.tags) ? (paper as any).tags : [];
    const rawLabels = Array.isArray(paper?.labels) ? paper.labels : [];
    const rawKeywords = Array.isArray(paper?.keywords) ? paper.keywords : [];

    return Array.from(
      new Set(
        [...rawUserTags, ...rawLabels, ...rawKeywords]
          .map((t: any) => (typeof t === 'string' ? t.trim() : t?.name?.trim() || ''))
          .filter(Boolean),
      ),
    );
  }, [paper]);

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
    if (editingTag === tagToRemove) {
      setEditingTag(null);
    }
  };

  const handleCommitEdit = (oldTag: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      handleRemoveTag(oldTag);
    } else if (trimmed !== oldTag) {
      const updated = tags.map((t) => (t === oldTag ? trimmed : t));
      saveTags(Array.from(new Set(updated)));
    }
    setEditingTag(null);
  };

  const handleStartEdit = (tag: string) => {
    setEditingTag(tag);
    setEditValue(tag);
  };

  return (
    <div className="py-1 space-y-0.5 text-xs select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1 px-3">
          <h3 className="text-xs font-medium text-foreground">Tags</h3>
        </div>
      )}

      {/* List of tags */}
      {tags.map((tag) => {
        const isEditing = editingTag === tag;

        return (
          <div
            key={tag}
            className="group flex items-center gap-2 px-3 py-1 hover:bg-black/5 dark:hover:bg-white/5 min-h-[28px]"
          >
            {/* Tag Icon on left - strictly size-3.5 and aligned with header */}
            <div className="size-4 shrink-0 flex items-center justify-center">
              <Tag className="size-3.5 text-foreground shrink-0" />
            </div>

            {/* Content: Input when editing, clean text otherwise */}
            {isEditing ? (
              <input
                ref={editInputRef}
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleCommitEdit(tag)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCommitEdit(tag);
                  } else if (e.key === 'Escape') {
                    setEditingTag(null);
                  }
                }}
                className="flex-1 min-w-0 h-6.5 px-2 text-xs text-foreground bg-background rounded-md border border-primary focus:outline-none font-sans shadow-none"
              />
            ) : (
              <span
                onClick={() => handleStartEdit(tag)}
                className="flex-1 min-w-0 truncate text-xs text-foreground font-normal cursor-text py-0.5"
                title={tag}
              >
                {tag}
              </span>
            )}

            {/* Minus Circle action on right */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag);
              }}
              className={cn(
                'size-5 shrink-0 flex items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer',
                isEditing ? 'visible' : 'invisible group-hover:visible focus-visible:visible'
              )}
              title={`Remove tag "${tag}"`}
              aria-label={`Remove tag "${tag}"`}
            >
              <MinusCircle className="size-3.5 text-foreground shrink-0" />
            </button>
          </div>
        );
      })}

      {/* Adding Tag Row (strictly NO placeholder!) */}
      {isAdding && (
        <div className="flex items-center gap-2 px-3 py-1 min-h-[28px]">
          <div className="size-4 shrink-0 flex items-center justify-center">
            <Tag className="size-3.5 text-foreground shrink-0" />
          </div>
          <input
            autoFocus
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={handleAddTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setNewTag('');
                onCancelAdding?.();
              }
            }}
            className="flex-1 min-w-0 h-6.5 px-2 text-xs text-foreground bg-background rounded-md border border-primary focus:outline-none font-sans shadow-none"
          />
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewTag('');
              onCancelAdding?.();
            }}
            className="size-5 shrink-0 flex items-center justify-center rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
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
          className="px-3 py-1.5 text-xs text-foreground cursor-pointer"
        >
          No tags
        </div>
      )}
    </div>
  );
}
