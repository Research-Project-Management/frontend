'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  useUpdateLibraryItemMutation,
  useRetraction,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
} from '../../data';
import type { Item } from '../../types/library.types';
import { isItemRetracted, getRetractionInfo } from '../../utils/retraction';
import { RetractionNoticeModal } from '../modals/RetractionNoticeModal';

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
  onClose,
}: InspectorHeaderProps) {
  const [titleDraft, setTitleDraft] = useState(item.title || '');
  const [isRetractionModalOpen, setIsRetractionModalOpen] = useState(false);

  const isTrash = Boolean(item.deletedAt);
  const effectiveCanEdit = canEdit && !isTrash;

  const updateMutation = useUpdateLibraryItemMutation(scopeId);
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const purgeMutation = useBatchPurgeItemsMutation(scopeId);
  const { unflagItem, isUnflagging } = useRetraction(scopeId);

  const isRetracted = isItemRetracted(item);
  const {
    nature: retractionNature,
    title: retractionTitle,
  } = getRetractionInfo(item);

  useEffect(() => {
    setTitleDraft(item.title || '');
  }, [item.title]);

  const handleCommitTitle = () => {
    if (!effectiveCanEdit) return;
    const cleanTitle = titleDraft.replace(/\r?\n+/g, ' ').trim();
    if (cleanTitle && cleanTitle !== item.title) {
      setTitleDraft(cleanTitle);
      updateMutation.mutate({
        id: item.id,
        payload: { title: cleanTitle },
      });
    } else if (!cleanTitle && item.title) {
      setTitleDraft(item.title);
    }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-col shrink-0 select-none bg-background">
      {/* ── Title Header: EXACTLY h-11 (44px) with border-b matching LibraryTopbar and InspectorTabs ── */}
      <div className="h-11 px-1 sm:px-1.5 flex items-center gap-1 w-full min-w-0 border-b border-border bg-background shrink-0">
        <input
          type="text"
          value={titleDraft}
          placeholder="Untitled Document"
          aria-label="Document Title"
          readOnly={!effectiveCanEdit}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleCommitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCommitTitle();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setTitleDraft(item.title || '');
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={cn(
            "flex-1 min-w-0 h-8 text-13 font-semibold tracking-tight text-foreground font-sans select-text rounded-md outline-none truncate transition-colors",
            "px-1.5 border",
            effectiveCanEdit ? [
              "cursor-pointer hover:bg-muted/40 hover:border-border/60",
              "border-transparent focus:cursor-text focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary/25 focus:hover:bg-background",
            ] : [
              "border-transparent cursor-default",
            ]
          )}
          title={titleDraft || 'Untitled Document'}
        />

        {/* 🚨 Sleek Retraction Badge on Header (Click to open Retraction Notice Modal) */}
        {isRetracted && (
          <button
            type="button"
            onClick={() => setIsRetractionModalOpen(true)}
            className="h-6.5 px-2 text-11 font-medium bg-destructive/10 text-destructive border border-destructive/25 rounded-md hover:bg-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5 select-none relative before:absolute before:-inset-1.5 md:before:hidden"
            title={`${retractionTitle}. Click to view details.`}
            aria-label="View retraction notice details"
          >
            <ShieldAlert className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
            <span className="font-medium whitespace-nowrap">
              {retractionNature === 'expression_of_concern' ? 'Concern' : 'Retracted'}
            </span>
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden"
            title="Close inspector"
            aria-label="Close inspector"
          >
            <X className="size-4 shrink-0 text-foreground" />
          </button>
        )}
      </div>

      {/* 🗑️ Trash Notice Alert Banner */}
      {isTrash && (
        <div className="p-3 border-b border-border bg-muted/30 shrink-0 select-none animate-in fade-in duration-200">
          <div className="rounded-md border border-border bg-background p-2.5 text-xs text-muted-foreground flex items-start gap-2.5 select-none shadow-xs">
            <Trash2 className="size-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground text-12">
                  This reference is in Trash
                </span>
                {item.deletedAt && (
                  <span className="text-10 text-muted-foreground font-mono">
                    Deleted {new Date(item.deletedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-11 text-muted-foreground leading-snug">
                This item is read-only. You can restore it to your active library or permanently delete it.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => restoreMutation.mutate([item.id])}
                  disabled={restoreMutation.isPending}
                  className="h-7 px-2.5 text-11 font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50 relative before:absolute before:-inset-1.5 md:before:hidden"
                >
                  <RotateCcw className="size-3" />
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Permanently delete this reference? This action cannot be undone.')) {
                      purgeMutation.mutate([item.id]);
                    }
                  }}
                  disabled={purgeMutation.isPending}
                  className="h-7 px-2.5 text-11 font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 rounded-md cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50 relative before:absolute before:-inset-1.5 md:before:hidden"
                >
                  <Trash2 className="size-3" />
                  <span>Delete permanently</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 Retraction Notice Modal Dialog */}
      {isRetracted && isRetractionModalOpen && (
        <RetractionNoticeModal
          open={isRetractionModalOpen}
          onOpenChange={setIsRetractionModalOpen}
          item={item}
          canEdit={effectiveCanEdit}
          onDismiss={() => unflagItem(item.id)}
          isDismissing={isUnflagging}
        />
      )}
    </div>
  );
}
