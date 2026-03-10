import React, { useState, useEffect } from "react";
import { useParams } from "react-router";
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
  usePageComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useAddReply,
  useDeleteReply,
} from "~/query/comment";
import type { PageComment, CommentReply } from "~/types/page";
import { usePageContext } from "../../PageContext";
import { useUserStore } from "~/stores/user";
import { useWorkspaceActionsStore } from "~/stores/workspace-actions";
import { cn } from "~/lib/utils";

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

// ── Single comment card ────────────────────────────────────────────────────────
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
          {comment.replies.map((reply) => (
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

// ── Main ReviewTab ─────────────────────────────────────────────────────────────
export default function ReviewTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { editorRef, scrollToLineRef, scrollToPdfLineRef } = usePageContext();
  const { user } = useUserStore();

  const [filter, setFilter] = useState<Filter>("open");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newLineStart, setNewLineStart] = useState<string>("");
  const [newLineEnd, setNewLineEnd] = useState<string>("");

  const { data: comments = [], isLoading } = usePageComments(pageId ?? null);
  const createMutation = useCreateComment();
  const { pendingComment, clearPendingComment } = useWorkspaceActionsStore();

  const handleNavigateToLine = (line: number) => {
    scrollToLineRef.current?.(line);
    scrollToPdfLineRef.current?.(line);
  };

  // Pre-fill form when "Add Comment" is triggered from editor context menu
  useEffect(() => {
    if (!pendingComment) return;
    setNewLineStart(String(pendingComment.startLine));
    setNewLineEnd(String(pendingComment.endLine));
    setNewContent("");
    setShowAddForm(true);
    clearPendingComment();
  }, [pendingComment]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = comments.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const openCount = comments.filter((c) => c.status === "open").length;
  const resolvedCount = comments.filter((c) => c.status === "resolved").length;

  const handleCreate = () => {
    if (!pageId || !newContent.trim()) return;
    const startNum = newLineStart ? parseInt(newLineStart, 10) : null;
    const endNum = newLineEnd ? parseInt(newLineEnd, 10) : null;
    createMutation.mutate(
      {
        pageId,
        content: newContent.trim(),
        line: startNum && !isNaN(startNum) ? startNum : null,
        lineEnd: endNum && !isNaN(endNum) ? endNum : null,
      },
      {
        onSuccess: () => {
          setNewContent("");
          setNewLineStart("");
          setNewLineEnd("");
          setShowAddForm(false);
        },
      },
    );
  };

  const handleOpenAddForm = () => {
    const line = editorRef.current?.getPosition()?.lineNumber;
    if (line) {
      setNewLineStart(String(line));
      setNewLineEnd(String(line));
    }
    setShowAddForm(true);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-border shrink-0">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
            onClick={handleOpenAddForm}
            title="Add comment"
            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <MessageSquarePlus className="size-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Add comment form ── */}
      {showAddForm && (
        <div className="px-3 py-2.5 border-b border-border bg-muted/20 shrink-0">
          {/* Form header */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              New comment
            </span>
            {(newLineStart || newLineEnd) && (
              <span className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                L{newLineStart}
                {newLineEnd && newLineEnd !== newLineStart
                  ? `–${newLineEnd}`
                  : ""}
              </span>
            )}
          </div>

          <textarea
            autoFocus
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && handleCreate()}
            placeholder="Describe your feedback…"
            rows={3}
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 mb-2"
          />

          <div className="flex items-center gap-2 flex-wrap">
            {/* Line range inputs */}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="shrink-0">Lines:</span>
              <input
                type="number"
                value={newLineStart}
                onChange={(e) => setNewLineStart(e.target.value)}
                placeholder="start"
                className="w-14 text-xs bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <span>–</span>
              <input
                type="number"
                value={newLineEnd}
                onChange={(e) => setNewLineEnd(e.target.value)}
                placeholder="end"
                className="w-14 text-xs bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewContent("");
                  setNewLineStart("");
                  setNewLineEnd("");
                }}
                className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newContent.trim() || createMutation.isPending}
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
      )}

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border shrink-0">
        {(
          [
            { key: "all", label: "All", count: comments.length },
            { key: "open", label: "Open", count: openCount },
            { key: "resolved", label: "Resolved", count: resolvedCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 text-[11px] rounded transition-colors",
              filter === tab.key
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "text-[9px] font-medium rounded-full px-1",
                filter === tab.key
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Comment list ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground gap-2 px-4">
            <MessageSquare className="size-8 opacity-25" />
            <p className="text-xs text-center leading-relaxed">
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
