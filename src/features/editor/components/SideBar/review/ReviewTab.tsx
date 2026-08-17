'use client';
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  createCommentSchema,
  createReplySchema,
  type CreateCommentInput,
} from "@/features/editor/schemas/comment.schema";
import {
  usePageComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useAddReply,
  useDeleteReply,
} from "@/features/editor/services/comment.service";
import type { PageComment, CommentReply } from "@/features/editor/types/document.types";
import { usePageStore } from "@/features/editor/store/page.store";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useActionsStore } from '@/features/editor/store/actions.store';
import { cn } from "@/shared/lib/utils";


type Filter = "all" | "open" | "resolved";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({
  author,
  size = 6,
}: {
  author?: { name: string; avatar?: string };
  size?: number;
}) {
  if (author?.avatar) {
    return (
      <img
        src={author.avatar}
        alt={author.name}
        className={`size-${size} rounded-full object-cover shrink-0`}
      />
    );
  }
  return (
    <div
      className={`size-${size} rounded-full bg-primary/10 flex items-center justify-center shrink-0`}
    >
      <User className={`size-${Math.round(size * 0.55)} text-primary`} />
    </div>
  );
}

// ── Single comment card ──────────────────────────────────────────────────────
function CommentCard({
  comment,
  pageId,
  currentUserId,
  onNavigate,
}: {
  comment: PageComment;
  pageId: string;
  currentUserId: string | undefined;
  onNavigate?: (line: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");

  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const addReplyMutation = useAddReply();
  const deleteReplyMutation = useDeleteReply();

  const isAuthor = currentUserId === comment.author._id;
  const isResolved = comment.status === "resolved";
  const hasReplies = comment.replies.length > 0;
  const lineEnd = (comment as any).lineEnd;

  const handleToggleStatus = () => {
    updateMutation.mutate({
      pageId,
      commentId: comment._id,
      status: isResolved ? "open" : "resolved",
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ pageId, commentId: comment._id });
  };

  const handleSendReply = () => {
    const text = replyText.trim();
    if (!text) return;
    addReplyMutation.mutate(
      { pageId, commentId: comment._id, content: text },
      { onSuccess: () => setReplyText("") },
    );
  };

  const handleDeleteReply = (replyId: string) => {
    deleteReplyMutation.mutate({ pageId, commentId: comment._id, replyId });
  };

  return (
    <li
      className={cn("border-b border-border last:border-b-0 transition-colors")}
    >
      {/* Main comment body */}
      <div className={cn("px-3 py-2.5", isResolved && "opacity-70")}>
        {/* Row 1: avatar + author + status badge */}
        <div className="flex items-center gap-1.5 min-w-0 mb-1">
          <Avatar author={comment.author} size={5} />
          <span className="text-[11px] font-semibold truncate flex-1 min-w-0">
            {comment.author.name}
          </span>
          {isResolved ? (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="size-2.5" />
              Resolved
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              <Circle className="size-2.5" />
              Open
            </span>
          )}
        </div>

        {/* Row 2: line badge + timestamp */}
        <div className="flex items-center gap-1.5 mb-2 ml-6">
          {comment.line != null && (
            <button
              onClick={() => onNavigate?.(comment.line!)}
              className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0 hover:bg-primary/10 hover:text-primary transition-colors"
              title="Jump to line"
            >
              L{comment.line}
              {lineEnd != null && lineEnd !== comment.line
                ? `\u2013${lineEnd}`
                : ""}
            </button>
          )}
          <span className="text-[10px] text-muted-foreground">
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Row 3: content */}
        <p className="text-xs text-foreground leading-relaxed wrap-break-word whitespace-pre-wrap ml-6">
          {comment.content}
        </p>

        {/* Row 4: actions */}
        <div className="flex items-center gap-3 mt-2 ml-6 flex-wrap">
          <button
            onClick={handleToggleStatus}
            disabled={updateMutation.isPending}
            className={cn(
              "flex items-center gap-1 text-[10px] transition-colors",
              isResolved
                ? "text-muted-foreground hover:text-foreground"
                : "text-green-600 dark:text-green-400 hover:opacity-80",
            )}
          >
            {updateMutation.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : isResolved ? (
              <RotateCcw className="size-3" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            {isResolved ? "Reopen" : "Resolve"}
          </button>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="size-3" />
            {hasReplies
              ? `${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`
              : "Reply"}
            {hasReplies &&
              (expanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              ))}
          </button>

          {isAuthor && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors ml-auto"
              title="Delete comment"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Replies section */}
      {expanded && (
        <div className="ml-5 border-l border-border/60 pl-3 pr-3 pb-2.5 bg-muted/10">
          {comment.replies.map((reply: any) => (
            <ReplyRow
              key={reply._id}
              reply={reply}
              currentUserId={currentUserId}
              onDelete={handleDeleteReply}
              isPending={deleteReplyMutation.isPending}
            />
          ))}
          <div className="flex items-center gap-1.5 mt-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSendReply()
              }
              placeholder="Reply…"
              className="flex-1 min-w-0 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || addReplyMutation.isPending}
              className="p-1 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 shrink-0"
            >
              {addReplyMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ReplyRow({
  reply,
  currentUserId,
  onDelete,
  isPending,
}: {
  reply: CommentReply;
  currentUserId: string | undefined;
  onDelete: (replyId: string) => void;
  isPending: boolean;
}) {
  const isAuthor = currentUserId === reply.author._id;
  return (
    <div className="group flex items-start gap-2 py-1.5 min-w-0">
      <Avatar author={reply.author} size={4} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[10px] font-semibold truncate">
            {reply.author.name}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {timeAgo(reply.createdAt)}
          </span>
          {isAuthor && (
            <button
              onClick={() => onDelete(reply._id)}
              disabled={isPending}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
        <p className="text-xs text-foreground leading-relaxed wrap-break-word whitespace-pre-wrap">
          {reply.content}
        </p>
      </div>
    </div>
  );
}

// ── Main ReviewTab ───────────────────────────────────────────────────────────
export default function ReviewTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { editorRef, scrollToLineRef, scrollToPdfLineRef } = usePageStore();
  const { user } = useAuth();

  const [filter, setFilter] = useState<Filter>("open");
  const [showAddForm, setShowAddForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: {
      content: "",
      line: null,
      lineEnd: null,
    },
  });

  const lineStartVal = watch("line");
  const lineEndVal = watch("lineEnd");

  const { data: comments = [], isLoading } = usePageComments(pageId ?? null);
  const createMutation = useCreateComment();
  const { pendingComment, clearPendingComment } = useActionsStore();

  const handleNavigateToLine = (line: number) => {
    scrollToLineRef.current?.(line);
    scrollToPdfLineRef.current?.(line);
  };

  useEffect(() => {
    if (!pendingComment) return;
    setValue("line", pendingComment.startLine);
    setValue("lineEnd", pendingComment.endLine);
    setValue("content", "");
    setShowAddForm(true);
    clearPendingComment();
  }, [pendingComment, setValue, clearPendingComment]);

  const filtered = comments.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const openCount = comments.filter((c) => c.status === "open").length;
  const resolvedCount = comments.filter((c) => c.status === "resolved").length;

  const onSubmit = (data: CreateCommentInput) => {
    if (!pageId) return;
    createMutation.mutate(
      {
        pageId,
        content: data.content,
        line: data.line,
        lineEnd: data.lineEnd,
      },
      {
        onSuccess: () => {
          reset();
          setShowAddForm(false);
        },
      },
    );
  };

  const handleOpenAddForm = () => {
    const line = editorRef.current?.getPosition()?.lineNumber;
    if (line) {
      setValue("line", line);
      setValue("lineEnd", line);
    }
    setShowAddForm(true);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground">
      {/* ── Header ── */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MessageSquare className="size-3.5" />
          Review
          {openCount > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium normal-case tracking-normal">
              {openCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleOpenAddForm}
            title="Add comment"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
          >
            <MessageSquarePlus className="size-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Add comment form (React Hook Form + Zod) ── */}
      {showAddForm && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="border-b border-border px-3 py-3 bg-muted/20">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground">
                New comment
              </span>
              {(lineStartVal || lineEndVal) && (
                <span className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  L{lineStartVal}
                  {lineEndVal && lineEndVal !== lineStartVal
                    ? `–${lineEndVal}`
                    : ""}
                </span>
              )}
            </div>

            <textarea
              autoFocus
              {...register("content")}
              placeholder="Describe your feedback…"
              rows={3}
              className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 mb-2"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="shrink-0">Lines:</span>
                <input
                  type="number"
                  {...register("line", { valueAsNumber: true })}
                  placeholder="start"
                  className="w-14 text-xs bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <span>–</span>
                <input
                  type="number"
                  {...register("lineEnd", { valueAsNumber: true })}
                  placeholder="end"
                  className="w-14 text-xs bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <div className="flex gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    reset();
                  }}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || isSubmitting}
                  className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Send className="size-3" />
                  )}
                  Post
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── Filter bar ── */}
      <div className="flex shrink-0 gap-1 border-b border-border px-2 py-2">
        {(
          [
            { key: "all", label: "All", count: comments.length },
            { key: "open", label: "Open", count: openCount },
            { key: "resolved", label: "Resolved", count: resolvedCount },
          ] as const
        ).map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
                active
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              <span className="truncate">{item.label}</span>
              <span
                className={cn(
                  "rounded-full px-1 text-[9px]",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Comment list ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-10 text-center text-muted-foreground">
            <MessageSquare className="size-8 opacity-25" />
            <p className="text-xs font-medium text-foreground/70">
              {filter === "all" ? "No comments yet" : `No ${filter} comments`}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {filter === "all"
                ? "No comments yet. Click + to add one."
                : `No ${filter} comments.`}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((comment) => (
              <CommentCard
                key={comment._id}
                comment={comment}
                pageId={pageId!}
                currentUserId={user?._id}
                onNavigate={
                  comment.line != null ? handleNavigateToLine : undefined
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
