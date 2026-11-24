'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Loader2, StickyNote, Trash2, X, Plus, Check, Edit3, FileText, Palette,
  Highlighter, Underline, Strikethrough, Scan, PenTool, Type, Sparkles,
  Copy, Link2, Quote, MoreHorizontal, MessageSquare,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
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
import { READER_TOAST_IDS } from '@/features/library/sdk/queries/reader.queries';
import { copyToClipboard, cn } from '@/shared/lib/utils';
import type { ReaderDocument, ReaderAnnotation, AnnotationFormData } from '@/features/library/types/reader.types';
import { annotationFormSchema } from '@/features/library/types/reader.types';
import {
  PdfAnnotationEngine,
  ANNOTATION_PALETTE_COLORS,
  DEFAULT_ANNOTATION_COLOR,
  formatAnnotationCitation,
} from '@/features/library/domain/reader/reader';

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

function AnnotationCardCommentEditor({
  initialComment = '',
  initialTags = [],
  isSaving,
  onSave,
  onCancel,
}: {
  initialComment?: string;
  initialTags?: string[];
  isSaving: boolean;
  onSave: (comment: string, tags: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState(initialComment);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    if (textareaRef.current) {
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      void onSave(comment.trim(), tags);
    }
  };

  const handleTextareaBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (e.relatedTarget && containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    const trimmed = comment.trim();
    if (trimmed !== initialComment.trim() || tags.length !== initialTags.length) {
      void onSave(trimmed, tags);
    } else {
      onCancel();
    }
  };

  const handleAddTag = () => {
    const cleaned = newTagText.replace(/^#+/, '').trim();
    if (cleaned && !tags.includes(cleaned)) {
      const nextTags = [...tags, cleaned];
      setTags(nextTags);
      setNewTagText('');
      setIsAddingTag(false);
      void onSave(comment.trim(), nextTags);
      return;
    }
    setNewTagText('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    void onSave(comment.trim(), nextTags);
  };

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      className="space-y-1.5 mt-1 font-sans"
    >
      <textarea
        ref={textareaRef}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleTextareaBlur}
        placeholder="Add comment..."
        rows={2}
        className="w-full resize-none bg-background p-1.5 rounded-md text-12 outline-none text-foreground leading-relaxed font-sans border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground shadow-2xs"
      />

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-10 font-mono bg-muted/50 text-foreground border border-border/60"
          >
            <span>#{tag}</span>
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="text-muted-foreground hover:text-destructive cursor-pointer"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}

        {isAddingTag ? (
          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              autoFocus
              value={newTagText}
              onChange={(e) => setNewTagText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsAddingTag(false);
                  setNewTagText('');
                }
              }}
              onBlur={handleAddTag}
              placeholder="Tag name..."
              className="w-20 bg-background text-10 font-mono px-1.5 py-0.5 rounded border border-border/80 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/20"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingTag(true)}
            className="inline-flex items-center gap-0.5 text-10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors py-0.5 px-1 rounded hover:bg-muted/50"
          >
            <Plus className="size-2.5" />
            <span>Add tag</span>
          </button>
        )}
      </div>
    </div>
  );
}

function renderAnnotationTypeIcon(
  type: ReaderAnnotation['type'] | undefined,
  color: string,
) {
  const iconProps = { className: 'size-3.5 shrink-0', strokeWidth: 1.75 };
  let Icon = Highlighter;
  if (type === 'underline') Icon = Underline;
  else if (type === 'strike' || type === 'strikethrough') Icon = Strikethrough;
  else if (type === 'note') Icon = StickyNote;
  else if (type === 'rect' || type === 'area' || type === 'image') Icon = Scan;
  else if (type === 'ink') Icon = PenTool;
  else if (type === 'text') Icon = Type;

  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ color }}>
      <Icon {...iconProps} />
    </span>
  );
}

