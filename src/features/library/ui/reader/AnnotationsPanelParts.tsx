'use client';

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2, StickyNote, Trash2, X, Check, Edit3, FileText, Palette,
  Highlighter, Underline, Strikethrough, Scan, PenTool, Type, Sparkles,
  Copy, Link2, Quote, MoreHorizontal, MessageSquare,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Form } from '@/shared/components/ui/form';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import type { ReaderDocument, ReaderAnnotation, AnnotationFormData } from '@/features/library/types/reader.types';
import { annotationFormSchema } from '@/features/library/types/reader.types';
import { PdfAnnotationEngine, ANNOTATION_PALETTE_COLORS, formatAnnotationCitation } from '@/features/library/domain/reader.domain';

const ANNOTATION_COLOR_BY_HEX_MAP: ReadonlyMap<string, (typeof ANNOTATION_PALETTE_COLORS)[number]> = new Map(
  ANNOTATION_PALETTE_COLORS.map((c) => [c.hex.toLowerCase(), c]),
);
const ANNOTATION_COLOR_BY_ID_MAP: ReadonlyMap<string, (typeof ANNOTATION_PALETTE_COLORS)[number]> = new Map(
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

function AnnotationEditForm({
  initialQuote, initialComment, initialColor, initialPageLabel, initialTags = [], isSaving, onSave, onCancel,
}: {
  initialQuote?: string; initialComment?: string; initialColor?: string;
  initialPageLabel?: string | null; initialTags?: string[];
  isSaving: boolean; onSave: (data: AnnotationFormData) => Promise<void>; onCancel: () => void;
}) {
  const [tagText, setTagText] = useState((initialTags || []).join(', '));
  const [selectedColor, setSelectedColor] = useState(initialColor || '#ffd400');
  const form = useForm<AnnotationFormData>({
    resolver: zodResolver(annotationFormSchema),
    defaultValues: {
      quoteText: initialQuote || '', comment: initialComment || '',
      color: initialColor || '#ffd400', pageLabel: initialPageLabel || '', tags: initialTags,
    },
  });
  const { register, handleSubmit, setValue } = form;

  const handleFormSubmit = (data: AnnotationFormData) => {
    const parsedTags = tagText.split(',').map((t) => t.trim().replace(/^#/, '')).filter((t) => t.length > 0);
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
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => { setSelectedColor(c.hex); setValue('color', c.hex); }}
                      aria-label={c.label}
                      className={cn(
                        'size-3.5 rounded-full border border-border transition-colors cursor-pointer',
                        active && 'ring-2 ring-primary ring-offset-1',
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="text-11">{c.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <input
            {...register('pageLabel')} aria-label="Page label" placeholder="Page label..."
            className="w-20 bg-muted/60 rounded px-1.5 py-0.5 text-10 font-mono outline-none text-foreground placeholder:text-muted-foreground border border-border-subtle"
          />
        </div>
        <input
          {...register('quoteText')} aria-label="Quote text" placeholder="Quote text..."
          className="w-full bg-transparent text-12 font-medium outline-none text-foreground font-sans"
        />
        <textarea
          {...register('comment')} autoFocus aria-label="Comment" placeholder="Add comment..." rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleSubmit(handleFormSubmit)(); }
          }}
          className="w-full resize-none bg-muted/40 p-1.5 rounded-sm text-12 outline-none text-foreground leading-relaxed font-sans border border-border focus:border-primary transition-colors"
        />
        <input
          value={tagText} onChange={(e) => setTagText(e.target.value)} aria-label="Tags" placeholder="Tags (e.g. methodology, result)..."
          className="w-full bg-transparent text-11 font-mono outline-none text-foreground placeholder:text-muted-foreground border-t border-border-subtle pt-1"
        />
        <div className="flex justify-end gap-1">
          <Button
            type="button" variant="outline" size="sm" onClick={onCancel}
            className="h-7 text-11 px-2.5 cursor-pointer rounded-md border-border bg-background text-foreground hover:bg-muted relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            Cancel
          </Button>
          <Button
            type="submit" size="sm" disabled={isSaving}
            className="h-7 text-11 px-3 font-medium cursor-pointer rounded-md relative before:absolute before:-inset-1.5 md:before:hidden outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {isSaving ? <Loader2 className="size-3 animate-spin shrink-0" strokeWidth={1.5} /> : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface AnnotationsPanelCardProps {
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
  onJumpToPage: (pageIndex?: number, annotationId?: string, pageNumber?: number) => void;
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
  annotation, paper, scopeId, attachmentId, isEditing, isDeletingCurrent, isSelected, isUpdating,
  targetIds, onCardClick, onCardContextMenu, onJumpToPage, onStartEdit, onCancelEdit, onSaveEdit,
  onStartDelete, onCancelDelete, onConfirmDelete, onAddToNote, onAskAi, onBatchAddToNote,
  onBatchChangeColor, onChangeType, onBatchDelete,
}: AnnotationsPanelCardProps) {
  const safeColor = annotation.color || '#ffd400';
  const displayPage = annotation.pageLabel?.trim() || String((annotation.pageIndex ?? 0) + 1);
  const firstRect = annotation.rects?.[0];
  const areaImageDataUrl = firstRect?.imageDataUrl;
  const isTextMarkup =
    !annotation.type ||
    annotation.type === 'highlight' ||
    annotation.type === 'underline' ||
    annotation.type === 'strike' ||
    annotation.type === 'strikethrough';

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (isEditing) { e.preventDefault(); return; }
    const pageNumber = (annotation.pageIndex ?? 0) + 1;
    const citation = formatAnnotationCitation(
      paper, attachmentId || annotation.attachmentId, pageNumber, annotation.id, scopeId, annotation.pageLabel,
    );
    const quoteText = (annotation.quoteText || annotation.text || '').trim();
    const commentText = (annotation.comment || '').trim();
    const lines: string[] = [quoteText ? `> "${quoteText}" ${citation.markdown}` : `> ${citation.markdown}`];
    if (commentText) lines.push(commentText);
    const markdownPayload = lines.join('\n\n');
    try {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/x-flux-annotation', markdownPayload);
      e.dataTransfer.setData('text/plain', markdownPayload);
    } catch {
      // Ignore dataTransfer errors in restricted environments
    }
  };

  const handleCopyText = useCallback(() => {
    const textToCopy = (annotation.quoteText || annotation.text || annotation.comment || '').trim();
    if (!textToCopy) return;
    void navigator.clipboard.writeText(textToCopy);
    toast.success('Copied text to clipboard', { id: 'reader-clipboard' });
  }, [annotation.quoteText, annotation.text, annotation.comment]);

  const handleCopyCitation = useCallback(() => {
    const pageNumber = (annotation.pageIndex ?? 0) + 1;
    const citation = formatAnnotationCitation(
      paper, attachmentId || annotation.attachmentId, pageNumber, annotation.id, scopeId, annotation.pageLabel,
    );
    const quote = (annotation.quoteText || annotation.text || '').trim();
    void navigator.clipboard.writeText(quote ? `"${quote}" ${citation.label}` : citation.label);
    toast.success('Copied citation to clipboard', { id: 'reader-clipboard' });
  }, [paper, attachmentId, annotation, scopeId]);

  const handleCopyLink = useCallback(() => {
    const pageNumber = (annotation.pageIndex ?? 0) + 1;
    const citation = formatAnnotationCitation(
      paper, attachmentId || annotation.attachmentId, pageNumber, annotation.id, scopeId, annotation.pageLabel,
    );
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${citation.url}` : citation.url;
    void navigator.clipboard.writeText(fullUrl);
    toast.success('Copied deep link to clipboard', { id: 'reader-clipboard' });
  }, [paper, attachmentId, annotation, scopeId]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button" tabIndex={0} draggable={!isEditing} onDragStart={handleDragStart}
          onClick={(e) => onCardClick(e, annotation)} onContextMenu={() => onCardContextMenu(annotation)}
          className={cn(
            'group rounded-md border p-2 text-12 transition-colors relative cursor-pointer select-none outline-none',
            isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-border-hover bg-background',
          )}
        >
          {isEditing ? (
            <AnnotationEditForm
              initialQuote={annotation.quoteText} initialComment={annotation.comment}
              initialColor={annotation.color} initialPageLabel={annotation.pageLabel}
              initialTags={annotation.tags} isSaving={isUpdating}
              onSave={async (data) => { await onSaveEdit(annotation, data); }}
              onCancel={onCancelEdit}
            />
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1 text-11">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: safeColor }} />
                  <span
                    className="font-mono text-foreground hover:underline cursor-pointer tabular-nums font-medium"
                    onClick={(e) => { e.stopPropagation(); onJumpToPage(annotation.pageIndex, annotation.id, annotation.pageNumber); }}
                  >
                    p. {displayPage}
                  </span>
                  {annotation.type && annotation.type !== 'highlight' && (
                    <span className="inline-flex items-center gap-0.5 text-10 text-muted-foreground font-sans">
                      {annotation.type === 'underline' && <Underline className="size-2.5" />}
                      {(annotation.type === 'strike' || annotation.type === 'strikethrough') && <Strikethrough className="size-2.5" />}
                      {annotation.type === 'note' && <StickyNote className="size-2.5" />}
                      {(annotation.type === 'rect' || annotation.type === 'area' || annotation.type === 'image') && <Scan className="size-2.5" />}
                      {annotation.type === 'ink' && <PenTool className="size-2.5" />}
                      {annotation.type === 'text' && <Type className="size-2.5" />}
                    </span>
                  )}
                </div>

                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
                  {isDeletingCurrent ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button" onClick={() => onConfirmDelete(annotation)} aria-label="Confirm delete"
                        className="size-6 sm:size-5 rounded-md text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <Check className="size-3" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button" onClick={onCancelDelete} aria-label="Cancel"
                        className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <X className="size-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {onAskAi && (annotation.quoteText || annotation.comment) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onAskAi(annotation.quoteText || annotation.comment || '', (annotation.pageIndex ?? 0) + 1)}
                              aria-label="Ask AI"
                              className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                            >
                              <img src="/Chat.svg" alt="AI Assistant" className="size-3 rounded-full object-cover shrink-0" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6} className="text-11">Ask AI</TooltipContent>
                        </Tooltip>
                      )}
                      {(onAddToNote || onBatchAddToNote) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (onAddToNote) onAddToNote(annotation.quoteText || annotation.comment || '', (annotation.pageIndex ?? 0) + 1, annotation.id);
                                else if (onBatchAddToNote) onBatchAddToNote([annotation.id]);
                              }}
                              aria-label="Add to Note"
                              className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                            >
                              <FileText className="size-3" strokeWidth={1.5} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6} className="text-11">Add to Note</TooltipContent>
                        </Tooltip>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button" aria-label="More options"
                            className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          >
                            <MoreHorizontal className="size-3" strokeWidth={1.5} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-12 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
                          <DropdownMenuItem onClick={handleCopyText} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
                            <Copy className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                            <span className="flex-1">Copy Text</span>
                            <span className="text-10 text-muted-foreground font-mono">Ctrl+C</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleCopyCitation} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
                            <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                            <span>Copy Citation</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleCopyLink} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
                            <Link2 className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                            <span>Copy Link</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-1 border-t border-border" />

                          <DropdownMenuItem onClick={() => onStartEdit(annotation.id)} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
                            <Edit3 className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                            <span>Edit Comment</span>
                          </DropdownMenuItem>

                          {isTextMarkup && onChangeType && targetIds.length === 1 && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
                                <Highlighter className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                <span>Convert Type</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-40 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
                                {([['highlight', 'Highlight', Highlighter], ['underline', 'Underline', Underline], ['strike', 'Strikethrough', Strikethrough]] as const).map(([tVal, tLabel, TIcon]) => (
                                  <DropdownMenuItem
                                    key={tVal} onClick={() => void onChangeType(annotation, tVal)}
                                    className="flex items-center justify-between gap-2 cursor-pointer text-foreground px-2 py-1 rounded-sm hover:bg-muted text-11"
                                  >
                                    <div className="flex items-center gap-2">
                                      <TIcon className="size-3 shrink-0" strokeWidth={1.5} />
                                      <span>{tLabel}</span>
                                    </div>
                                    {(annotation.type || 'highlight') === tVal && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )}

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
                              <Palette className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                              <span>Change Color</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-36 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
                              {ANNOTATION_PALETTE_COLORS.map((c) => (
                                <DropdownMenuItem
                                  key={c.id} onClick={() => onBatchChangeColor?.(c.hex, targetIds)}
                                  className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1 rounded-sm hover:bg-muted text-11"
                                >
                                  <span className="size-3 rounded-full border border-border shrink-0" style={{ backgroundColor: c.hex }} />
                                  <span>{c.label}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator className="my-1 border-t border-border" />

                          <DropdownMenuItem
                            onClick={() => onStartDelete(annotation.id)} variant="destructive"
                            className="flex items-center gap-2 cursor-pointer text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded-sm text-12"
                          >
                            <Trash2 className="size-3.5 shrink-0 text-destructive" strokeWidth={1.5} />
                            <span className="flex-1">Delete Annotation</span>
                            <span className="text-10 text-destructive/80 font-mono">Del</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>

              {areaImageDataUrl && (
                <div className="rounded border border-border overflow-hidden bg-muted/40 my-1 p-1 flex items-center gap-1.5">
                  <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: safeColor }} />
                  <img src={areaImageDataUrl} alt="Selected area snapshot" className="max-h-36 w-full object-contain bg-background rounded-xs" />
                </div>
              )}

              {annotation.quoteText && (
                <div className="text-left w-full select-text flex items-start gap-2 pl-0.5">
                  <span className="w-1 self-stretch rounded-full shrink-0 my-0.5" style={{ backgroundColor: safeColor }} />
                  <p
                    className={cn(
                      'text-12 leading-snug text-foreground italic flex-1 min-w-0',
                      annotation.type === 'underline' && 'underline decoration-current',
                      (annotation.type === 'strike' || annotation.type === 'strikethrough') && 'line-through',
                    )}
                  >
                    &ldquo;{annotation.quoteText}&rdquo;
                  </p>
                </div>
              )}

              {!annotation.quoteText && !areaImageDataUrl && !annotation.comment && (
                <p className="text-11 text-muted-foreground pl-2 italic">
                  {annotation.type === 'note' ? 'Sticky Note' : annotation.type === 'ink' ? 'Freehand Ink Drawing' : annotation.type === 'rect' || annotation.type === 'area' ? 'Selected Area' : 'Highlight'}
                </p>
              )}

              {/* Comment field (Zotero parity: always accessible directly on card) */}
              {annotation.comment ? (
                <div
                  role="button" tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onStartEdit(annotation.id); }}
                  className="flex items-start gap-1.5 ml-2 mt-1.5 py-1 px-1.5 text-11 text-foreground/90 bg-muted/40 rounded-sm border border-border/80 cursor-pointer hover:bg-muted/70 transition-colors"
                >
                  <MessageSquare className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="leading-relaxed select-text flex-1 break-words">{annotation.comment}</p>
                </div>
              ) : (
                <button
                  type="button" onClick={(e) => { e.stopPropagation(); onStartEdit(annotation.id); }}
                  className="flex items-center gap-1.5 ml-2 mt-1.5 text-11 text-muted-foreground hover:text-foreground cursor-pointer transition-colors py-0.5 group/comment"
                >
                  <MessageSquare className="size-3 text-muted-foreground group-hover/comment:text-foreground shrink-0" strokeWidth={1.5} />
                  <span className="italic">Add comment...</span>
                </button>
              )}

              {annotation.tags && annotation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-2 pt-0.5">
                  {annotation.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-10 font-mono bg-background text-foreground border border-border">
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
            onClick={() => onAskAi(annotation.quoteText || annotation.comment || '', (annotation.pageIndex ?? 0) + 1)}
            className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted"
          >
            <img src="/Chat.svg" alt="AI Assistant" className="size-3.5 rounded-full object-cover shrink-0" />
            <span>Ask AI</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => {
            if (targetIds.length === 1 && onAddToNote) {
              onAddToNote(annotation.quoteText || annotation.comment || '', (annotation.pageIndex ?? 0) + 1, annotation.id);
            } else {
              onBatchAddToNote?.(targetIds);
            }
          }}
          className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted"
        >
          <StickyNote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>{targetIds.length > 1 ? `Add to Note (${targetIds.length})` : 'Add to Note'}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 border-t border-border" />

        <ContextMenuItem onClick={handleCopyText} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
          <Copy className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span className="flex-1">Copy Text</span>
          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyCitation} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
          <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Copy Citation</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyLink} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
          <Link2 className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Copy Link</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 border-t border-border" />

        <ContextMenuItem onClick={() => onStartEdit(annotation.id)} className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
          <Edit3 className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Edit Comment</span>
        </ContextMenuItem>

        {isTextMarkup && onChangeType && targetIds.length === 1 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted">
              <Highlighter className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Convert Type</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
              {([['highlight', 'Highlight', Highlighter], ['underline', 'Underline', Underline], ['strike', 'Strikethrough', Strikethrough]] as const).map(([tVal, tLabel, TIcon]) => (
                <ContextMenuItem
                  key={tVal} onClick={() => void onChangeType(annotation, tVal)}
                  className="flex items-center justify-between gap-2 cursor-pointer text-foreground px-2 py-1 rounded-sm hover:bg-muted text-11"
                >
                  <div className="flex items-center gap-2">
                    <TIcon className="size-3 shrink-0" strokeWidth={1.5} />
                    <span>{tLabel}</span>
                  </div>
                  {(annotation.type || 'highlight') === tVal && <Check className="size-3 text-primary shrink-0" strokeWidth={1.5} />}
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
                key={c.id} onClick={() => onBatchChangeColor?.(c.hex, targetIds)}
                className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1 rounded-sm hover:bg-muted text-11"
              >
                <span className="size-3 rounded-full border border-border shrink-0" style={{ backgroundColor: c.hex }} />
                <span>{c.label}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator className="my-1 border-t border-border" />

        <ContextMenuItem
          onClick={() => onBatchDelete?.(targetIds)} variant="destructive"
          className="flex items-center gap-2 cursor-pointer text-destructive hover:bg-destructive/10 px-2 py-1.5 rounded-sm text-12"
        >
          <Trash2 className="size-3.5 shrink-0 text-destructive" strokeWidth={1.5} />
          <span className="flex-1">{targetIds.length > 1 ? `Delete ${targetIds.length} Annotations` : 'Delete Annotation'}</span>
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

interface AnnotationsBottomSelectorDockProps {
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
    <div className="border-t border-border bg-background p-2 space-y-1.5 shrink-0 text-11 font-sans">
      {existingColors.length >= 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-10 font-medium text-muted-foreground">
            Colors:
          </span>
          <div className="flex items-center gap-1">
            {existingColors.map((c) => {
              const active = selectedColor.toLowerCase() === c.hex.toLowerCase();
              return (
                <Tooltip key={c.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelectColor(active ? 'all' : c.hex)}
                      aria-label={`${c.label} (${active ? 'Active' : 'Filter by this color'})`}
                      className={cn(
                        'size-4 rounded-full border border-border transition-colors cursor-pointer relative',
                        active && 'ring-2 ring-primary ring-offset-1',
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="text-11">
                    {c.label} {active ? '(Active)' : ''}
                  </TooltipContent>
                </Tooltip>
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
          <span className="text-10 font-medium text-muted-foreground">
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
