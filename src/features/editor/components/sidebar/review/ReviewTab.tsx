'use client';
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
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
  FileCheck,
  GitPullRequest,
} from "lucide-react";
import {
  createCommentSchema,
  createReplySchema,
  type CreateCommentInput,
  type CreateReplyInput,
} from "@/features/editor/schemas";
import {
  usePageComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useAddReply,
  useDeleteReply,
  useResolveComment,
} from "@/features/editor/hooks/use-comment";
import {
  usePageSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptAllSuggestions,
  useRejectAllSuggestions,
} from "@/features/editor/hooks/use-suggestion";
import type { PageComment, CommentReply, PageSuggestion } from "@/features/editor/types";
import { usePageStore, useActionsStore } from "@/features/editor/store";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { cn } from "@/shared/lib/utils";
import { Form } from "@/shared/components/ui";


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
  author?: { name?: string; avatar?: string | null };
  size?: number;
}) {
  const sizePx = size * 4;
  const iconSizePx = Math.round(sizePx * 0.55);

  if (author?.avatar) {
    return (
      <img
        src={author.avatar}
        alt={author.name || 'User avatar'}
        style={{ width: sizePx, height: sizePx }}
        className="rounded-full object-cover shrink-0"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      style={{ width: sizePx, height: sizePx }}
      className="rounded-full bg-primary/10 flex items-center justify-center shrink-0"
    >
      <User style={{ width: iconSizePx, height: iconSizePx }} className="text-primary shrink-0" />
    </div>
  );
}

// ── Single comment card ──────────────────────────────────────────────────────
const CommentCard = React.memo(function CommentCard({
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

  const replyForm = useForm<CreateReplyInput>({
    resolver: zodResolver(createReplySchema),
    defaultValues: {
      content: "",
    },
  });

  const resolveMutation = useResolveComment();
  const deleteMutation = useDeleteComment();
  const addReplyMutation = useAddReply();
  const deleteReplyMutation = useDeleteReply();

  const isAuthor = currentUserId === comment.author.id;
  const isResolved = comment.status === "resolved";
  const hasReplies = comment.replies.length > 0;
  const lineEnd = comment.lineEnd;

  const handleToggleStatus = () => {
    resolveMutation.mutate({
      pageId,
      commentId: comment.id,
      resolved: !isResolved,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ pageId, commentId: comment.id });
  };

  const handleSendReply = (data: CreateReplyInput) => {
    addReplyMutation.mutate(
      { pageId, commentId: comment.id, content: data.content },
      { onSuccess: () => replyForm.reset() },
    );
  };

  const handleDeleteReply = (replyId: string) => {
    deleteReplyMutation.mutate({ pageId, commentId: comment.id, replyId });
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
          <span className="text-xs font-semibold truncate flex-1 min-w-0">
            {comment.author.name}
          </span>
          {isResolved ? (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="size-2.5 shrink-0" />
              Resolved
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              <Circle className="size-2.5 shrink-0" />
              Open
            </span>
          )}
        </div>

        {/* Row 2: line badge + timestamp */}
        <div className="flex items-center gap-1.5 mb-2 ml-6">
          {comment.line != null && (
            <button
              onClick={() => onNavigate?.(comment.line!)}
              className="text-xs font-mono border border-border bg-background px-1.5 py-0.5 rounded text-foreground shrink-0 hover:bg-muted transition-colors cursor-pointer"
              title="Jump to line"
            >
              L{comment.line}
              {lineEnd != null && lineEnd !== comment.line
                ? `\u2013${lineEnd}`
                : ""}
            </button>
          )}
          <span className="text-xs text-muted-foreground">
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
            disabled={resolveMutation.isPending}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              isResolved
                ? "text-muted-foreground hover:bg-muted"
                : "text-success hover:opacity-80",
            )}
          >
            {resolveMutation.isPending ? (
              <Loader2 className="size-3 animate-spin shrink-0" />
            ) : isResolved ? (
              <RotateCcw className="size-3 shrink-0" />
            ) : (
              <CheckCircle2 className="size-3 shrink-0" />
            )}
            {isResolved ? "Reopen" : "Resolve"}
          </button>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-foreground hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
          >
            <MessageSquare className="size-3 shrink-0" />
            {hasReplies
              ? `${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`
              : "Reply"}
            {hasReplies &&
              (expanded ? (
                <ChevronDown className="size-3 shrink-0" />
              ) : (
                <ChevronRight className="size-3 shrink-0" />
              ))}
          </button>

          {isAuthor && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-muted transition-colors ml-auto"
              title="Delete comment"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-3 animate-spin shrink-0" />
              ) : (
                <Trash2 className="size-3 shrink-0" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Replies section */}
      {expanded && (
        <div className="ml-5 border-l border-border pl-3 pr-3 pb-2.5 bg-muted">
          {comment.replies.map((reply: CommentReply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onDelete={handleDeleteReply}
              isPending={deleteReplyMutation.isPending}
            />
          ))}
          <Form {...replyForm}>
            <form
              onSubmit={replyForm.handleSubmit(handleSendReply)}
              className="flex items-center gap-1.5 mt-2"
            >
              <input
                {...replyForm.register("content")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    replyForm.handleSubmit(handleSendReply)();
                  }
                }}
                placeholder="Reply…"
                className="flex-1 min-w-0 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={addReplyMutation.isPending || replyForm.formState.isSubmitting}
                className="p-1 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
              >
                {addReplyMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                ) : (
                  <Send className="size-3.5 shrink-0" />
                )}
              </button>
            </form>
          </Form>
        </div>
      )}
    </li>
  );
});

