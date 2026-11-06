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
} from "@/features/library/domain/metadata.mapper";
import { useNotes } from "@/features/library/core/coordinator/saved-search-builder.coordinator";
import {
  useLibraryCommandStore,
  createAddNoteCommand,
  createUpdateNoteCommand,
  createDeleteNoteCommand,
} from "@/features/library/core/manager/library-command.manager";
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import { toast } from "sonner";
import type { Item } from "@/features/library/types/core.types";
import {
  FormattedNoteBody,
  NoteEditorBox,
  getNoteDisplayTitle,
  getNotePreviewSnippet,
  extractStructuredDeepLinksFromMarkdown,
} from "./NoteMarkdownEditor";

interface NotesSectionProps {
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
    extract: (() => Promise<void>) | null;
    isExtracting: boolean;
  }) => void;
}

function NoteIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <StickyNote
      className={cn("size-3.5 shrink-0 text-foreground", className)}
      strokeWidth={1.5}
    />
  );
}

// Module-level draft cache keyed by `${scopeId}:${paperId}` so unsaved note drafts
// survive Inspector remounts and item switches without data loss.
const NOTE_DRAFTS_BY_PAPER = new Map<
  string,
  { newNote: string; editingNoteId: string | null; editingContent: string }
>();

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
  const draftKey = `${activeScopeId}:${paperId}`;
  const initialDraft = NOTE_DRAFTS_BY_PAPER.get(draftKey);

  const [isAdding, setIsAdding] = useState(() =>
    Boolean(initialDraft?.newNote?.trim()),
  );
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [newNoteContent, setNewNoteContent] = useState(
    () => initialDraft?.newNote || "",
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(
    () => initialDraft?.editingNoteId || null,
  );
  const [editingContent, setEditingContent] = useState(
    () => initialDraft?.editingContent || "",
  );

  useEffect(() => {
    if (forceAdding && canEdit && !editingNoteId) {
      setIsAdding(true);
    }
  }, [forceAdding, canEdit, editingNoteId]);

  useEffect(() => {
    if (pendingText && canEdit) {
      if (editingNoteId) {
        setEditingContent((prev) =>
          prev ? `${prev}\n\n${pendingText}` : pendingText,
        );
      } else {
        setIsAdding(true);
        setNewNoteContent((prev) =>
          prev ? `${prev}\n\n${pendingText}` : pendingText,
        );
      }
      onClearPendingText?.();
    }
  }, [pendingText, canEdit, editingNoteId, onClearPendingText]);

  const prevDraftKeyRef = useRef(draftKey);

  const {
    notes: canonicalNotes,
    createNote,
    updateNote,
    deleteNote,
    extractFromAnnotations,
    isExtractingFromAnnotations,
  } = useNotes(activeScopeId, paper.id);
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);

  // Continuously sync active draft into NOTE_DRAFTS_BY_PAPER and restore on paper switch
  useEffect(() => {
    if (prevDraftKeyRef.current !== draftKey) {
      const restored = NOTE_DRAFTS_BY_PAPER.get(draftKey);
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
      prevDraftKeyRef.current = draftKey;
      return;
    }

    if (newNoteContent || editingNoteId || editingContent) {
      NOTE_DRAFTS_BY_PAPER.set(draftKey, {
        newNote: newNoteContent,
        editingNoteId,
        editingContent,
      });
    } else {
      NOTE_DRAFTS_BY_PAPER.delete(draftKey);
    }
  }, [draftKey, newNoteContent, editingNoteId, editingContent]);

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
      const existingLitNote = notes.find(
        (n) =>
          !n.id.startsWith("note-") &&
          ((Array.isArray(n.tags) && n.tags.includes("literature-note")) ||
            (typeof n.title === "string" &&
              n.title.toLowerCase().startsWith("literature notes")) ||
            n.content.trim().startsWith("# Literature Notes:")),
      );
      await extractFromAnnotations({
        includeComments: true,
        tagColor: true,
        ...(existingLitNote?.id ? { noteId: existingLitNote.id } : {}),
      });
    } catch (caughtError) {
      logger.error("Failed to extract notes from annotations", caughtError);
    }
  }, [extractFromAnnotations, notes]);

  useEffect(() => {
    if (!onRegisterExtract) return;
    onRegisterExtract({
      extract: handleExtractFromAnnotations,
      isExtracting: isExtractingFromAnnotations,
    });
    return () => {
      onRegisterExtract({
        extract: null,
        isExtracting: false,
      });
    };
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

    if (!targetNote) {
      toast.error("Note is no longer available", { id: "note-update-error" });
      return;
    }

    if (trimmedContent !== previousContentMd) {
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
        toast.error("Failed to save note changes", { id: "note-update-error" });
        return;
      }
    }
    setEditingNoteId(null);
    setEditingContent("");
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent("");
  };

  const handleDropAnnotationToNotes = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    const droppedPayload =
      e.dataTransfer.getData("application/x-flux-annotation") ||
      e.dataTransfer.getData("text/plain");
    if (!droppedPayload || !droppedPayload.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    const cleaned = droppedPayload.trim();
    if (editingNoteId) {
      setEditingContent((prev) => (prev ? `${prev}\n\n${cleaned}` : cleaned));
    } else {
      setIsAdding(true);
      setNewNoteContent((prev) => (prev ? `${prev}\n\n${cleaned}` : cleaned));
    }
  };

  if (notes.length === 0 && !isAdding && hideHeader) {
    return null;
  }

  return (
    <div
      onDragOver={(e) => {
        if (
          canEdit &&
          (e.dataTransfer.types.includes("application/x-flux-annotation") ||
            e.dataTransfer.types.includes("text/plain"))
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleDropAnnotationToNotes}
      className="flex flex-col gap-2 min-w-0 font-sans empty:hidden"
    >
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
          onNavigateToAnnotation={onNavigateToAnnotation}
          autoFocus
          placeholder="Write a research note... (Supports **bold**, *italic*, ### headings, - lists, > quotes)"
        />
      )}

      {/* Notes List */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-0.5 min-w-0">
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
                  onNavigateToAnnotation={onNavigateToAnnotation}
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
                  "group/note flex flex-col px-1.5 py-0.5 rounded-md hover:bg-muted/50 text-xs min-w-0 transition-colors",
                )}
              >
                <div
                  onClick={() => {
                    if (isLongNote) toggleExpandNote(n.id);
                    else if (canEdit) handleStartEdit(n);
                  }}
                  className={cn(
                    "flex items-center justify-between gap-1.5 min-h-[26px] min-w-0 select-none",
                    isLongNote ? "cursor-pointer" : canEdit ? "cursor-text" : "",
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <NoteIcon className="size-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <span
                      className="text-xs font-normal text-foreground truncate"
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
                            className="opacity-0 group-hover/note:opacity-100 max-md:opacity-100 size-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-opacity"
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
                              );
                            }}
                            className="opacity-0 group-hover/note:opacity-100 max-md:opacity-100 size-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-destructive cursor-pointer transition-opacity"
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
                            className="size-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
                  <div className="border-t border-border/40 mt-1.5 pt-1.5 pl-6 select-text">
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
                      "min-w-0 mt-0.5 pl-6",
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
