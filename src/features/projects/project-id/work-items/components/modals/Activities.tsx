'use client';

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui";
import { Textarea } from "@/shared/components/ui";
import { SmilePlus, MessageSquare, History, ListFilter, Activity as ActivityIcon } from "lucide-react";
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

export type ActivitiesProps = {
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

type ActivityTab = "all" | "activity" | "comments" | "history";

export function Activities({
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
}: ActivitiesProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
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

  const filteredActivities = useMemo(() => {
    if (activeTab === "all") return activities;
    if (activeTab === "comments") return activities.filter((a) => a.kind === "comment");
    if (activeTab === "activity") return activities.filter((a) => a.kind !== "comment");
    if (activeTab === "history") return activities.filter((a) => a.kind === "activity" || a.kind === "system");
    return activities;
  }, [activities, activeTab]);

  const commentCount = useMemo(() => {
    return activities.filter((a) => a.kind === "comment").length;
  }, [activities]);

  const activityCount = useMemo(() => {
    return activities.filter((a) => a.kind !== "comment").length;
  }, [activities]);

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
  }, [commentFocusToken, canComment, commentCaretPosition, commentTextareaRef]);

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
    <div className="w-full flex flex-col space-y-3.5">
      {/* Plane Style Filter Tabs Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-md border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
              activeTab === "all"
                ? "bg-background text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1",
              activeTab === "activity"
                ? "bg-background text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <span>Activity</span>
            {activityCount > 0 && (
              <span className="text-10 text-muted-foreground tabular-nums">({activityCount})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1",
              activeTab === "comments"
                ? "bg-background text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <span>Comments</span>
            {commentCount > 0 && (
              <span className="text-10 text-muted-foreground tabular-nums">({commentCount})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
              activeTab === "history"
                ? "bg-background text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            History
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shadow-none rounded-md"
          onClick={() => setShowDetailActivity((prev) => !prev)}
        >
          {showDetailActivity ? "Hide details" : "Show details"}
        </Button>
      </div>

      {/* Write Comment Box */}
      <div className="space-y-2">
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
            "min-h-[64px] rounded-md border border-border bg-background p-3 text-xs sm:text-sm text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-primary resize-none transition-colors leading-relaxed",
            (!canComment || isReadOnly) && "cursor-not-allowed bg-muted"
          )}
          rows={2}
        />

        {canComment && !isReadOnly && (showCommentActions || Boolean(commentText.trim())) ? (
          <div
            className="flex items-center gap-1.5 justify-end"
            data-comment-actions="true"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs text-foreground hover:bg-muted rounded-md shadow-none cursor-pointer"
              onClick={handleCancelComment}
              disabled={isSavingComment}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-3 text-xs rounded-md shadow-none cursor-pointer"
              onClick={handleSaveComment}
              disabled={!commentText.trim() || isSavingComment}
            >
              {isSavingComment ? (
                <span className="inline-block size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-1" />
              ) : null}
              Comment
            </Button>
          </div>
        ) : null}
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3 pt-1">
        {activityLoading ? (
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Loading activity...
          </div>
        ) : null}

        {activityError ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Could not load activity. Please try again.
          </div>
        ) : null}

        {filteredActivities.length > 0 ? (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-0.5">
            {filteredActivities.map((item) => {
              const isComment = item.kind === "comment";
              const isEditing = editingCommentId === item.id;
              const isSubmittingEdit =
                isUpdatingComment &&
                isEditCommentSubmitRequested &&
                editSubmittingCommentId === item.id;

              return (
                <div key={item.id} className="flex items-start gap-2.5 text-xs">
                  <Avatar className="size-6 shrink-0 mt-0.5">
                    <AvatarImage src={item.avatarUrl || undefined} />
                    <AvatarFallback className="bg-muted text-10 font-semibold text-foreground">
                      {item.authorInitials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-1">
                    {isComment ? (
                      <>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-semibold text-foreground truncate">{item.author}</span>
                          <span className="text-10 text-muted-foreground">{item.timestamp}</span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-1.5">
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="min-h-[50px] rounded-md border border-border bg-card p-2 text-xs text-foreground shadow-none resize-none focus-visible:ring-1 focus-visible:ring-primary"
                              disabled={isSubmittingEdit}
                              autoFocus
                            />
                            <div className="flex items-center gap-1.5 justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-foreground hover:bg-muted rounded-md shadow-none cursor-pointer"
                                onClick={handleCancelEditComment}
                                disabled={isSubmittingEdit}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-6 px-2.5 text-xs rounded-md shadow-none cursor-pointer"
                                onClick={handleSaveEditedComment}
                                disabled={!editingCommentText.trim() || isSubmittingEdit}
                              >
                                {isSubmittingEdit ? (
                                  <span className="inline-block size-2.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-1" />
                                ) : null}
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-md border border-border bg-muted/60 px-3 py-2 text-xs leading-relaxed text-foreground shadow-none whitespace-pre-wrap break-words">
                              {renderCommentContent(item.content, attachmentLinks)}
                            </div>
                            {item.reactionEmoji ? (
                              <div className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-11 shadow-xs">
                                {item.reactionEmoji}
                              </div>
                            ) : null}

                            <div className="relative inline-flex items-center gap-1.5 text-10 text-muted-foreground">
                              <button
                                type="button"
                                disabled={isReadOnly}
                                className={cn(
                                  "inline-flex size-5 items-center justify-center rounded-md text-foreground transition-colors focus:outline-none",
                                  isReadOnly ? "cursor-not-allowed opacity-30" : "hover:bg-muted hover:text-foreground cursor-pointer"
                                )}
                                aria-label="Open reaction picker"
                                title="Open reaction picker"
                                onClick={() =>
                                  setReactionPickerCommentId((current) =>
                                    current === item.id ? null : item.id
                                  )
                                }
                              >
                                <SmilePlus className="size-3" />
                              </button>

                              {!isReadOnly && (item.permissions?.canEdit ?? true) ? (
                                <>
                                  <button
                                    type="button"
                                    className="hover:text-foreground cursor-pointer transition-colors"
                                    onClick={() => handleStartEditComment(item.id, item.content)}
                                  >
                                    Edit
                                  </button>
                                  <span>·</span>
                                  <button
                                    type="button"
                                    className="hover:text-destructive cursor-pointer transition-colors"
                                    onClick={() => setDeleteCommentId(item.id)}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : null}

                              {reactionPickerCommentId === item.id ? (
                                <div className="absolute bottom-full left-0 z-20 mb-1 rounded-md border border-border bg-popover text-popover-foreground px-1.5 py-0.5 flex items-center gap-0.5 shadow-md">
                                  {reactionOptions.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      className="flex size-7 items-center justify-center rounded-md text-base transition-transform hover:scale-115 hover:bg-muted active:scale-95 cursor-pointer"
                                      onClick={() => handlePickReaction(item.id, emoji)}
                                      aria-label={`Pick reaction ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-xs leading-snug">
                        <p className="text-foreground">
                          <span className="font-semibold">{item.author}</span> {item.content}
                        </p>
                        <p className="text-10 text-muted-foreground mt-0.5">
                          {item.timestamp}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : canComment ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No activity yet for {activeTab}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Add a comment or view activity
          </div>
        )}
      </div>

      {/* Delete Comment Confirmation Dialog */}
      <Dialog
        open={!!deleteCommentId}
        onOpenChange={(open) => {
          if (!open) setDeleteCommentId(null);
        }}
      >
        <DialogContent className="max-w-xs rounded-md border border-border p-4" showCloseButton={false}>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Delete comment?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This comment will be removed and cannot be recovered.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5 text-foreground hover:bg-muted rounded-md shadow-none cursor-pointer"
              onClick={() => setDeleteCommentId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 text-xs px-3 shadow-none rounded-md cursor-pointer"
              onClick={handleConfirmDeleteComment}
              disabled={isDeleteCommentRunning}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Activities;
