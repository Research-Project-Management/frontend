'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2, StickyNote, Trash2, X, Check, Edit3, FileText, Palette,
  Highlighter, Underline, Strikethrough, Scan, PenTool, Type, Sparkles,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Form } from '@/shared/components/ui/form';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import type { ReaderDocument, ReaderAnnotation, AnnotationFormData } from '@/features/library/domain/types/reader.schema';
import { annotationFormSchema } from '@/features/library/domain/types/reader.schema';
import { PdfAnnotationEngine, ANNOTATION_PALETTE_COLORS, formatAnnotationCitation } from '@/features/library/domain/reader.domain';

export const ANNOTATION_COLOR_BY_HEX_MAP: ReadonlyMap<string, (typeof ANNOTATION_PALETTE_COLORS)[number]> = new Map(
  ANNOTATION_PALETTE_COLORS.map((c) => [c.hex.toLowerCase(), c]),
);
export const ANNOTATION_COLOR_BY_ID_MAP: ReadonlyMap<string, (typeof ANNOTATION_PALETTE_COLORS)[number]> = new Map(
  ANNOTATION_PALETTE_COLORS.map((c) => [c.id.toLowerCase(), c]),
);

export function extractAnnotationFacets(annotations: ReaderAnnotation[]): {
  existingColors: Array<(typeof ANNOTATION_PALETTE_COLORS)[number]>;
  existingTags: string[];
  availableAuthors: string[];
} {
  const colorMap = new Map<string, (typeof ANNOTATION_PALETTE_COLORS)[number]>();
  const tagSet = new Set<string>();
  const authorSet = new Set<string>();

  for (const a of annotations) {
    const resolvedId = PdfAnnotationEngine.resolveColorId(a.color);
    const canonicalColorHex = PdfAnnotationEngine.getColorConfig(resolvedId).border.toLowerCase();
    const match = ANNOTATION_COLOR_BY_ID_MAP.get(resolvedId) ?? ANNOTATION_COLOR_BY_HEX_MAP.get(canonicalColorHex);
    if (match && !colorMap.has(match.id)) colorMap.set(match.id, match);
    for (const t of a.tags ?? []) if (t && t.trim()) tagSet.add(t.trim());
    if (a.authorId) authorSet.add(a.authorId);
  }
  return { existingColors: Array.from(colorMap.values()), existingTags: Array.from(tagSet), availableAuthors: Array.from(authorSet) };
}

export function computeRangeSelectedAnnotationIds(
  filteredAnnotations: ReaderAnnotation[],
  selectedIds: ReadonlySet<string>,
  lastSelectedId: string,
  targetId: string,
): Set<string> | null {
  const idx1 = filteredAnnotations.findIndex((a) => a.id === lastSelectedId);
  const idx2 = filteredAnnotations.findIndex((a) => a.id === targetId);
  if (idx1 === -1 || idx2 === -1) return null;
  const next = new Set(selectedIds);
  for (let i = Math.min(idx1, idx2); i <= Math.max(idx1, idx2); i++) next.add(filteredAnnotations[i].id);
  return next;
}

export function filterAndSortAnnotations(
  annotations: ReaderAnnotation[],
  params: { searchQuery: string; selectedColor: string; selectedTag: string | null; authorFilter: string; typeFilter?: string; sortBy: 'position' | 'newest' | 'oldest' | 'color' },
): ReaderAnnotation[] {
  const filtered = PdfAnnotationEngine.filterAnnotations(annotations, {
    query: params.searchQuery, color: params.selectedColor, tag: params.selectedTag, authorId: params.authorFilter, type: params.typeFilter,
  });
  return params.sortBy === 'position' ? PdfAnnotationEngine.sortAnnotations(filtered) : PdfAnnotationEngine.sortAnnotationsByMode(filtered, params.sortBy);
}

