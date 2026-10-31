"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  MinusCircle,
  Plus,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Pencil,
  Loader2,
  FileText,
} from "lucide-react";
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
import {
  useLibraryCommandStore,
  createAddNoteCommand,
  createUpdateNoteCommand,
  createDeleteNoteCommand,
} from "@/features/library/core/manager/library-command.manager";
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";
import type { Item } from "@/features/library/domain/types/library.types";
import {
  FormattedNoteBody,
  NoteEditorBox,
  getNoteDisplayTitle,
  getNotePreviewSnippet,
  extractStructuredDeepLinksFromMarkdown,
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
  isReader?: boolean;
  onRegisterExtract?: (register: {
    extract: () => Promise<void>;
    isExtracting: boolean;
  }) => void;
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
  isReader = false,
  onRegisterExtract,
}: NotesSectionProps & { item: Item }) {
  const paperId = paper.id;
  const activeScopeId = scopeId || paper?.projectId || "user";
  const [isAdding, setIsAdding] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(
    () => new Set(),
  );

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

  // Preserve drafts per paperId across item switches to prevent data loss
  const noteDraftsByPaperRef = useRef<Record<string, { newNote: string; editingNoteId: string | null; editingContent: string }>>({});
  const prevPaperIdRef = useRef(paperId);

  const {
    notes: canonicalNotes,
    createNote,
    updateNote,
    deleteNote,
    extractFromAnnotations,
    isExtractingFromAnnotations,
  } = useNotes(activeScopeId, paper.id);
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);

  // Safely persist draft of previous paper and restore draft of active paper
  useEffect(() => {
    if (prevPaperIdRef.current !== paperId) {
      if (prevPaperIdRef.current) {
        noteDraftsByPaperRef.current[prevPaperIdRef.current] = {
          newNote: newNoteContent,
          editingNoteId,
          editingContent,
        };
      }
      const restored = noteDraftsByPaperRef.current[paperId];
      if (restored) {
        setNewNoteContent(restored.newNote || "");
        setEditingNoteId(restored.editingNoteId || null);
        setEditingContent(restored.editingContent || "");
        setIsAdding(Boolean(restored.newNote?.trim()));
      } else {
        setIsAdding(false);
        setNewNoteContent("");
        setEditingNoteId(null);
        setEditingContent("");
      }
      setExpandedNoteIds(new Set());
      prevPaperIdRef.current = paperId;
    }
  }, [paperId, newNoteContent, editingNoteId, editingContent]);

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

  const handleExtractFromAnnotations = useCallback(async () => {
    try {
      await extractFromAnnotations({
        includeComments: true,
        tagColor: true,
      });
    } catch (caughtError) {
      logger.error("Failed to extract notes from annotations", caughtError);
    }
  }, [extractFromAnnotations]);

  useEffect(() => {
    if (onRegisterExtract) {
      onRegisterExtract({
        extract: handleExtractFromAnnotations,
        isExtracting: isExtractingFromAnnotations,
      });
    }
  }, [onRegisterExtract, isExtractingFromAnnotations, handleExtractFromAnnotations]);

  const handleSaveNewNote = async () => {
    const trimmedContent = newNoteContent.trim();
    if (!trimmedContent) return;

    try {
      await executeCommand(
        createAddNoteCommand({
          itemId: paper.id,
          contentMd: trimmedContent,
          createNote,
          deleteNote,
        }),
        { silentToast: true },
      );
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
    const existingNormalized = notes.find((n) => n.id === noteId);
    const previousContentMd =
      targetNote?.contentMd || existingNormalized?.content || "";

    if (targetNote && trimmedContent !== previousContentMd) {
      try {
        await executeCommand(
          createUpdateNoteCommand({
            noteId,
            initialVersion: targetNote.version || 1,
            previousContentMd,
            nextContentMd: trimmedContent,
            updateNote,
          }),
          { silentToast: true },
        );
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

  return (
    <div className="flex flex-col gap-2 min-w-0 font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-12 font-medium text-foreground">Notes</h3>
          {canEdit && (
            <div className="flex items-center gap-1">
              {isReader && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleExtractFromAnnotations}
                      disabled={isExtractingFromAnnotations}
                      className="size-5 flex items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer transition-colors"
                      aria-label="Extract from PDF highlights"
                    >
                      {isExtractingFromAnnotations ? (
                        <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
                      ) : (
                        <FileText
                          className="size-3.5 text-foreground shrink-0"
                          strokeWidth={1.5}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">From PDF Highlights</TooltipContent>
                </Tooltip>
              )}
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

      {/* Add New Note Box */}
      {isAdding && (
        <NoteEditorBox
          value={newNoteContent}
          onChange={setNewNoteContent}
          onSave={handleSaveNewNote}
          onCancel={() => {
            setIsAdding(false);
            setNewNoteContent("");
            onCancelAdding?.();
          }}
          autoFocus
          placeholder="Write a research note... (Supports **bold**, *italic*, ### headings, - lists, > quotes)"
        />
      )}

      {/* Empty State */}
      {notes.length === 0 && !isAdding && (
        <div className="flex items-center justify-between px-1.5 py-1 text-12 text-muted-foreground select-none">
          <span>No notes yet</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-11 font-medium text-foreground hover:underline cursor-pointer"
            >
              Add note
            </button>
          )}
        </div>
      )}

      {/* Notes List */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-1.5 min-w-0">
          {notes.map((n) => {
            const isEditing = editingNoteId === n.id;
            const isExpanded = expandedNoteIds.has(n.id);
            const displayTitle = getNoteDisplayTitle(n);
            const snippet = getNotePreviewSnippet(n.content, displayTitle);
            const isLongNote =
              n.content.split("\n").length > 2 || n.content.length > 100;
            const hasMatchingHeader = n.content.trim().startsWith("#");

            if (isEditing) {
              return (
                <NoteEditorBox
                  key={n.id}
                  value={editingContent}
                  onChange={setEditingContent}
                  onSave={() => handleSaveEdit(n.id)}
                  onCancel={handleCancelEdit}
                  autoFocus
                />
              );
            }

            const structuredLinks = extractStructuredDeepLinksFromMarkdown(
              n.content,
            );
            const firstDeepLink =
              structuredLinks.length > 0 ? structuredLinks[0] : null;

            return (
              <div
                key={n.id}
                className={cn(
                  "group/note flex flex-col p-2.5 rounded-lg border border-border/70 bg-card text-xs min-w-0",
                )}
              >
                <div
                  onClick={() => isLongNote && toggleExpandNote(n.id)}
                  className={cn(
                    "flex items-center justify-between gap-1.5 min-w-0 select-none",
                    isLongNote && "cursor-pointer",
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <NoteIcon className="size-3.5 text-muted-foreground shrink-0" />
                    <span
                      className="text-11 font-medium text-foreground truncate"
                      title={displayTitle}
                    >
                      {displayTitle}
                    </span>
                  </div>

                  {/* Action Cluster: Page Jump, Edit, Delete, Expand */}
                  <div
                    className="flex items-center gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onNavigateToAnnotation && firstDeepLink !== null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToAnnotation(
                                firstDeepLink.pageNumber,
                                firstDeepLink.annotationId,
                              )
                            }
                            className="text-10 font-medium text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 shrink-0 cursor-pointer transition-colors mr-0.5"
                          >
                            p. {firstDeepLink.pageNumber}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{`Jump to page ${firstDeepLink.pageNumber}`}</TooltipContent>
                      </Tooltip>
                    )}

                    {canEdit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(n)}
                            className="opacity-0 group-hover/note:opacity-100 max-md:opacity-100 size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-opacity"
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
                            onClick={() => {
                              const target = canonicalNotes.find(
                                (cn) => cn.id === n.id,
                              );
                              void executeCommand(
                                createDeleteNoteCommand({
                                  noteId: n.id,
                                  version: target?.version,
                                  itemId: paper.id,
                                  contentMd: target?.contentMd || n.content,
                                  contentJson: target?.contentJson,
                                  title: target?.title,
                                  tags: target?.tags,
                                  deleteNote,
                                  createNote,
                                }),
                                { silentToast: true },
                              );
                            }}
                            className="opacity-0 group-hover/note:opacity-100 max-md:opacity-100 size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-opacity"
                            aria-label="Delete note"
                          >
                            <MinusCircle className="size-3.5 shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Delete note</TooltipContent>
                      </Tooltip>
                    )}

                    {isLongNote && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => toggleExpandNote(n.id)}
                            className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
                          {isExpanded ? "Collapse note" : "Expand note"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Body: Preview when collapsed, Markdown when expanded */}
                {isExpanded ? (
                  <div className="border-t border-border/40 mt-1.5 pt-1.5 select-text">
                    <FormattedNoteBody
                      content={n.content}
                      isExpanded={true}
                      omitFirstHeading={hasMatchingHeader}
                      onNavigateToAnnotation={onNavigateToAnnotation}
                    />
                  </div>
                ) : snippet ? (
                  <div
                    onClick={() => {
                      if (isLongNote) toggleExpandNote(n.id);
                      else if (canEdit) handleStartEdit(n);
                    }}
                    className={cn(
                      "min-w-0 mt-1",
                      isLongNote ? "cursor-pointer" : canEdit ? "cursor-text" : "",
                    )}
                  >
                    <p className="text-11 text-muted-foreground line-clamp-2 leading-relaxed select-text font-sans">
                      {snippet}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
