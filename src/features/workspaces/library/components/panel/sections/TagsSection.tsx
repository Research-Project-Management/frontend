'use client';

import React, { useState } from 'react';
import { Plus, X, Tag, Hash } from 'lucide-react';
import { Input } from '@/shared/components/ui';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface TagsSectionProps {
  paper: Paper;
  onUpdateTags?: (tags: string[]) => void;
}

export default function TagsSection({ paper, onUpdateTags }: TagsSectionProps) {
  const [newTag, setNewTag] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const tags = paper.labels || [];

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
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Tags ({tags.length})
        </span>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-xs text-foreground hover:underline font-medium cursor-pointer"
          >
            <Plus className="size-3 text-foreground" />
            <span>Add Tag</span>
          </button>
        )}
      </div>

      {isAdding && (
        <div className="flex items-center gap-1.5 p-2 bg-muted/20 rounded-lg border border-border/40">
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
            className="h-7 text-xs bg-background"
          />
          <button
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="px-2.5 h-7 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 cursor-pointer shrink-0"
          >
            Add
          </button>
          <button
            onClick={() => {
              setIsAdding(false);
              setNewTag('');
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {tags.length === 0 && !isAdding ? (
        <div className="py-6 text-center text-muted-foreground text-xs bg-muted/10 rounded-lg border border-dashed border-border/40">
          No tags assigned yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 text-foreground border border-border/40 group hover:border-primary/40 transition-colors"
            >
              <Hash className="size-3 text-muted-foreground/60" />
              <span>{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                className="opacity-50 group-hover:opacity-100 hover:text-foreground transition-opacity ml-0.5 cursor-pointer"
                title={`Remove tag "${tag}"`}
              >
                <X className="size-3 text-foreground" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
