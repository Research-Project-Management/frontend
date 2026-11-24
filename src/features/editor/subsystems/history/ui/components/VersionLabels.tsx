'use client';

import React, { useState } from 'react';
import { Tag, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import type { VersionLabelItem } from '@/features/editor/domain/types/history.types';

export interface VersionLabelsProps {
  version: number;
  labels?: VersionLabelItem[];
  isAdding: boolean;
  isSubmitting?: boolean;
  onAdd: (version: number, label: string) => void;
  onDelete: (labelId: string) => void;
  onCancelAdd: () => void;
}

export function VersionLabels({
  version,
  labels,
  isAdding,
  isSubmitting = false,
  onAdd,
  onDelete,
  onCancelAdd,
}: VersionLabelsProps) {
  const [labelText, setLabelText] = useState('');

  const handleSubmit = () => {
    const trimmed = labelText.trim();
    if (!trimmed) return;
    onAdd(version, trimmed);
    setLabelText('');
    onCancelAdd();
  };

  const handleCancel = () => {
    setLabelText('');
    onCancelAdd();
  };

  return (
    <>
      {labels && labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {labels.map((lbl) => (
            <span
              key={lbl.id || lbl.label}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-foreground border border-border rounded-sm"
            >
              <Tag className="size-2.5" />
              <span>{lbl.label}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(lbl.id);
                }}
                className="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                title="Remove label"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isAdding && (
        <div
          className="flex items-center gap-1 mt-2 pt-2 border-t border-border/60"
          onClick={(e) => e.stopPropagation()}
        >
          <Input
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
            aria-label="Label name"
            placeholder="Label name..."
            className="h-6 text-[11px] px-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
          />
          <Button
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!labelText.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            <Check className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={handleCancel}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
    </>
  );
}