export function AnnotationEditForm({
  initialQuote,
  initialComment,
  initialColor,
  initialPageLabel,
  initialTags = [],
  isSaving,
  onSave,
  onCancel,
}: {
  initialQuote?: string;
  initialComment?: string;
  initialColor?: string;
  initialPageLabel?: string | null;
  initialTags?: string[];
  isSaving: boolean;
  onSave: (data: AnnotationFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [tagText, setTagText] = useState((initialTags || []).join(', '));
  const [selectedColor, setSelectedColor] = useState(initialColor || '#ffd400');
  const form = useForm<AnnotationFormData>({
    resolver: zodResolver(annotationFormSchema),
    defaultValues: {
      quoteText: initialQuote || '',
      comment: initialComment || '',
      color: initialColor || '#ffd400',
      pageLabel: initialPageLabel || '',
      tags: initialTags,
    },
  });

  const { register, handleSubmit, setValue } = form;

  const handleFormSubmit = (data: AnnotationFormData) => {
    const parsedTags = tagText
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);
    return onSave({ ...data, color: selectedColor, tags: parsedTags });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        onClick={(e) => e.stopPropagation()}
        className="space-y-2 rounded-md border border-border p-2 bg-background font-sans"
      >
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-border-subtle">
          <div className="flex items-center gap-1">
            {ANNOTATION_PALETTE_COLORS.map((c) => {
              const active = selectedColor.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedColor(c.hex);
                    setValue('color', c.hex);
                  }}
                  title={c.label}
                  className={cn(
                    'size-3.5 rounded-full border border-border transition-colors cursor-pointer',
                    active && 'ring-2 ring-primary ring-offset-1',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
          <input
            {...register('pageLabel')}
            aria-label="Page label"
            placeholder="Page label..."
            className="w-20 bg-muted/60 rounded px-1.5 py-0.5 text-10 font-mono outline-none text-foreground placeholder:text-muted-foreground border border-border-subtle"
          />
        </div>
        <input
          {...register('quoteText')}
          aria-label="Quote text"
          placeholder="Quote text..."
          className="w-full bg-transparent text-12 font-medium outline-none text-foreground font-sans"
        />
        <textarea
          {...register('comment')}
          aria-label="Comment"
          placeholder="Add a note/comment..."
          rows={2}
          className="w-full resize-none bg-transparent text-12 outline-none text-foreground leading-relaxed font-sans"
        />
        <input
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          aria-label="Tags"
          placeholder="Tags (e.g. methodology, result)..."
          className="w-full bg-transparent text-11 font-mono outline-none text-foreground placeholder:text-muted-foreground border-t border-border-subtle pt-1"
        />
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-11 px-2.5 cursor-pointer rounded-md border-border bg-background text-foreground hover:bg-muted relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-7 text-11 px-3 font-medium cursor-pointer rounded-md relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} /> : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export interface AnnotationsPanelCardProps {
  annotation: ReaderAnnotation;
  paper?: ReaderDocument;
  scopeId?: string;
  attachmentId?: string;
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
  onAddToNote?: (text: string, pageNumber?: number, annotationId?: string) => void;
  onAskAi?: (text: string, pageNumber?: number) => void;
  onBatchAddToNote?: (targetIds?: string[]) => void;
  onBatchChangeColor?: (colorHex: string, targetIds?: string[]) => Promise<void>;
  onChangeType?: (
    annotation: ReaderAnnotation,
    nextType: 'highlight' | 'underline' | 'strike',
  ) => Promise<void> | void;
  onBatchDelete?: (targetIds?: string[]) => Promise<void>;
}

export const AnnotationsPanelCard = React.memo(function AnnotationsPanelCard({
  annotation,
  paper,
  scopeId,
  attachmentId,
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
  onAskAi,
  onBatchAddToNote,
  onBatchChangeColor,
  onChangeType,
  onBatchDelete,
}: AnnotationsPanelCardProps) {
  const safeColor = annotation.color || '#ffd400';
  const displayPage =
    annotation.pageLabel?.trim() || String((annotation.pageIndex ?? 0) + 1);
  const firstRect = annotation.rects?.[0];
  const areaImageDataUrl = firstRect?.imageDataUrl;
  const isTextMarkup =
    !annotation.type ||
    annotation.type === 'highlight' ||
    annotation.type === 'underline' ||
    annotation.type === 'strike' ||
    annotation.type === 'strikethrough';

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (isEditing) {
      e.preventDefault();
      return;
    }
    const pageNumber = (annotation.pageIndex ?? 0) + 1;
    const citation = formatAnnotationCitation(
      paper,
      attachmentId || annotation.attachmentId,
      pageNumber,
      annotation.id,
      scopeId,
      annotation.pageLabel,
    );
    const quoteText = (annotation.quoteText || annotation.text || '').trim();
    const commentText = (annotation.comment || '').trim();
    const lines: string[] = [];
    if (quoteText) {
      lines.push(`> "${quoteText}" ${citation.markdown}`);
    } else {
      lines.push(`> ${citation.markdown}`);
    }
    if (commentText) {
      lines.push(commentText);
    }
    const markdownPayload = lines.join('\n\n');
    try {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/x-flux-annotation', markdownPayload);
      e.dataTransfer.setData('text/plain', markdownPayload);
    } catch {
      // Ignore dataTransfer errors in restricted environments
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          draggable={!isEditing}
          onDragStart={handleDragStart}
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
              initialPageLabel={annotation.pageLabel}
              initialTags={annotation.tags}
              isSaving={isUpdating}
              onSave={async (data) => {
                await onSaveEdit(annotation, data);
              }}
              onCancel={onCancelEdit}
            />
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1 text-11">
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: safeColor }}
                  />
                  <span
                    className="font-mono text-foreground hover:underline cursor-pointer tabular-nums font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToPage(annotation.pageIndex, annotation.id);
                    }}
                  >
                    P. {displayPage}
                  </span>
                  {annotation.type && annotation.type !== 'highlight' && (
                    <span className="inline-flex items-center gap-0.5 text-10 text-muted-foreground font-sans">
                      {annotation.type === 'underline' && <Underline className="size-2.5" />}
                      {(annotation.type === 'strike' || annotation.type === 'strikethrough') && (
                        <Strikethrough className="size-2.5" />
                      )}
                      {annotation.type === 'note' && <StickyNote className="size-2.5" />}
                      {(annotation.type === 'rect' ||
                        annotation.type === 'area' ||
                        annotation.type === 'image') && <Scan className="size-2.5" />}
                      {annotation.type === 'ink' && <PenTool className="size-2.5" />}
                      {annotation.type === 'text' && <Type className="size-2.5" />}
                    </span>
                  )}
                </div>

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
                      {onAskAi && (annotation.quoteText || annotation.comment) && (
                        <button
                          type="button"
                          onClick={() => {
                            onAskAi(
                              annotation.quoteText || annotation.comment || '',
                              (annotation.pageIndex ?? 0) + 1,
                            );
                          }}
                          aria-label="Ask AI"
                          className="size-6 sm:size-5 rounded-md text-ai hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          title="Ask AI"
                        >
                          <Sparkles className="size-3 text-ai shrink-0" strokeWidth={1.5} />
                        </button>
                      )}
                      {(onAddToNote || onBatchAddToNote) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onAddToNote) {
                              onAddToNote(
                                annotation.quoteText || annotation.comment || '',
                                (annotation.pageIndex ?? 0) + 1,
                                annotation.id,
                              );
                            } else if (onBatchAddToNote) {
                              onBatchAddToNote([annotation.id]);
                            }
                          }}
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

              {areaImageDataUrl && (
                <div className="rounded border border-border overflow-hidden bg-muted/40 my-1 p-1 flex items-center gap-1.5">
                  <span
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: safeColor }}
                  />
                  <img
                    src={areaImageDataUrl}
                    alt="Selected area snapshot"
                    className="max-h-36 w-full object-contain bg-background rounded-xs"
                  />
                </div>
              )}

              {annotation.quoteText && (
                <div className="text-left w-full select-text flex items-start gap-2 pl-0.5">
                  <span
                    className="w-1 self-stretch rounded-full shrink-0 my-0.5"
                    style={{ backgroundColor: safeColor }}
                  />
                  <p
                    className={cn(
                      'text-12 leading-snug text-foreground italic flex-1 min-w-0',
                      annotation.type === 'underline' && 'underline decoration-current',
                      (annotation.type === 'strike' || annotation.type === 'strikethrough') &&
                        'line-through',
                    )}
                  >
                    &ldquo;{annotation.quoteText}&rdquo;
                  </p>
                </div>
              )}

              {!annotation.quoteText && !areaImageDataUrl && !annotation.comment && (
                <p className="text-11 text-muted-foreground pl-2 italic">
                  {annotation.type === 'note'
                    ? 'Sticky Note'
                    : annotation.type === 'ink'
                      ? 'Freehand Ink Drawing'
                      : annotation.type === 'rect' || annotation.type === 'area'
                        ? 'Selected Area'
                        : 'Highlight'}
                </p>
              )}

              {annotation.comment && (
                <p className="text-11 text-foreground pl-2 leading-relaxed select-text">
                  {annotation.comment}
                </p>
              )}

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

      <ContextMenuContent className="w-52 text-12 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
        {onAskAi && (annotation.quoteText || annotation.comment) && (
          <ContextMenuItem
            onClick={() =>
              onAskAi(
                annotation.quoteText || annotation.comment || '',
                (annotation.pageIndex ?? 0) + 1,
              )
            }
            className="flex items-center gap-2 cursor-pointer text-ai px-2 py-1.5 rounded-sm hover:bg-muted"
          >
            <Sparkles className="size-3.5 text-ai shrink-0" strokeWidth={1.5} />
            <span>Ask AI</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => {
            if (targetIds.length === 1 && onAddToNote) {
              onAddToNote(
                annotation.quoteText || annotation.comment || '',
                (annotation.pageIndex ?? 0) + 1,
                annotation.id,
              );
            } else {
              onBatchAddToNote?.(targetIds);
            }
          }}
          className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted"
        >
          <FileText className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>
            {targetIds.length > 1
              ? `Add to Note (${targetIds.length})`
              : 'Add to Note'}
          </span>
        </ContextMenuItem>

        {isTextMarkup && onChangeType && targetIds.length === 1 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
              <Highlighter className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Convert Type</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
              {(
                [
                  ['highlight', 'Highlight', Highlighter],
                  ['underline', 'Underline', Underline],
                  ['strike', 'Strikethrough', Strikethrough],
                ] as const
              ).map(([tVal, tLabel, TIcon]) => (
                <ContextMenuItem
                  key={tVal}
                  onClick={() => void onChangeType(annotation, tVal)}
                  className="flex items-center justify-between gap-2 cursor-pointer text-foreground px-2 py-1 rounded-sm hover:bg-muted text-11"
                >
                  <div className="flex items-center gap-2">
                    <TIcon className="size-3 shrink-0" strokeWidth={1.5} />
                    <span>{tLabel}</span>
                  </div>
                  {(annotation.type || 'highlight') === tVal && (
                    <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />
                  )}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

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
});

export interface AnnotationsBottomSelectorDockProps {
  existingColors: Array<{ id: string; label: string; hex: string }>;
  existingTags: string[];
  selectedColor: string;
  selectedTag: string | null;
  onSelectColor: (color: string) => void;
  onSelectTag: (tag: string | null) => void;
}

export const AnnotationsBottomSelectorDock = React.memo(function AnnotationsBottomSelectorDock({
  existingColors,
  existingTags,
  selectedColor,
  selectedTag,
  onSelectColor,
  onSelectTag,
}: AnnotationsBottomSelectorDockProps) {
  if (existingColors.length === 0 && existingTags.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-border bg-muted p-2 space-y-1.5 shrink-0 text-11 font-sans">
      {existingColors.length >= 1 && (
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
});
