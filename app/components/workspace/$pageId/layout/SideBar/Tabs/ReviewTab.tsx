import React, { useState, useRef, useEffect } from "react";
import { useParams } from "react-router";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
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
}: {
  comment: PageComment;
  pageId: string;
  currentUserId: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const addReplyMutation = useAddReply();
  const deleteReplyMutation = useDeleteReply();

  const isAuthor = currentUserId === comment.author._id;
  const isResolved = comment.status === "resolved";

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
      className={cn(
        "border-b border-border transition-colors",
        isResolved && "opacity-60",
      )}
    >
      {/* Main comment row */}
      <div className="px-3 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-2">
          <Avatar author={comment.author} size={6} />

          <div className="flex-1 min-w-0">
            {/* Author + meta */}
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-medium truncate">
                {comment.author.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {comment.line != null && (
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                    L{comment.line}
                    {(comment as any).lineEnd != null &&
                    (comment as any).lineEnd !== comment.line
                      ? `–${(comment as any).lineEnd}`
                      : ""}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {timeAgo(comment.createdAt)}
                </span>
              </div>
            </div>

            {/* Content */}
            <p className="text-xs text-foreground leading-relaxed">
              {comment.content}
            </p>

            {/* Footer actions */}
            <div className="flex items-center gap-2 mt-2">
              {/* Resolve / Reopen */}
              <button
                onClick={handleToggleStatus}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                title={isResolved ? "Reopen" : "Mark resolved"}
              >
                {isResolved ? (
                  <>
                    <RotateCcw className="size-3" />
                    Reopen
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3 text-green-500" />
                    Resolve
                  </>
                )}
              </button>

              {/* Reply toggle */}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="size-3" />
                {comment.replies.length > 0
                  ? `${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`
                  : "Reply"}
                {comment.replies.length > 0 &&
                  (expanded ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  ))}
              </button>

              {/* Delete — author only */}
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
        </div>
      </div>

      {/* Replies section */}
      {expanded && (
        <div className="pl-7 pr-3 pb-2 border-t border-border/50 bg-muted/20">
          {/* Existing replies */}
          {comment.replies.map((reply) => (
            <ReplyRow
              key={reply._id}
              reply={reply}
              pageId={pageId}
              commentId={comment._id}
              currentUserId={currentUserId}
              onDelete={handleDeleteReply}
              isPending={deleteReplyMutation.isPending}
            />
          ))}

          {/* Add reply input */}
          <div className="flex items-center gap-1.5 mt-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSendReply()
              }
              placeholder="Write a reply…"
              className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || addReplyMutation.isPending}
              className="p-1 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
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
  pageId,
  commentId,
  currentUserId,
  onDelete,
  isPending,
}: {
  reply: CommentReply;
  pageId: string;
  commentId: string;
  currentUserId: string | undefined;
  onDelete: (replyId: string) => void;
  isPending: boolean;
}) {
  const isAuthor = currentUserId === reply.author._id;
  return (
    <div className="group flex items-start gap-2 py-1.5">
      <Avatar author={reply.author} size={5} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium">{reply.author.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {timeAgo(reply.createdAt)}
          </span>
          {isAuthor && (
            <button
              onClick={() => onDelete(reply._id)}
              disabled={isPending}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
        <p className="text-xs text-foreground leading-relaxed">
          {reply.content}
        </p>
      </div>
    </div>
  );
}

// ── Main ReviewTab ─────────────────────────────────────────────────────────────
export default function ReviewTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const { currentPage, editorRef } = usePageContext();
  const { user } = useUserStore();

  const [filter, setFilter] = useState<Filter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newLineStart, setNewLineStart] = useState<string>("");
  const [newLineEnd, setNewLineEnd] = useState<string>("");

  const { data: comments = [], isLoading } = usePageComments(pageId ?? null);
  const createMutation = useCreateComment();
  const { pendingComment, clearPendingComment } = useWorkspaceActionsStore();

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

  /** Pre-fill line number from the Monaco editor's current cursor position. */
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
      <div className="flex w-full items-center justify-between px-3 h-8 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Review
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
        <div className="px-3 py-2 border-b border-border bg-muted/20 shrink-0 flex flex-col gap-2">
          <textarea
            autoFocus
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={newLineStart}
                onChange={(e) => setNewLineStart(e.target.value)}
                placeholder="L start"
                className="w-16 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <input
                type="number"
                value={newLineEnd}
                onChange={(e) => setNewLineEnd(e.target.value)}
                placeholder="L end"
                className="w-16 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
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
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Send className="size-3" />
                )}
                Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-border shrink-0">
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
              "px-2 py-0.5 text-xs rounded transition-colors",
              filter === tab.key
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-primary hover:bg-primary/5",
            )}
          >
            {tab.label}
            <span className="ml-1 opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* ── Comment list ── */}
      <div className="flex-1 overflow-y-auto">
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
                ? "No comments yet.\nClick the + button to add one."
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
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
