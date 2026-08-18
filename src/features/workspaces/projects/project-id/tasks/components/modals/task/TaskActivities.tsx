'use client';

import React, { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Textarea,
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui";
import { SmilePlus } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderCommentContent(
  content: string,
  attachmentLinks: Array<{ name: string; url: string }> = []
) {
  const nameToUrl = new Map(
    attachmentLinks
      .filter((item) => item?.name && item?.url)
      .map((item) => [item.name, item.url])
  );

  const attachmentNames = Array.from(nameToUrl.keys()).sort((a, b) => b.length - a.length);
  const attachmentRegex =
    attachmentNames.length > 0
      ? new RegExp(`(${attachmentNames.map(escapeRegExp).join("|")})`, "g")
      : null;
  const lines = content.split("\n");

  return lines.map((line, lineIndex) => {
    const segments = attachmentRegex ? line.split(attachmentRegex) : [line];

    return (
      <span key={`line-${lineIndex}`}>
        {segments.map((segment, segmentIndex) => {
          const matchedAttachmentUrl = nameToUrl.get(segment);
          if (matchedAttachmentUrl) {
            return (
              <a
                key={`file-${lineIndex}-${segmentIndex}`}
                href={matchedAttachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline decoration-foreground decoration-1 underline-offset-2 hover:text-foreground"
              >
                {segment}
              </a>
            );
          }

          return segment.split(URL_REGEX).map((part, urlIndex) => {
            if (/^https?:\/\/\S+$/.test(part)) {
              return (
                <a
                  key={`url-${lineIndex}-${segmentIndex}-${urlIndex}`}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline decoration-foreground decoration-1 underline-offset-2 hover:text-foreground"
                >
                  {part}
                </a>
              );
            }

            return <span key={`txt-${lineIndex}-${segmentIndex}-${urlIndex}`}>{part}</span>;
          });
        })}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

export type ActivityEntry = {
  id: string;
  author: string;
  authorInitials: string;
  avatarUrl?: string | null;
  content: string;
  timestamp: string;
  createdAt?: number;
  kind?: "comment" | "system" | "activity";
  reactionEmoji?: string;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
  };
};

export type TaskActivitiesProps = {
  commentText: string;
  setCommentText: (text: string) => void;
  commentTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onSaveComment: (content: string) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReactComment: (commentId: string, emoji: string) => void;
  attachmentLinks?: Array<{ name: string; url: string }>;
  commentFocusToken?: number;
  commentCaretPosition?: number;
  onCommentCaretChange?: (position: number) => void;
  canComment?: boolean;
  isSavingComment?: boolean;
  isUpdatingComment?: boolean;
  showDetailActivity: boolean;
  setShowDetailActivity: (show: boolean | ((prev: boolean) => boolean)) => void;
  activityLoading?: boolean;
  activityError?: boolean;
  activities: ActivityEntry[];
  isReadOnly?: boolean;
};

export function TaskActivities({
  commentText,
  setCommentText,
  commentTextareaRef: passedRef,
  onSaveComment,
  onUpdateComment,
  onDeleteComment,
  onReactComment,
  attachmentLinks = [],
  commentFocusToken = 0,
  commentCaretPosition = 0,
  onCommentCaretChange,
  canComment = true,
  isSavingComment = false,
  isUpdatingComment = false,
  showDetailActivity,
  setShowDetailActivity,
  activityLoading = false,
  activityError = false,
  activities,
  isReadOnly = false,
}: TaskActivitiesProps) {
  const [showCommentActions, setShowCommentActions] = useState(false);
  const [isCommentSubmitRequested, setIsCommentSubmitRequested] = useState(false);
  const [isEditCommentSubmitRequested, setIsEditCommentSubmitRequested] = useState(false);
  const [editSubmittingCommentId, setEditSubmittingCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [reactionPickerCommentId, setReactionPickerCommentId] = useState<string | null>(null);
  const [isDeleteCommentRunning, setIsDeleteCommentRunning] = useState(false);
  const localTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const commentTextareaRef = passedRef ?? localTextareaRef;
  const deleteCommentTimeoutRef = useRef<number | null>(null);
  const lastHandledFocusTokenRef = useRef(commentFocusToken);
  const hasObservedEditUpdatePendingRef = useRef(false);

  const reactionOptions = ["👍", "❤️", "😆", "😮", "😢", "😡"];

  const handleSaveComment = () => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment || isSavingComment) return;
    setIsCommentSubmitRequested(true);
    onSaveComment(trimmedComment);
  };

  const handleCancelComment = () => {
    setCommentText("");
    setShowCommentActions(false);
    onCommentCaretChange?.(0);
  };

  const handleStartEditComment = (commentId: string, content: string) => {
    hasObservedEditUpdatePendingRef.current = false;
    setIsEditCommentSubmitRequested(false);
    setEditSubmittingCommentId(null);
    setEditingCommentId(commentId);
    setEditingCommentText(content);
  };

  const handleSaveEditedComment = () => {
    const trimmedComment = editingCommentText.trim();
    if (!editingCommentId || !trimmedComment || isUpdatingComment) return;

    hasObservedEditUpdatePendingRef.current = false;
    setIsEditCommentSubmitRequested(true);
    setEditSubmittingCommentId(editingCommentId);
    onUpdateComment(editingCommentId, trimmedComment);
  };

  const handleCancelEditComment = () => {
    if (isUpdatingComment && isEditCommentSubmitRequested) return;
    hasObservedEditUpdatePendingRef.current = false;
    setIsEditCommentSubmitRequested(false);
    setEditSubmittingCommentId(null);
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const handleConfirmDeleteComment = () => {
    if (!deleteCommentId) return;
    if (isDeleteCommentRunning) return;
    setIsDeleteCommentRunning(true);

    deleteCommentTimeoutRef.current = window.setTimeout(() => {
      onDeleteComment(deleteCommentId);
      setReactionPickerCommentId((current) => (current === deleteCommentId ? null : current));
      if (editingCommentId === deleteCommentId) {
        handleCancelEditComment();
      }
      setDeleteCommentId(null);
      setIsDeleteCommentRunning(false);
    }, 160);
  };

  const handlePickReaction = (commentId: string, emoji: string) => {
    onReactComment(commentId, emoji);
    setReactionPickerCommentId(null);
  };

  useEffect(() => {
    if (!canComment || !commentTextareaRef.current) return;
    if (commentFocusToken === lastHandledFocusTokenRef.current) return;

    lastHandledFocusTokenRef.current = commentFocusToken;
    commentTextareaRef.current.focus();
    const clamped = Math.max(0, Math.min(commentCaretPosition, commentTextareaRef.current.value.length));
    commentTextareaRef.current.setSelectionRange(clamped, clamped);
  }, [commentFocusToken, canComment, commentCaretPosition]);

  useEffect(() => {
    if (!isCommentSubmitRequested || isSavingComment) return;
    setCommentText("");
    setShowCommentActions(false);
    setIsCommentSubmitRequested(false);
    onCommentCaretChange?.(0);
  }, [isCommentSubmitRequested, isSavingComment, onCommentCaretChange, setCommentText]);

  useEffect(() => {
    if (!isEditCommentSubmitRequested) {
      hasObservedEditUpdatePendingRef.current = false;
      return;
    }

    if (isUpdatingComment) {
      hasObservedEditUpdatePendingRef.current = true;
      return;
    }

    if (!hasObservedEditUpdatePendingRef.current) return;

    setEditingCommentId(null);
    setEditingCommentText("");
    setIsEditCommentSubmitRequested(false);
    setEditSubmittingCommentId(null);
  }, [isEditCommentSubmitRequested, isUpdatingComment]);

  useEffect(() => {
    return () => {
      if (deleteCommentTimeoutRef.current) {
        window.clearTimeout(deleteCommentTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex w-[40%] min-w-105 flex-col border-l border-border bg-muted/30">
      <div className="flex h-17 items-center justify-between bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="size-5 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 className="text-[16px] font-bold text-foreground">
            Comments & Activity
          </h3>
        </div>

        <Button
          variant="secondary"
          className="h-8 rounded-md bg-muted px-3 text-[13px] font-medium text-foreground shadow-none hover:bg-muted/80 transition-colors border-none"
          onClick={() => setShowDetailActivity((prev) => !prev)}
        >
          {showDetailActivity ? "Hide details" : "Show details"}
        </Button>
      </div>

      <div className="px-5 pt-4">
        <div className="space-y-3">
          <Textarea
            ref={commentTextareaRef as any}
            value={commentText}
            onChange={(e) => {
              if (!canComment) return;
              setCommentText(e.target.value);
              onCommentCaretChange?.(e.target.selectionStart ?? e.target.value.length);
              setShowCommentActions(true);
            }}
            onSelect={(e) => {
              if (!canComment) return;
              onCommentCaretChange?.(e.currentTarget.selectionStart ?? 0);
              setShowCommentActions(true);
            }}
            onFocus={(e) => {
              if (!canComment) return;
              onCommentCaretChange?.(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
              setShowCommentActions(true);
            }}
            onBlur={(e) => {
              if (!canComment) return;
              const nextFocused = e.relatedTarget as HTMLElement | null;
              if (nextFocused?.closest("[data-comment-actions='true']")) return;
              if (!commentText.trim()) {
                setShowCommentActions(false);
              }
            }}
            placeholder={canComment ? "Write a comment..." : "Save card before commenting"}
            disabled={!canComment || isReadOnly}
            className={cn(
              "min-h-11.5 rounded-sm border border-border bg-white px-4 py-3 text-[15px] text-foreground shadow-none transition-all duration-200 focus-visible:ring-0",
              (!canComment || isReadOnly) && "cursor-not-allowed bg-zinc-50/50"
            )}
          />

          {canComment && !isReadOnly && (showCommentActions || Boolean(commentText.trim())) ? (
            <div
              className="flex items-center gap-2 transition-all duration-200"
              data-comment-actions="true"
            >
              <Button
                type="button"
                className="h-9 min-w-16 bg-primary px-4 text-white shadow-none transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
                onClick={handleSaveComment}
                disabled={!commentText.trim() || isSavingComment}
              >
                {isSavingComment ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                ) : null}
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-muted-foreground transition-all duration-200 hover:bg-muted active:scale-[0.98] disabled:opacity-60"
                onClick={handleCancelComment}
                disabled={isSavingComment}
              >
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {activityLoading ? (
          <div className="mb-3 rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
            Loading activity...
          </div>
        ) : null}

        {activityError ? (
          <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            Could not load activity. Please try again.
          </div>
        ) : null}

        {activities.length > 0 ? (
          <div className="space-y-5">
            {activities.map((item) => {
              const isComment = item.kind === "comment";
              const isEditing = editingCommentId === item.id;
              const isSubmittingEdit =
                isUpdatingComment &&
                isEditCommentSubmitRequested &&
                editSubmittingCommentId === item.id;

              return (
                <div key={item.id} className="flex items-start gap-2.5">
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage src={item.avatarUrl || undefined} />
                    <AvatarFallback className="bg-muted text-[14px] font-bold text-foreground">
                      {item.authorInitials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    {isComment ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{item.author}</span>
                          <span className="ml-0.5 text-[14px] text-muted-foreground">{item.timestamp}</span>
                        </div>

                        {isEditing ? (
                          <div className="mt-1.5 space-y-2 transition-all duration-200">
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="min-h-11.5 rounded-sm border border-border bg-card px-4 py-3 text-[15px] text-foreground shadow-none transition-all duration-200 focus-visible:ring-0"
                              disabled={isSubmittingEdit}
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                className="h-9 min-w-16 bg-primary px-4 text-primary-foreground shadow-none transition-all duration-200 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
                                onClick={handleSaveEditedComment}
                                disabled={!editingCommentText.trim() || isSubmittingEdit}
                              >
                                {isSubmittingEdit ? (
                                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/80 border-t-transparent" />
                                ) : null}
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9 px-3 text-muted-foreground transition-all duration-200 hover:bg-muted active:scale-[0.98] disabled:opacity-60"
                                onClick={handleCancelEditComment}
                                disabled={isSubmittingEdit}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-1.5 rounded-sm border border-border bg-white px-4 py-3 text-[15px] leading-6 text-foreground shadow-none whitespace-pre-wrap break-words">
                              {renderCommentContent(item.content, attachmentLinks)}
                            </div>
                            {item.reactionEmoji ? (
                              <div className="mt-1.5 inline-flex items-center rounded-full border border-border bg-white px-2 py-1 text-[16px] shadow-none">
                                {item.reactionEmoji}
                              </div>
                            ) : null}

                            <div className="relative mt-1.5 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                              <button
                                type="button"
                                disabled={isReadOnly}
                                className={cn(
                                  "inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors focus:outline-none focus:ring-0",
                                  isReadOnly ? "cursor-not-allowed opacity-30" : "hover:bg-muted hover:text-foreground"
                                )}
                                aria-label="Open reaction picker"
                                title="Open reaction picker"
                                onClick={() =>
                                  setReactionPickerCommentId((current) =>
                                    current === item.id ? null : item.id
                                  )
                                }
                              >
                                <SmilePlus className="size-3.5" />
                              </button>
                              {item.permissions?.canEdit && !isReadOnly ? (
                                <>
                                  <span className="text-muted-foreground/60">•</span>
                                  <button
                                    type="button"
                                    className="rounded px-1 py-0.5 transition-colors hover:bg-muted hover:underline focus:outline-none focus:ring-0"
                                    onClick={() => handleStartEditComment(item.id, item.content)}
                                  >
                                    Edit
                                  </button>
                                </>
                              ) : null}
                              {item.permissions?.canDelete && !isReadOnly ? (
                                <>
                                  <span className="text-muted-foreground/60">•</span>
                                  <button
                                    type="button"
                                    className="rounded px-1 py-0.5 transition-colors hover:bg-destructive/10 hover:underline hover:text-destructive focus:outline-none focus:ring-0"
                                    onClick={() => setDeleteCommentId(item.id)}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : null}

                              {reactionPickerCommentId === item.id ? (
                                <div className="absolute bottom-full left-0 z-20 mb-2 rounded-full border border-border bg-popover text-popover-foreground px-2 py-1 shadow-lg">
                                  <div className="flex items-center gap-1">
                                    {reactionOptions.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className="flex size-10 items-center justify-center rounded-full text-[24px] transition-transform duration-200 hover:scale-110 hover:bg-muted active:scale-95"
                                        onClick={() => handlePickReaction(item.id, emoji)}
                                        aria-label={`Pick reaction ${emoji}`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-[16px] leading-6 text-foreground">
                          <span className="font-semibold">{item.author}</span> {item.content}
                        </p>
                        <p className="mt-1.5 text-[14px]">
                          <span className="text-primary">{item.timestamp}</span>
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : canComment ? (
          <div className="py-10 text-center text-[14px] text-muted-foreground">
            No activity yet
          </div>
        ) : (
          <div className="py-10 text-center text-[14px] text-muted-foreground">
            Add a comment or view activity
          </div>
        )}
      </div>

      <Dialog
        open={!!deleteCommentId}
        onOpenChange={(open) => {
          if (!open) setDeleteCommentId(null);
        }}
      >
        <DialogContent className="max-w-130 rounded-sm border-0 p-0 shadow-2xl" showCloseButton={false}>
          <div className="p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[18px] font-bold text-foreground">
                Delete comment?
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-6 text-muted-foreground">
                This comment will be removed and cannot be recovered.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="border-t border-border px-6 py-4">
            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-4 text-muted-foreground hover:bg-muted"
                onClick={() => setDeleteCommentId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-9 bg-destructive px-4 text-white shadow-none transition-all duration-200 hover:bg-destructive/90 active:scale-[0.98] disabled:opacity-60"
                onClick={handleConfirmDeleteComment}
                disabled={isDeleteCommentRunning}
              >
                Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TaskActivities;