const ReplyRow = React.memo(function ReplyRow({
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
  const isAuthor = currentUserId === reply.author.id;
  return (
    <div className="group flex items-start gap-2 py-1.5 min-w-0">
      <Avatar author={reply.author} size={4} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-xs font-semibold truncate">
            {reply.author.name}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {timeAgo(reply.createdAt)}
          </span>
          {isAuthor && (
            <button
              onClick={() => onDelete(reply.id)}
              disabled={isPending}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:bg-muted shrink-0"
            >
              <Trash2 className="size-3 shrink-0" />
            </button>
          )}
        </div>
        <p className="text-xs text-foreground leading-relaxed wrap-break-word whitespace-pre-wrap">
          {reply.content}
        </p>
      </div>
    </div>
  );
});

// ── Suggestion Card (Track Changes) ──────────────────────────────────────────
const SuggestionCard = React.memo(function SuggestionCard({
  suggestion,
  pageId,
  onNavigate,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: {
  suggestion: PageSuggestion;
  pageId: string;
  onNavigate?: (line: number) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
}) {
  const isPending = suggestion.status === 'pending';
  const typeColor =
    suggestion.type === 'insert'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : suggestion.type === 'delete'
        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';

  return (
    <div
      className={cn(
        'mx-3 my-2 rounded-lg border bg-background p-3 space-y-2.5 transition-colors text-xs',
        isPending ? 'border-border shadow-xs' : 'border-border/40 opacity-70',
      )}
    >
      {/* Author & Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar author={suggestion.author} size={5} />
          <div className="min-w-0 leading-tight">
            <span className="font-semibold text-foreground truncate block text-xs">
              {suggestion.author.name}
            </span>
            <span className="text-10 text-muted-foreground">
              {timeAgo(suggestion.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-10 font-medium capitalize border',
              typeColor,
            )}
          >
            {suggestion.type}
          </span>
          {suggestion.fromLine && (
            <button
              type="button"
              onClick={() => onNavigate?.(suggestion.fromLine)}
              className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-10 font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={`Jump to line ${suggestion.fromLine}`}
            >
              L{suggestion.fromLine}
            </button>
          )}
        </div>
      </div>

      {/* Diff Preview */}
      <div className="rounded bg-muted/40 p-2 font-mono text-11 leading-relaxed break-words space-y-1 border border-border/50">
        {suggestion.originalText && (
          <div className="text-rose-600 dark:text-rose-400 line-through bg-rose-500/10 px-1.5 py-0.5 rounded">
            - {suggestion.originalText}
          </div>
        )}
        {suggestion.suggestedText && (
          <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            + {suggestion.suggestedText}
          </div>
        )}
      </div>

      {/* Note / Description if any */}
      {suggestion.description && (
        <p className="text-muted-foreground text-11 italic">
          "{suggestion.description}"
        </p>
      )}

      {/* Accept / Reject Action Buttons */}
      {isPending ? (
        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
          <button
            type="button"
            onClick={() => onReject(suggestion.id)}
            disabled={isRejecting || isAccepting}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="size-3.5 shrink-0" />
            <span>Reject</span>
          </button>
          <button
            type="button"
            onClick={() => onAccept(suggestion.id)}
            disabled={isAccepting || isRejecting}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span>Accept</span>
          </button>
        </div>
      ) : (
        <div className="pt-1 text-10 text-muted-foreground text-right italic">
          Status: <span className="font-medium capitalize">{suggestion.status}</span>
        </div>
      )}
    </div>
  );
});

const ReviewTab = React.memo(function ReviewTab({ onClose }: { onClose?: () => void }) {
  const { pageId: rootPageId } = useParams<{ pageId: string }>();
  const storeActivePageId = usePageStore((s) => s.activePageId);
  const pageId = storeActivePageId || rootPageId;
  const editorRef = usePageStore((s) => s.editorRef);
  const scrollToLineRef = usePageStore((s) => s.scrollToLineRef);
  const scrollToPdfLineRef = usePageStore((s) => s.scrollToPdfLineRef);
  const { user } = useAuth();

  const [subTab, setSubTab] = useState<'comments' | 'changes'>('comments');
  const [filter, setFilter] = useState<Filter>('open');
  const [showAddForm, setShowAddForm] = useState(false);

  const form = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: {
      content: '',
      line: null,
      lineEnd: null,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { isSubmitting },
  } = form;

  const lineStartVal = useWatch({ control, name: 'line' });
  const lineEndVal = useWatch({ control, name: 'lineEnd' });

  const { data: comments = [], isLoading } = usePageComments(pageId ?? null);
  const { data: suggestions = [], isLoading: isSuggestionsLoading } = usePageSuggestions(pageId ?? null);
  const createMutation = useCreateComment();
  const acceptMutation = useAcceptSuggestion();
  const rejectMutation = useRejectSuggestion();
  const acceptAllMutation = useAcceptAllSuggestions();
  const rejectAllMutation = useRejectAllSuggestions();
  const pendingComment = useActionsStore((s) => s.pendingComment);
  const clearPendingComment = useActionsStore((s) => s.clearPendingComment);

  const handleNavigateToLine = useCallback((line: number) => {
    scrollToLineRef.current?.(line);
    scrollToPdfLineRef.current?.(line);
  }, [scrollToLineRef, scrollToPdfLineRef]);

  useEffect(() => {
    if (!pendingComment) return;
    setValue('line', pendingComment.startLine);
    setValue('lineEnd', pendingComment.endLine);
    setValue('content', '');
    setShowAddForm(true);
    clearPendingComment();
  }, [pendingComment, setValue, clearPendingComment]);

  const filtered = comments.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const openCount = comments.filter((c) => c.status === 'open').length;
  const resolvedCount = comments.filter((c) => c.status === 'resolved').length;
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  const onSubmit = (data: CreateCommentInput) => {
    if (!pageId) return;
    createMutation.mutate(
      {
        pageId,
        content: data.content,
        line: data.line ?? undefined,
        lineEnd: data.lineEnd ?? undefined,
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
      setValue('line', line);
      setValue('lineEnd', line);
    }
    setShowAddForm(true);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* ── Top Header ── */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-background">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MessageSquare className="size-3.5 shrink-0" />
          Review & Phản biện
        </span>
        <div className="flex items-center gap-0.5">
          {subTab === 'comments' && (
            <button
              type="button"
              onClick={handleOpenAddForm}
              title="Add comment"
              className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-sidebar-hover cursor-pointer"
            >
              <MessageSquarePlus className="size-4 shrink-0" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-sidebar-hover cursor-pointer"
            >
              <X className="size-3.5 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* ── Sub-tab Switcher: Comments vs Track Changes ── */}
      <div className="flex border-b border-border bg-background p-1 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setSubTab('comments')}
          className={cn(
            'flex-1 py-1 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
            subTab === 'comments'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MessageSquare className="size-3.5 shrink-0" />
          <span>Comments ({openCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('changes')}
          className={cn(
            'flex-1 py-1 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer',
            subTab === 'changes'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <GitPullRequest className="size-3.5 shrink-0" />
          <span>Track Changes ({pendingSuggestions.length})</span>
        </button>
      </div>

      {/* ── VIEW 1: COMMENTS ── */}
      {subTab === 'comments' && (
        <>
          {/* Add comment form */}
          {showAddForm && (
            <div className="border-b border-border bg-muted/20 p-3">
              <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">New Comment</span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5 shrink-0" />
                    </button>
                  </div>
                  <textarea
                    {...register('content')}
                    placeholder="Leave a comment on this line..."
                    className="min-h-[60px] w-full resize-none rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-10 text-muted-foreground">
                      {lineStartVal ? `Line ${lineStartVal}` : 'Whole document'}
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="size-3" />
                      Post
                    </button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 border-b border-border px-3 py-1.5 text-xs shrink-0">
            {(
              [
                { id: 'open', label: 'Open', count: openCount },
                { id: 'resolved', label: 'Resolved', count: resolvedCount },
                { id: 'all', label: 'All', count: comments.length },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  'px-2 py-0.5 rounded text-xs transition-colors cursor-pointer',
                  filter === item.id
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>

          {/* Comment list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin shrink-0" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-10 text-center text-muted-foreground">
                <MessageSquare className="size-8 opacity-25 shrink-0" />
                <p className="text-xs font-medium text-foreground/70">
                  {filter === 'all' ? 'No comments yet' : `No ${filter} comments`}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Click + to add a review comment.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {filtered.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    pageId={pageId!}
                    currentUserId={user?.id}
                    onNavigate={comment.line != null ? handleNavigateToLine : undefined}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ── VIEW 2: TRACK CHANGES (SUGGESTIONS) ── */}
      {subTab === 'changes' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Actions: Accept All / Reject All */}
          {pendingSuggestions.length > 0 && (
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-2 text-xs shrink-0">
              <span className="text-muted-foreground font-medium">
                {pendingSuggestions.length} pending edit{pendingSuggestions.length > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => pageId && rejectAllMutation.mutate({ pageId })}
                  disabled={rejectAllMutation.isPending}
                  className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  Reject All
                </button>
                <button
                  type="button"
                  onClick={() => pageId && acceptAllMutation.mutate({ pageId })}
                  disabled={acceptAllMutation.isPending}
                  className="px-2.5 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors cursor-pointer"
                >
                  Accept All
                </button>
              </div>
            </div>
          )}

          {/* Suggestions List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isSuggestionsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin shrink-0" />
                <span className="text-xs">Loading suggestions…</span>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-5 py-10 text-center text-muted-foreground">
                <GitPullRequest className="size-8 opacity-25 shrink-0" />
                <p className="text-xs font-medium text-foreground/70">No suggestions</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Turn on "Review" mode in the top bar to propose edits, or select text and click "Suggest Edit".
                </p>
              </div>
            ) : (
              <div className="flex flex-col py-1">
                {suggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    pageId={pageId!}
                    onNavigate={handleNavigateToLine}
                    onAccept={(suggId) =>
                      pageId && acceptMutation.mutate({ pageId, suggestionId: suggId })
                    }
                    onReject={(suggId) =>
                      pageId && rejectMutation.mutate({ pageId, suggestionId: suggId })
                    }
                    isAccepting={acceptMutation.isPending}
                    isRejecting={rejectMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default ReviewTab;
