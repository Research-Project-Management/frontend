import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { SmilePlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderCommentContent(
  content: string,
  attachmentLinks: Array<{ name: string; url: string }> = [],
) {
  const nameToUrl = new Map(
    attachmentLinks
      .filter((item) => item?.name && item?.url)
      .map((item) => [item.name, item.url]),
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
                className="text-[#2563eb] underline decoration-[#2563eb] decoration-1 underline-offset-2 hover:text-[#1d4ed8]"
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
                  className="text-[#2563eb] underline decoration-[#2563eb] decoration-1 underline-offset-2 hover:text-[#1d4ed8]"
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

type TaskActivitiesProps = {
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
    <div className="flex w-[40%] min-w-105 flex-col border-l border-[#e7e7e7] bg-[#fbfbfb]">
      <div className="flex h-17 items-center justify-between border-[#e7e7e7] bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="size-5 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#44546f]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <h3 className="text-[16px] font-bold text-[#172b4d]">
            Nhận xét và hoạt động
          </h3>
        </div>

        <Button
          variant="secondary"
          className="h-8 rounded-[6px] bg-[#091e420f] px-3 text-[13px] font-bold text-[#172b4d] shadow-none hover:bg-[#091e421a] transition-colors border-none"
          onClick={() => setShowDetailActivity((prev) => !prev)}
        >
          {showDetailActivity ? "Ẩn chi tiết" : "Hiện chi tiết"}
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
              onCommentCaretChange?.((e.currentTarget.selectionStart ?? 0));
              setShowCommentActions(true);
            }}
            onFocus={(e) => {
              if (!canComment) return;
              onCommentCaretChange?.((e.currentTarget.selectionStart ?? e.currentTarget.value.length));
              setShowCommentActions(true);
            }}
            onBlur={(e) => {
              if (!canComment) return;

              const nextFocused = e.relatedTarget as HTMLElement | null;
              if (nextFocused?.closest("[data-comment-actions='true']")) return;

              setShowCommentActions(false);
            }}
            placeholder={canComment ? "Viết bình luận..." : "Lưu thẻ trước khi bình luận"}
            disabled={!canComment}
            className="min-h-11.5 rounded-[12px] border border-[#d0d7e2] bg-white px-4 py-3 text-[15px] text-[#333] shadow-none transition-all duration-200 focus-visible:ring-0"
          />

          {canComment && showCommentActions ? (
            <div
              className="flex items-center gap-2 transition-all duration-200"
              data-comment-actions="true"
            >
              <Button
                type="button"
                className="h-9 min-w-16 bg-[#0c66e4] px-4 text-white shadow-none transition-all duration-200 hover:bg-[#0c66e4]/90 active:scale-[0.98] disabled:opacity-60"
                onClick={handleSaveComment}
                disabled={!commentText.trim() || isSavingComment}
              >
                {isSavingComment ? (
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent"
                    aria-hidden="true"
                  />
                ) : null}
                Lưu
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-[#44546f] transition-all duration-200 hover:bg-[#091e420f] active:scale-[0.98] disabled:opacity-60"
                onClick={handleCancelComment}
                disabled={isSavingComment}
              >
                Hủy
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        {activityLoading ? (
          <div className="mb-3 rounded-lg bg-[#f4f5f7] px-3 py-2 text-[13px] text-[#44546f]">
            Đang tải hoạt động...
          </div>
        ) : null}

        {activityError ? (
          <div className="mb-3 rounded-lg bg-[#fff1f0] px-3 py-2 text-[13px] text-[#c9372c]">
            Không thể tải hoạt động. Vui lòng thử lại.
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
                    <AvatarFallback className="bg-[#dbeafe] text-[14px] font-bold text-[#1e3a8a]">
                      {item.authorInitials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    {isComment ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#172b4d]">{item.author}</span>
                          <span className="ml-0.5 text-[14px] text-[#2563eb]">{item.timestamp}</span>
                        </div>

                        {isEditing ? (
                          <div className="mt-1.5 space-y-2 transition-all duration-200">
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="min-h-11.5 rounded-[12px] border border-[#d0d7e2] bg-white px-4 py-3 text-[15px] text-[#333] shadow-none transition-all duration-200 focus-visible:ring-0"
                              disabled={isSubmittingEdit}
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                className="h-9 min-w-16 bg-[#0c66e4] px-4 text-white shadow-none transition-all duration-200 hover:bg-[#0c66e4]/90 active:scale-[0.98] disabled:opacity-60"
                                onClick={handleSaveEditedComment}
                                disabled={!editingCommentText.trim() || isSubmittingEdit}
                              >
                                {isSubmittingEdit ? (
                                  <span
                                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent"
                                    aria-hidden="true"
                                  />
                                ) : null}
                                Lưu
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-9 px-3 text-[#44546f] transition-all duration-200 hover:bg-[#091e420f] active:scale-[0.98] disabled:opacity-60"
                                onClick={handleCancelEditComment}
                                disabled={isSubmittingEdit}
                              >
                                Hủy
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-1.5 rounded-[12px] border border-[#d0d7e2] bg-white px-4 py-3 text-[15px] leading-6 text-[#333] shadow-none whitespace-pre-wrap break-words">
                              {renderCommentContent(item.content, attachmentLinks)}
                            </div>
                            {item.reactionEmoji ? (
                              <div className="mt-1.5 inline-flex items-center rounded-full border border-[#d0d7e2] bg-white px-2 py-1 text-[16px] shadow-none">
                                {item.reactionEmoji}
                              </div>
                            ) : null}

                            <div className="relative mt-1.5 inline-flex items-center gap-2 text-[13px] text-[#44546f]">
                              <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded-full text-[#44546f] transition-colors hover:bg-[#091e420f] hover:text-[#172b4d] focus:outline-none focus:ring-2 focus:ring-[#3884ff]"
                                aria-label="Mở danh sách cảm xúc"
                                title="Mở danh sách cảm xúc"
                                onClick={() =>
                                  setReactionPickerCommentId((current) =>
                                    current === item.id ? null : item.id
                                  )
                                }
                              >
                                <SmilePlus className="size-3.5" />
                              </button>
                              {item.permissions?.canEdit ? (
                                <>
                                  <span className="text-[#b0b7c3]">•</span>
                                  <button
                                    type="button"
                                    className="rounded px-1 py-0.5 transition-colors hover:bg-[#091e420f] hover:underline focus:outline-none focus:ring-2 focus:ring-[#3884ff]"
                                    onClick={() => handleStartEditComment(item.id, item.content)}
                                  >
                                    Chỉnh sửa
                                  </button>
                                </>
                              ) : null}
                              {item.permissions?.canDelete ? (
                                <>
                                  <span className="text-[#b0b7c3]">•</span>
                                  <button
                                    type="button"
                                    className="rounded px-1 py-0.5 transition-colors hover:bg-[#fff1f0] hover:underline hover:text-[#c9372c] focus:outline-none focus:ring-2 focus:ring-[#f6c7c2]"
                                    onClick={() => setDeleteCommentId(item.id)}
                                  >
                                    Xóa
                                  </button>
                                </>
                              ) : null}

                              {reactionPickerCommentId === item.id ? (
                                <div className="absolute bottom-full left-0 z-20 mb-2 rounded-full border border-[#d0d7e2] bg-white px-2 py-1 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
                                  <div className="flex items-center gap-1">
                                    {reactionOptions.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className="flex size-10 items-center justify-center rounded-full text-[24px] transition-transform duration-200 hover:scale-110 hover:bg-[#f4f5f7] active:scale-95"
                                        onClick={() => handlePickReaction(item.id, emoji)}
                                        aria-label={`Chọn cảm xúc ${emoji}`}
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
                        <p className="text-[16px] leading-6 text-[#333]">
                          <span className="font-semibold">{item.author}</span> {item.content}
                        </p>
                        <p className="mt-1.5 text-[14px]">
                          {item.timestamp === "vừa xong" ? (
                            <a href="#" className="text-[#2563eb] hover:underline cursor-pointer" onClick={(e) => e.preventDefault()}>
                              vừa xong
                            </a>
                          ) : (
                            <span className="text-[#2563eb]">{item.timestamp}</span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : canComment ? (
          <div className="py-10 text-center text-[14px] text-[#888]">
            Chưa có hoạt động nào
          </div>
        ) : (
          <div className="py-10 text-center text-[14px] text-[#888]">
            Hãy thêm bình luận hoặc xem hoạt động
          </div>
        )}
      </div>

      <Dialog
        open={!!deleteCommentId}
        onOpenChange={(open) => {
          if (!open) setDeleteCommentId(null);
        }}
      >
        <DialogContent className="max-w-130 rounded-[18px] border-0 p-0 shadow-2xl" showCloseButton={false}>
          <div className="p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-[18px] font-bold text-[#172b4d]">
                Xóa bình luận?
              </DialogTitle>
              <DialogDescription className="text-[14px] leading-6 text-[#44546f]">
                Bình luận này sẽ bị xóa khỏi danh sách và không thể khôi phục.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="border-t border-[#ececec] px-6 py-4">
            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-4 text-[#44546f] hover:bg-[#091e420f]"
                onClick={() => setDeleteCommentId(null)}
              >
                Hủy
              </Button>
              <Button
                type="button"
                className="h-9 bg-[#c9372c] px-4 text-white shadow-none transition-all duration-200 hover:bg-[#c9372c]/90 active:scale-[0.98] disabled:opacity-60"
                onClick={handleConfirmDeleteComment}
                disabled={isDeleteCommentRunning}
              >
                Xóa
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
