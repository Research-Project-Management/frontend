'use client';

import React from 'react';
import {
  StickyNote,
  Trash2,
  X,
  Check,
  Edit3,
  FileText,
  Palette,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import type {
  ReaderAnnotation,
  AnnotationFormData,
} from '@/features/library/domain/types/reader.types';
import { ANNOTATION_PALETTE_COLORS } from '@/features/library/domain/reader.domain';
import { AnnotationEditForm } from './AnnotationEditForm';

export interface AnnotationsPanelCardProps {
  annotation: ReaderAnnotation;
  isEditing: boolean;
  isDeletingCurrent: boolean;
  isSelected: boolean;
  isUpdating: boolean;
  targetIds: string[];
  onCardClick: (e: React.MouseEvent, annotation: ReaderAnnotation) => void;
  onCardContextMenu: (annotation: ReaderAnnotation) => void;
  onJumpToPage: (pageIndex?: number, annotationId?: string) => void;
  onStartEdit: (annotationId: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (annotation: ReaderAnnotation, data: AnnotationFormData) => Promise<void> | void;
  onStartDelete: (annotationId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (annotation: ReaderAnnotation) => void;
  onAddToNote?: (text: string, pageNumber?: number) => void;
  onBatchAddToNote?: (targetIds?: string[]) => void;
  onBatchChangeColor?: (colorHex: string, targetIds?: string[]) => Promise<void>;
  onBatchDelete?: (targetIds?: string[]) => Promise<void>;
}

export function AnnotationsPanelCard({
  annotation,
  isEditing,
  isDeletingCurrent,
  isSelected,
  isUpdating,
  targetIds,
  onCardClick,
  onCardContextMenu,
  onJumpToPage,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  onAddToNote,
  onBatchAddToNote,
  onBatchChangeColor,
  onBatchDelete,
}: AnnotationsPanelCardProps) {
  const safeColor = annotation.color || '#ffd400';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => onCardClick(e, annotation)}
          onContextMenu={() => onCardContextMenu(annotation)}
          className={cn(
            'group rounded-md border p-2 text-12 transition-all relative cursor-pointer select-none outline-none',
            isSelected
              ? 'border-primary bg-primary/10 ring-1 ring-primary'
              : 'border-border hover:border-border-hover bg-background',
          )}
        >
          {isEditing ? (
            <AnnotationEditForm
              initialQuote={annotation.quoteText}
              initialComment={annotation.comment}
              initialColor={annotation.color}
              initialTags={annotation.tags}
              isSaving={isUpdating}
              onSave={async (data) => {
                await onSaveEdit(annotation, data);
              }}
              onCancel={onCancelEdit}
            />
          ) : (
            <div className="space-y-1.5">
              {/* Top row: Page tag, actions */}
              <div className="flex items-center justify-between gap-1 text-11">
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-mono text-foreground hover:underline cursor-pointer tabular-nums font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToPage(annotation.pageIndex, annotation.id);
                    }}
                  >
                    P. {(annotation.pageIndex ?? 0) + 1}
                  </span>
                </div>

                {/* Hover actions */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                >
                  {isDeletingCurrent ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onConfirmDelete(annotation)}
                        aria-label="Confirm delete"
                        className="size-6 sm:size-5 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <Check className="size-3" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={onCancelDelete}
                        aria-label="Cancel"
                        className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <X className="size-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {onAddToNote && (
                        <button
                          type="button"
                          onClick={() =>
                            onAddToNote(
                              annotation.quoteText || annotation.comment || '',
                              (annotation.pageIndex ?? 0) + 1,
                            )
                          }
                          aria-label="Add to Note"
                          className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          title="Add to Note"
                        >
                          <StickyNote className="size-3" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onStartEdit(annotation.id)}
                        aria-label="Edit annotation"
                        className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <Edit3 className="size-3" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartDelete(annotation.id)}
                        aria-label="Delete annotation"
                        className="size-6 sm:size-5 rounded-md text-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <Trash2 className="size-3" strokeWidth={1.5} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Quote Text */}
              {annotation.quoteText && (
                <div className="text-left w-full select-text">
                  <p
                    className="text-12 leading-snug text-foreground border-l-2 pl-2 italic"
                    style={{ borderColor: safeColor }}
                  >
                    &ldquo;{annotation.quoteText}&rdquo;
                  </p>
                </div>
              )}

              {/* Comment */}
              {annotation.comment && (
                <p className="text-11 text-foreground pl-2 leading-relaxed select-text">
                  {annotation.comment}
                </p>
              )}

              {/* Tags */}
              {annotation.tags && annotation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-2 pt-0.5">
                  {annotation.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-10 font-mono bg-background text-foreground border border-border"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      {/* Zotero-native Context Menu on Annotation Card */}
      <ContextMenuContent className="w-52 text-12 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
        <ContextMenuItem
          onClick={() => onBatchAddToNote?.(targetIds)}
          className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted"
        >
          <FileText className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>
            {targetIds.length > 1
              ? `Add to Note (${targetIds.length})`
              : 'Add to Note'}
          </span>
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
            <Palette className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Change Color</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-36 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
            {ANNOTATION_PALETTE_COLORS.map((c) => (
              <ContextMenuItem
                key={c.id}
                onClick={() => onBatchChangeColor?.(c.hex, targetIds)}
                className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1 rounded-sm hover:bg-muted text-11"
              >
                <span
                  className="size-3 rounded-full border border-border shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span>{c.label}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator className="my-1 border-t border-border" />

        <ContextMenuItem
          onClick={() => onBatchDelete?.(targetIds)}
          variant="destructive"
          className="flex items-center gap-2 cursor-pointer text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded-sm text-12"
        >
          <Trash2 className="size-3.5 shrink-0 text-destructive" strokeWidth={1.5} />
          <span className="flex-1">
            {targetIds.length > 1
              ? `Delete ${targetIds.length} Annotations`
              : 'Delete Annotation'}
          </span>
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export interface AnnotationsBottomSelectorDockProps {
  existingColors: Array<{ id: string; label: string; hex: string }>;
  existingTags: string[];
  selectedColor: string;
  selectedTag: string | null;
  onSelectColor: (color: string) => void;
  onSelectTag: (tag: string | null) => void;
}

export function AnnotationsBottomSelectorDock({
  existingColors,
  existingTags,
  selectedColor,
  selectedTag,
  onSelectColor,
  onSelectTag,
}: AnnotationsBottomSelectorDockProps) {
  if (existingColors.length <= 1 && existingTags.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border bg-muted p-2 space-y-1.5 shrink-0 text-11 font-sans">
      {existingColors.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-10 font-semibold text-muted-foreground uppercase tracking-wider">
            Colors:
          </span>
          <div className="flex items-center gap-1">
            {existingColors.map((c) => {
              const active = selectedColor.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectColor(active ? 'all' : c.hex)}
                  className={cn(
                    'size-4 rounded-full border border-border transition-colors cursor-pointer relative',
                    active && 'ring-2 ring-primary ring-offset-1',
                  )}
                  style={{ backgroundColor: c.hex }}
                  title={`${c.label} (${active ? 'Active' : 'Filter by this color'})`}
                />
              );
            })}
            {selectedColor !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectColor('all')}
                className="text-10 text-muted-foreground hover:text-foreground cursor-pointer underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {existingTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-10 font-semibold text-muted-foreground uppercase tracking-wider">
            Tags:
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {existingTags.map((tag) => {
              const active = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onSelectTag(active ? null : tag)}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-10 font-mono transition-colors cursor-pointer border',
                    active
                      ? 'bg-primary text-primary-foreground border-primary font-medium'
                      : 'bg-background border-border text-foreground hover:bg-muted',
                  )}
                >
                  #{tag}
                </button>
              );
            })}
            {selectedTag && (
              <button
                type="button"
                onClick={() => onSelectTag(null)}
                className="text-10 text-muted-foreground hover:text-foreground cursor-pointer underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
