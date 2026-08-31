'use client';

import React, { useState } from 'react';
import { Plus, X, Tag, Hash } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface TagsSectionProps {
  paper: Paper;
  onUpdateTags?: (tags: string[]) => void;
  hideHeader?: boolean;
  forceAdding?: boolean;
}

export default function TagsSection({
  paper,
  onUpdateTags,
  hideHeader = false,
  forceAdding = false,
}: TagsSectionProps) {
  const [newTag, setNewTag] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  React.useEffect(() => {
    if (forceAdding) {
      setIsAdding(true);
    }
  }, [forceAdding]);

  const tags: string[] = (paper as any).tags?.length
    ? (paper as any).tags
    : paper.labels?.length
      ? paper.labels
      : paper.keywords || [];

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const updated = [...tags, trimmed];
      if (onUpdateTags) onUpdateTags(updated);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    if (onUpdateTags) onUpdateTags(updated);
  };

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            Tags
          </h3>
          {!isAdding && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsAdding(true)}
              className="h-6 px-1.5 text-xs text-foreground hover:bg-muted font-medium gap-1 cursor-pointer"
            >
              <Plus className="size-3 text-foreground" />
              <span>Add Tag</span>
            </Button>
          )}
        </div>
      )}

      {isAdding && (
        <div className="flex items-center gap-1.5 p-2 bg-muted/20 rounded-md border border-border/40">
          <Input
            autoFocus
            placeholder="Tag name (e.g. LLM, Survey, Benchmark)..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setNewTag('');
              }
            }}
            className="h-7 text-xs bg-background border-border/40 focus-visible:ring-1"
          />
          <Button
            size="sm"
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="h-7 px-2.5 text-xs font-medium cursor-pointer shrink-0"
          >
            Add
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setIsAdding(false);
              setNewTag('');
            }}
            className="size-7 text-foreground hover:bg-muted cursor-pointer shrink-0"
          >
            <X className="size-3.5 text-foreground" />
          </Button>
        </div>
      )}

      {tags.length === 0 && !isAdding ? null : (
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-micro font-mono font-medium bg-muted/50 text-foreground border border-border/40 group hover:border-border/80 transition-colors"
            >
              <Hash className="size-2.5 text-foreground" />
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="opacity-60 group-hover:opacity-100 hover:text-foreground transition-opacity ml-0.5 cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                title={`Remove tag "${tag}"`}
                aria-label={`Remove tag "${tag}"`}
              >
                <X className="size-3 text-foreground" />
              </button>
            </span>
          ))}
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-dashed border-border/60 transition-colors cursor-pointer"
            >
              <Plus className="size-3" />
              <span>Add</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
