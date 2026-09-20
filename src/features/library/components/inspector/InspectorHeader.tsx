'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Copy, Check, X, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { generateCitationKey } from '../../domain/citations';
import { useUpdateLibraryItemMutation } from '../../data';
import type { Item } from '../../types/library.types';

interface InspectorHeaderProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  onClose: () => void;
}

export function InspectorHeader({
  item,
  scopeId,
  canEdit = true,
  onClose,
}: InspectorHeaderProps) {
  const router = useRouter();
  const [titleDraft, setTitleDraft] = useState(item.title || '');
  const [copiedKey, setCopiedKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useUpdateLibraryItemMutation(scopeId);

  useEffect(() => {
    setTitleDraft(item.title || '');
  }, [item.title]);

  const handleCommitTitle = () => {
    if (!canEdit) return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== item.title) {
      updateMutation.mutate({
        id: item.id,
        payload: { title: trimmed },
      });
    } else if (!trimmed && item.title) {
      setTitleDraft(item.title);
    }
  };

  const citationKey = generateCitationKey(item);

  const handleCopyCitationKey = async () => {
    const ok = await copyToClipboard(`\\cite{${citationKey}}`);
    if (ok) {
      setCopiedKey(true);
      toast.success(`Copied \\cite{${citationKey}}`);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleOpenReader = () => {
    router.push(`/library/papers/${item.id}`);
  };

  return (
    <div className="flex flex-col border-b border-border/60 bg-muted/20 px-3.5 py-3 gap-2 shrink-0 select-none">
      {/* Top action row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate">
          <FileText className="size-3.5 text-primary shrink-0" />
          <span className="capitalize tracking-tight">
            {item.itemType ? item.itemType.replace(/_/g, ' ') : 'Document'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Open in Reader */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80"
                onClick={handleOpenReader}
              >
                <BookOpen className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Open in PDF Reader</TooltipContent>
          </Tooltip>

          {/* Copy Citation Key */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80"
                onClick={handleCopyCitationKey}
              >
                {copiedKey ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Copy Citation Key</TooltipContent>
          </Tooltip>

          {/* Close Panel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close Inspector</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Editable Title input */}
      <div className="w-full">
        {canEdit ? (
          <input
            ref={inputRef}
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleCommitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCommitTitle();
                inputRef.current?.blur();
              } else if (e.key === 'Escape') {
                setTitleDraft(item.title || '');
                inputRef.current?.blur();
              }
            }}
            placeholder="Untitled Document"
            className="w-full text-sm font-semibold tracking-tight text-foreground bg-transparent px-1.5 py-0.5 rounded border border-transparent hover:border-border/60 focus:border-primary focus:bg-background outline-none transition-all"
          />
        ) : (
          <h2 className="text-sm font-semibold tracking-tight text-foreground px-1.5 py-0.5 line-clamp-2">
            {item.title || 'Untitled Document'}
          </h2>
        )}
      </div>
    </div>
  );
}
