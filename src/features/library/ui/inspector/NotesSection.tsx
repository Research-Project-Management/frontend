"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  MinusCircle,
  Plus,
  StickyNote,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Pencil,
  Loader2,
} from "lucide-react";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  normalizeNotes,
  type NormalizedNote,
} from "@/features/library/domain/metadata";
import { useNotes } from "@/features/library/sdk/queries/tags-notes.queries";
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";
import type { Item } from "@/features/library/domain/types/library.types";
import {
  FormattedNoteBody,
  NoteFormattingToolbar,
} from "./NoteMarkdownEditor";

export interface NotesSectionProps {
  item?: Item;
  scopeId?: string;
  hideHeader?: boolean;
  forceAdding?: boolean;
  onCancelAdding?: () => void;
  canEdit?: boolean;
  pendingText?: string;
  onClearPendingText?: () => void;
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void;
}

export function NoteIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <StickyNote
      className={cn("size-3.5 shrink-0 text-foreground", className)}
      strokeWidth={1.5}
    />
  );
}

export default function NotesSection(props: NotesSectionProps) {
  const { item } = props;
  if (!item) return null;
  return <NotesSectionContent {...props} item={item} />;
}

function NotesSectionContent({
  item: paper,
  scopeId,
  hideHeader = false,
  forceAdding = false,
  onCancelAdding,
  canEdit = true,
  pendingText,
  onClearPendingText,
  onNavigateToAnnotation,
}: NotesSectionProps & { item: Item }) {
  const paperId = paper.id;
  const activeScopeId = scopeId || paper?.projectId || "user";
  const [isAdding, setIsAdding] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(
    () => new Set(),
  );

  const newTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (forceAdding && canEdit) {
      setIsAdding(true);
    }
  }, [forceAdding, canEdit]);

  useEffect(() => {
    if (pendingText && canEdit) {
      setIsAdding(true);
      setNewNoteContent((prev) =>
        prev ? `${prev}\n\n${pendingText}` : pendingText,
      );
      onClearPendingText?.();
    }
  }, [pendingText, canEdit, onClearPendingText]);

  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const {
    notes: canonicalNotes,
    createNote,
    updateNote,
    deleteNote,
    extractFromAnnotations,
    isExtractingFromAnnotations,
  } = useNotes(activeScopeId, paper.id);

  // Reset internal interactive state when switching papers to avoid state leakage
  useEffect(() => {
    setIsAdding(false);
    setNewNoteContent("");
    setEditingNoteId(null);
    setEditingContent("");
    setExpandedNoteIds(new Set());
  }, [paperId]);

  const notes: NormalizedNote[] = useMemo(() => {
    if (canonicalNotes && canonicalNotes.length > 0) {
      return normalizeNotes(canonicalNotes);
    }
    const normalizedExistingNotes = normalizeNotes(paper.notes);
    if (normalizedExistingNotes.length > 0) {
      return normalizedExistingNotes;
    }
    return [];
  }, [canonicalNotes, paper.notes]);

  const toggleExpandNote = (id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExtractFromAnnotations = async () => {
    try {
      await extractFromAnnotations({
        includeComments: true,
        tagColor: true,
      });
    } catch (caughtError) {
      logger.error("Failed to extract notes from annotations", caughtError);
    }
  };

  const handleSaveNewNote = async () => {
    const trimmedContent = newNoteContent.trim();
    if (!trimmedContent) return;

    try {
      await createNote({ itemId: paper.id, contentMd: trimmedContent });
      setNewNoteContent("");
      setIsAdding(false);
      onCancelAdding?.();
    } catch {
      toast.error("Failed to create note", { id: "note-create-error" });
    }
  };

  const handleStartEdit = (selectedNote: NormalizedNote) => {
    setEditingNoteId(selectedNote.id);
    setEditingContent(selectedNote.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    const trimmedContent = editingContent.trim();
    if (!trimmedContent) return;

    const targetNote = canonicalNotes.find(
      (singleNote) => singleNote.id === noteId,
    );
    if (targetNote) {
      try {
        await updateNote(noteId, targetNote.version || 1, {
          contentMd: trimmedContent,
        });
      } catch (caughtError) {
        logger.error("Failed to update note", caughtError);
      }
    }
    setEditingNoteId(null);
    setEditingContent("");
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent("");
  };

  if (notes.length === 0 && !isAdding && hideHeader && !canEdit) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 min-w-0 font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-12 font-medium text-foreground">Notes</h3>
          {canEdit && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleExtractFromAnnotations}
                    disabled={isExtractingFromAnnotations}
                    className="h-5 px-1.5 flex items-center gap-1 rounded text-10 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors disabled:opacity-50"
                    aria-label="Add note from PDF annotations"
                  >
                    {isExtractingFromAnnotations ? (
                      <Loader2 className="size-3 animate-spin shrink-0" />
                    ) : (
                      <Sparkles className="size-3 shrink-0" />
                    )}
                    <span>From Highlights</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Generate structured note from PDF highlights &amp; annotations
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="size-5 flex items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer transition-colors"
                    aria-label="Add note"
                  >
                    <Plus
                      className="size-3.5 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Add note</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      )}

      {/* Quick Action Bar when header is hidden by parent InspectorSection */}
      {hideHeader && canEdit && notes.length > 0 && !isAdding && (
        <div className="flex items-center justify-between gap-1 pb-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleExtractFromAnnotations}
                disabled={isExtractingFromAnnotations}
                className="h-6 px-2 flex items-center gap-1.5 rounded-md text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors disabled:opacity-50"
              >
                {isExtractingFromAnnotations ? (
                  <Loader2 className="size-3 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="size-3 shrink-0 text-primary" />
                )}
                <span>Add Note from Annotations</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Compile all PDF highlights and comments into a structured note
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Add New Note Box (Rich Markdown Editor) */}
      {isAdding && (
        <div className="space-y-1 p-2.5 bg-background rounded-md border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-ring transition-colors text-xs">
          <NoteFormattingToolbar
            textareaRef={newTextareaRef}
            value={newNoteContent}
            onChange={setNewNoteContent}
            onSave={handleSaveNewNote}
            onCancel={() => {
              setIsAdding(false);
              setNewNoteContent("");
              onCancelAdding?.();
            }}
          />
          <Textarea
            ref={newTextareaRef}
            autoFocus
            placeholder="Write a research note... (Supports **bold**, *italic*, ### headings, - lists, > quotes)"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (newNoteContent.trim()) {
                  handleSaveNewNote();
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsAdding(false);
                setNewNoteContent("");
                onCancelAdding?.();
              }
            }}
            rows={4}
            className="text-xs resize-y w-full min-h-[76px] max-h-60 overflow-y-auto border-0 focus-visible:ring-0 p-0 bg-transparent rounded-none outline-none shadow-none placeholder:text-muted-foreground leading-relaxed"
          />
          <div className="flex items-center justify-between text-10 font-normal text-muted-foreground select-none pt-1 border-t border-border font-mono">
            <span>Markdown formatting supported</span>
            <span>Ctrl+Enter to save · Esc to cancel</span>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 && !isAdding ? (
        <div className="py-3 px-2.5 text-center text-11 text-muted-foreground flex flex-col items-center justify-center gap-2 font-sans">
          <span>No notes for this reference yet.</span>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(true)}
                className="h-6 text-11 text-foreground hover:bg-muted px-2 gap-1 cursor-pointer font-normal"
              >
                <Plus className="size-3 text-foreground" strokeWidth={1.5} />
                <span>Add note</span>
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExtractFromAnnotations}
                    disabled={isExtractingFromAnnotations}
                    className="h-6 text-11 text-foreground hover:bg-muted px-2 gap-1 cursor-pointer font-normal"
                  >
                    {isExtractingFromAnnotations ? (
                      <Loader2 className="size-3 animate-spin shrink-0" />
                    ) : (
                      <Sparkles className="size-3 text-primary shrink-0" />
                    )}
                    <span>From PDF Highlights</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Automatically extract all PDF highlights and comments into a note
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 min-w-0">
          {notes.map((n) => {
            const isEditing = editingNoteId === n.id;
            const isExpanded = expandedNoteIds.has(n.id);
            const isLongNote =
              n.content.split("\n").length > 3 || n.content.length > 180;

            if (isEditing) {
              return (
                <div
                  key={n.id}
                  className="space-y-1 p-2.5 bg-background rounded-md border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors text-xs"
                >
                  <NoteFormattingToolbar
                    textareaRef={editTextareaRef}
                    value={editingContent}
                    onChange={setEditingContent}
                    onSave={() => handleSaveEdit(n.id)}
                    onCancel={handleCancelEdit}
                  />
                  <Textarea
                    ref={editTextareaRef}
                    autoFocus
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (editingContent.trim()) {
                          handleSaveEdit(n.id);
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    rows={5}
                    className="text-xs resize-y w-full min-h-[84px] max-h-64 overflow-y-auto border-0 focus-visible:ring-0 p-0 bg-transparent rounded-none outline-none shadow-none placeholder:text-muted-foreground leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-10 font-normal text-muted-foreground select-none pt-1 border-t border-border font-mono">
                    <span>Markdown formatting supported</span>
                    <span>Ctrl+Enter to save · Esc to cancel</span>
                  </div>
                </div>
              );
            }

            const pageMatches = Array.from(
              n.content.matchAll(/(?:p\.|page)\s*(\d+)/gi),
            );
            const firstPageNum =
              pageMatches.length > 0 ? parseInt(pageMatches[0][1], 10) : null;

            return (
              <div
                key={n.id}
                className={cn(
                  "group/note flex flex-col gap-1 px-2.5 py-2 rounded-md border border-border/60 bg-background/50 hover:bg-muted/40 transition-colors text-xs min-w-0",
                )}
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div
                    onClick={() => {
                      if (isLongNote) {
                        toggleExpandNote(n.id);
                      } else if (canEdit) {
                        handleStartEdit(n);
                      }
                    }}
                    className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="size-4 mt-0.5 shrink-0 flex items-center justify-center">
                      <NoteIcon className="size-3.5 text-foreground shrink-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <FormattedNoteBody
                        content={n.content}
                        isExpanded={isExpanded}
                      />
                    </div>
                  </div>

                  {/* Action Cluster: Page Jump, Edit, Expand, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    {onNavigateToAnnotation && firstPageNum !== null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToAnnotation(firstPageNum);
                            }}
                            className="text-10 font-medium text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 shrink-0 cursor-pointer"
                          >
                            p. {firstPageNum}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{`Jump to page ${firstPageNum}`}</TooltipContent>
                      </Tooltip>
                    )}

                    {isLongNote && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandNote(n.id);
                            }}
                            className="size-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                            aria-label={
                              isExpanded ? "Collapse note" : "Expand note"
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-3.5 shrink-0" />
                            ) : (
                              <ChevronDown className="size-3.5 shrink-0" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {isExpanded ? "Collapse note" : "Expand full note"}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {canEdit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(n);
                            }}
                            className="invisible group-hover/note:visible max-md:visible size-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                            aria-label="Edit note"
                          >
                            <Pencil className="size-3 shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Edit note</TooltipContent>
                      </Tooltip>
                    )}

                    {canEdit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (deleteNote) {
                                const target = canonicalNotes.find(
                                  (cn) => cn.id === n.id,
                                );
                                deleteNote(n.id, target?.version);
                              }
                            }}
                            className="invisible group-hover/note:visible max-md:visible size-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                            aria-label="Delete note"
                          >
                            <MinusCircle className="size-3.5 shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Delete note</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