interface AnnotationsPanelCardProps {
  annotation: ReaderAnnotation;
  paper?: ReaderDocument;
  spaceId?: string;
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
  annotation, paper, spaceId, attachmentId, isEditing, isDeletingCurrent, isSelected, isUpdating,
  targetIds, onCardClick, onCardContextMenu, onJumpToPage, onStartEdit, onCancelEdit, onSaveEdit,
  onStartDelete, onCancelDelete, onConfirmDelete, onAddToNote, onAskAi, onBatchAddToNote,
  onBatchChangeColor, onChangeType, onBatchDelete,
}: AnnotationsPanelCardProps) {
  const safeColor = annotation.color || DEFAULT_ANNOTATION_COLOR;
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
      paper, attachmentId || annotation.attachmentId, pageNumber, annotation.id, spaceId, annotation.pageLabel,
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

  const handleCopyText = useCallback(async () => {
    const textToCopy = (annotation.quoteText || annotation.text || annotation.comment || '').trim();
    if (!textToCopy) return;
    const ok = await copyToClipboard(textToCopy);
    if (ok) toast.success('Copied', { id: READER_TOAST_IDS.clipboard });
    else toast.error('Copy failed', { id: READER_TOAST_IDS.clipboard });
  }, [annotation.quoteText, annotation.text, annotation.comment]);

  const handleCopyCitation = useCallback(async () => {
    const pageNumber = (annotation.pageIndex ?? 0) + 1;
    const citation = formatAnnotationCitation(
      paper, attachmentId || annotation.attachmentId, pageNumber, annotation.id, spaceId, annotation.pageLabel,
    );
    const quote = (annotation.quoteText || annotation.text || '').trim();
    const ok = await copyToClipboard(quote ? `"${quote}" ${citation.label}` : citation.label);
    if (ok) toast.success('Copied citation', { id: READER_TOAST_IDS.clipboard });
    else toast.error('Copy failed', { id: READER_TOAST_IDS.clipboard });
  }, [paper, attachmentId, annotation, spaceId]);

  const handleCopyLink = useCallback(async () => {
    const pageNumber = (annotation.pageIndex ?? 0) + 1;
    const citation = formatAnnotationCitation(
      paper, attachmentId || annotation.attachmentId, pageNumber, annotation.id, spaceId, annotation.pageLabel,
    );
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${citation.url}` : citation.url;
    const ok = await copyToClipboard(fullUrl);
    if (ok) toast.success('Copied link', { id: READER_TOAST_IDS.clipboard });
    else toast.error('Copy failed', { id: READER_TOAST_IDS.clipboard });
  }, [paper, attachmentId, annotation, spaceId]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button" tabIndex={0} draggable={!isEditing} onDragStart={handleDragStart}
          onClick={(e) => onCardClick(e, annotation)} onContextMenu={() => onCardContextMenu(annotation)}
          className={cn(
            'group rounded-md border overflow-hidden text-12 transition-all relative cursor-pointer select-none outline-none bg-background',
            isSelected
              ? 'border-primary/60 ring-1 ring-primary/25 shadow-xs'
              : 'border-border/80 hover:border-border-hover shadow-2xs',
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-1 px-2.5 py-1.5 border-b border-border/40">
                <div className="flex items-center gap-1.5 min-w-0">
                  {renderAnnotationTypeIcon(annotation.type, safeColor)}
                  <span
                    className="font-sans font-semibold text-12 text-foreground hover:underline cursor-pointer tabular-nums truncate"
                    onClick={(e) => { e.stopPropagation(); onJumpToPage(annotation.pageIndex, annotation.id, annotation.pageNumber); }}
                  >
                    Page {displayPage}
                  </span>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button" aria-label="More options"
                          className="size-6 sm:size-5 rounded-md text-foreground hover:bg-muted flex items-center justify-center cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 text-12 bg-popover border border-border shadow-raised-200 rounded-md p-1 z-50 font-sans">
                        {onAskAi && (annotation.quoteText || annotation.comment) && (
                          <DropdownMenuItem
                            onClick={() => onAskAi(annotation.quoteText || annotation.comment || '', (annotation.pageIndex ?? 0) + 1)}
                            className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted"
                          >
                            <img src="/Chat.svg" alt="AI Assistant" className="size-3.5 rounded-full object-cover shrink-0" />
                            <span>Ask AI</span>
                          </DropdownMenuItem>
                        )}
                        {(onAddToNote || onBatchAddToNote) && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (onAddToNote) onAddToNote(annotation.quoteText || annotation.comment || '', (annotation.pageIndex ?? 0) + 1, annotation.id);
                              else if (onBatchAddToNote) onBatchAddToNote([annotation.id]);
                            }}
                            className="flex items-center gap-2 cursor-pointer text-foreground px-2 py-1.5 rounded-sm hover:bg-muted"
                          >
                            <FileText className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                            <span>{targetIds.length > 1 ? `Add to Note (${targetIds.length})` : 'Add to Note'}</span>
                          </DropdownMenuItem>
                        )}
                        {((onAskAi && (annotation.quoteText || annotation.comment)) || onAddToNote || onBatchAddToNote) && (
                          <DropdownMenuSeparator className="my-1 border-t border-border" />
                        )}

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
                  )}
                </div>
              </div>

              <div className="px-2.5 py-2 space-y-1.5">
              {areaImageDataUrl && (
                <div className="rounded border border-border overflow-hidden bg-muted/40 p-1 flex items-center gap-1.5">
                  <span className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: safeColor }} />
                  <img src={areaImageDataUrl} alt="Selected area snapshot" className="max-h-36 w-full object-contain bg-background rounded-xs" />
                </div>
              )}

              {annotation.quoteText && (
                <div className="text-left w-full select-text flex items-start gap-2">
                  <span className="w-0.5 self-stretch rounded-full shrink-0 my-0.5" style={{ backgroundColor: safeColor }} />
                  <p
                    className={cn(
                      'font-sans text-12 leading-snug text-foreground/80 flex-1 min-w-0',
                      !isSelected && 'line-clamp-3',
                      annotation.type === 'underline' && 'underline decoration-current',
                      (annotation.type === 'strike' || annotation.type === 'strikethrough') && 'line-through',
                    )}
                  >
                    {annotation.quoteText}
                  </p>
                </div>
              )}

              {!annotation.quoteText && !areaImageDataUrl && !annotation.comment && !isEditing && (
                <p className="text-11 text-muted-foreground pl-2">
                  {annotation.type === 'note' ? 'Sticky Note' : annotation.type === 'ink' ? 'Freehand Ink Drawing' : annotation.type === 'rect' || annotation.type === 'area' ? 'Selected Area' : 'Highlight'}
                </p>
              )}

              {isEditing ? (
                <AnnotationCardCommentEditor
                  initialComment={annotation.comment || ''}
                  initialTags={annotation.tags || []}
                  isSaving={isUpdating}
                  onSave={async (newComment, newTags) => {
                    await onSaveEdit(annotation, {
                      quoteText: annotation.quoteText,
                      comment: newComment,
                      color: annotation.color,
                      pageLabel: annotation.pageLabel || undefined,
                      tags: newTags,
                    });
                  }}
                  onCancel={onCancelEdit}
                />
              ) : (
                <>
                  {/* Comment field (Zotero 7 parity: visible when selected or when comment exists) */}
                  {annotation.comment ? (
                    <div
                      role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onStartEdit(annotation.id); }}
                      className="flex items-start gap-1.5 mt-1 py-1 px-1.5 text-11 text-foreground/90 bg-muted/30 rounded-md border border-border/40 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <MessageSquare className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="leading-relaxed select-text flex-1 break-words">{annotation.comment}</p>
                    </div>
                  ) : isSelected ? (
                    <button
                      type="button" onClick={(e) => { e.stopPropagation(); onStartEdit(annotation.id); }}
                      className="flex items-center gap-1.5 mt-1 text-11 text-muted-foreground hover:text-foreground cursor-pointer transition-colors py-0.5 group/comment"
                    >
                      <MessageSquare className="size-3 text-muted-foreground group-hover/comment:text-foreground shrink-0" strokeWidth={1.5} />
                      <span>Add comment...</span>
                    </button>
                  ) : null}

                  {annotation.tags && annotation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {annotation.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-10 font-mono bg-muted/40 text-foreground/80 border border-border/50">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
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
            Labels:
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
