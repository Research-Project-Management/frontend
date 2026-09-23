'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, ExternalLink, RotateCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useUpdateLibraryItemMutation, useRetraction } from '../../data';
import type { Item } from '../../types/library.types';

interface InspectorHeaderProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  onClose?: () => void;
}

export function InspectorHeader({
  item,
  scopeId,
  canEdit = true,
}: InspectorHeaderProps) {
  const [titleDraft, setTitleDraft] = useState(item.title || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateMutation = useUpdateLibraryItemMutation(scopeId);
  const { unflagItem, checkItem, isCheckingItem, isUnflagging } = useRetraction(scopeId);

  // Auto-resize textarea to precisely match content height without scaling/jumping
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [titleDraft, adjustHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      adjustHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [adjustHeight]);

  const isRetracted = Boolean(
    item.isRetracted ||
    (item as any).retractionStatus === 'retracted' ||
    (item as any).is_retracted
  );
  const retractionDetails = item.retractionDetails as Record<string, any> | undefined;
  const noticeUrl =
    retractionDetails?.noticeUrl ||
    (item as any).noticeUrl ||
    (item.doi ? `https://doi.org/${item.doi}` : undefined);
  const retractionReason =
    retractionDetails?.reason ||
    (item as any).retractionReason ||
    (item as any).reason;
  const retractionDate =
    retractionDetails?.date ||
    (item as any).retractionDate;

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

  return (
    <div className="flex flex-col border-b border-border bg-background shrink-0 select-none">
      {/* ⚠️ Retraction Warning Alert Banner */}
      {isRetracted && (
        <div className="m-3 mb-0 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2.5 select-none shrink-0 animate-in fade-in duration-200">
          <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-destructive text-12">
                This item has been retracted
              </span>
              {retractionDate && (
                <span className="text-10 text-destructive/80 font-mono">
                  {retractionDate}
                </span>
              )}
            </div>
            {retractionReason && (
              <p className="text-11 text-destructive/90 leading-snug break-words">
                {retractionReason}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              {noticeUrl ? (
                <a
                  href={noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-11 font-medium text-destructive hover:underline"
                >
                  <span>View Retraction Notice</span>
                  <ExternalLink className="size-3 shrink-0" strokeWidth={1.5} />
                </a>
              ) : item.doi ? (
                <a
                  href={`https://doi.org/${item.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-11 font-medium text-destructive hover:underline"
                >
                  <span>View Publication DOI</span>
                  <ExternalLink className="size-3 shrink-0" strokeWidth={1.5} />
                </a>
              ) : <div />}

              {canEdit && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    className="h-5 px-1.5 text-10 font-medium text-destructive hover:bg-destructive/20 rounded cursor-pointer flex items-center transition-colors"
                    disabled={isCheckingItem}
                    onClick={() => checkItem(item.id)}
                  >
                    <RotateCw className={`size-2.5 mr-1 ${isCheckingItem ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                    Re-check
                  </button>
                  <button
                    type="button"
                    className="h-5 px-1.5 text-10 font-medium border border-destructive/40 text-destructive hover:bg-destructive/20 rounded cursor-pointer transition-colors"
                    disabled={isUnflagging}
                    onClick={() => unflagItem(item.id)}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Title Header: Seamless auto-resizing input without scale or size jump */}
      <div className="min-h-11 h-auto px-2 py-1.5 flex items-center w-full min-w-0">
        <textarea
          ref={textareaRef}
          rows={1}
          value={titleDraft}
          placeholder="Untitled Document"
          aria-label="Document Title"
          readOnly={!canEdit}
          onChange={(e) => {
            setTitleDraft(e.target.value);
          }}
          onBlur={handleCommitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleCommitTitle();
              textareaRef.current?.blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setTitleDraft(item.title || '');
              textareaRef.current?.blur();
            }
          }}
          className={cn(
            "w-full text-13 font-semibold tracking-tight text-foreground leading-snug font-sans resize-none overflow-hidden outline-none break-words select-text rounded-md",
            "px-1.5 py-1 border border-transparent bg-transparent transition-[border-color,background-color,box-shadow]",
            canEdit && [
              "cursor-pointer hover:bg-muted/40",
              "focus:cursor-text focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary focus:hover:bg-background",
            ],
            !canEdit && "cursor-default"
          )}
          title={titleDraft || 'Untitled Document'}
        />
      </div>
    </div>
  );
}
