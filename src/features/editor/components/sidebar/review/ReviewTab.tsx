'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  List,
  Loader2,
  MessageSquare,
  MessageSquareCheck,
  MessageSquarePlus,
  MoreVertical,
  RotateCcw,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  createCommentSchema,
  createReplySchema,
  type CreateCommentInput,
  type CreateReplyInput,
} from '@/features/editor/schemas';
import {
  usePageComments,
  useCreateComment,
  useDeleteComment,
  useAddReply,
  useDeleteReply,
  useResolveComment,
} from '@/features/editor/hooks/use-comment';
import {
  usePageSuggestions,
  useAcceptSuggestion,
  useRejectSuggestion,
  useAcceptAllSuggestions,
  useRejectAllSuggestions,
} from '@/features/editor/hooks/use-suggestion';
import type { PageComment, CommentReply, PageSuggestion } from '@/features/editor/types';
import { usePageStore, useActionsStore, useSettingsStore } from '@/features/editor/store';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { useActiveDocument, filesQuery } from '@/features/editor/hooks/use-core';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { Form } from '@/shared/components/ui/form';
import { toast } from 'sonner';
import { ProjectService } from '@/features/projects/shell/services/project.service';
import { MentionTextarea } from './subcomponents/MentionTextarea';
import { MentionRenderer } from './subcomponents/MentionBadge';
import { NotificationDigestBadge } from './subcomponents/NotificationDigestBadge';
import { OverleafReviewSolidIcon } from './subcomponents/OverleafReviewIcon';
import { type MentionMember, extractMentions } from '@/features/editor/utils/mention.util';

function formatOverleafDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[d.getMonth()];
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
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
      className="rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20"
    >
      <User style={{ width: iconSizePx, height: iconSizePx }} className="text-primary shrink-0" />
    </div>
  );
}

import { PlaneEmptyState, PlaneErrorState } from '@/shared/components/ui';

// ── Empty Review State (Overleaf Parity) ─────────────────────────────────────
function EmptyReviewState({
  title = 'No comments or suggestions',
  subtitle = 'No one has commented or left any suggestions yet.',
  action,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <PlaneEmptyState
      variant="review"
      isCompact
      title={title}
      description={subtitle}
      action={action}
    />
  );
}

// ── Single comment card (Overleaf 1:1 Parity) ────────────────────────────────
const CommentCard = React.memo(function CommentCard({
  comment,
  pageId,
  currentUserId,
  onNavigate,
  isHighlighted = false,
  members = [],
  membersMap,
}: {
  comment: PageComment;
  pageId: string;
  currentUserId: string | undefined;
  onNavigate?: (line: number) => void;
  isHighlighted?: boolean;
  members?: MentionMember[];
  membersMap?: Map<string, MentionMember>;
}) {
  const replyForm = useForm<CreateReplyInput>({
    resolver: zodResolver(createReplySchema),
    defaultValues: {
      content: '',
    },
  });

  const replyContent = useWatch({ control: replyForm.control, name: 'content' }) || '';

  const resolveMutation = useResolveComment();
  const deleteMutation = useDeleteComment();
  const addReplyMutation = useAddReply();
  const deleteReplyMutation = useDeleteReply();

  const isAuthor = Boolean(
    currentUserId && (
      currentUserId === comment.author?.id ||
      (comment as any).createdById === currentUserId ||
      (comment as any).authorId === currentUserId
    )
  );

  const authorDisplay = useMemo(() => {
    const authorObj = comment.author || (comment as any).user;
    const authorId = authorObj?.id || (comment as any).authorId || (comment as any).userId;
    const matched = authorId ? membersMap?.get(authorId) : undefined;
    return {
      name:
        matched?.name ||
        (authorObj?.name && authorObj.name !== 'Collaborator' ? authorObj.name : undefined) ||
        matched?.email?.split('@')[0] ||
        authorObj?.name ||
        'Collaborator',
      color: (matched as any)?.color || (authorObj as any)?.color || '#0ea5e9',
    };
  }, [comment, membersMap]);

  const isResolved = comment.status === 'resolved';
  const hasReplies = comment.replies && comment.replies.length > 0;

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
    if (!data.content?.trim()) return;
    addReplyMutation.mutate(
      { pageId, commentId: comment.id, content: data.content },
      {
        onSuccess: () => {
          replyForm.reset();
        },
      },
    );
  };

  const handleDeleteReply = (replyId: string) => {
    deleteReplyMutation.mutate({ pageId, commentId: comment.id, replyId });
  };

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        'rounded-lg border p-3 bg-card text-card-foreground mb-2.5 transition-colors duration-150',
        isHighlighted
          ? 'border-primary ring-1 ring-primary/40'
          : 'border-border hover:border-border/80',
        isResolved && 'opacity-65',
      )}
    >
      {/* Row 1: Header (color block + author + resolve + more) */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="size-2.5 rounded-[2px] shrink-0"
            style={{ backgroundColor: authorDisplay.color }}
          />
          <span className="text-[13px] font-medium text-foreground truncate">
            {authorDisplay.name}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={resolveMutation.isPending}
            title={isResolved ? 'Reopen comment' : 'Resolve comment'}
            aria-label={isResolved ? 'Reopen comment' : 'Resolve comment'}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
          >
            {resolveMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isResolved ? (
              <RotateCcw className="size-3.5" />
            ) : (
              <Check className="size-3.5" />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Comment options"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
              >
                <MoreVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-36 bg-popover border-border text-popover-foreground"
            >
              {comment.line != null && (
                <DropdownMenuItem
                  onClick={() => onNavigate?.(comment.line!)}
                  className="text-xs hover:bg-muted cursor-pointer"
                >
                  Jump to line {comment.line}
                </DropdownMenuItem>
              )}
              {isAuthor && (
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                >
                  Delete comment
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Overleaf Timestamp */}
      <div className="text-12 text-muted-foreground mt-0.5 leading-normal">
        {formatOverleafDate(comment.createdAt)}
      </div>

      {/* Row 3: Comment Body */}
      <div className="text-[13px] text-foreground mt-1.5 font-normal leading-relaxed whitespace-pre-wrap break-words">
        <MentionRenderer content={comment.content} />
      </div>

      {/* Row 4: Replies (if any) */}
      {hasReplies && (
        <div className="mt-2.5 pt-2 border-t border-border space-y-2">
          {comment.replies.map((reply: CommentReply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onDelete={handleDeleteReply}
              isPending={deleteReplyMutation.isPending}
              membersMap={membersMap}
            />
          ))}
        </div>
      )}

      {/* Row 5: Integrated Inline Reply Input */}
      <div className="mt-2.5">
        <form onSubmit={replyForm.handleSubmit(handleSendReply)} className="relative">
          <input
            type="text"
            value={replyContent}
            onChange={(e) =>
              replyForm.setValue('content', e.target.value, { shouldValidate: true })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                replyForm.handleSubmit(handleSendReply)();
              }
            }}
            placeholder="Reply"
            className="w-full h-8 px-2.5 rounded border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          {replyContent.trim().length > 0 && (
            <button
              type="submit"
              disabled={addReplyMutation.isPending}
              aria-label="Send reply"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary/80 transition-colors cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
            >
              {addReplyMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
});

const ReplyRow = React.memo(function ReplyRow({
  reply,
  currentUserId,
  onDelete,
  isPending,
  membersMap,
}: {
  reply: CommentReply;
  currentUserId: string | undefined;
  onDelete: (replyId: string) => void;
  isPending: boolean;
  membersMap?: Map<string, MentionMember>;
}) {
  const isAuthor = Boolean(
    currentUserId && (
      currentUserId === reply.author?.id ||
      (reply as any).createdById === currentUserId ||
      (reply as any).authorId === currentUserId
    )
  );

  const authorDisplay = useMemo(() => {
    const authorObj = reply.author || (reply as any).user;
    const authorId = authorObj?.id || (reply as any).authorId || (reply as any).userId;
    const matched = authorId ? membersMap?.get(authorId) : undefined;
    return {
      name:
        matched?.name ||
        (authorObj?.name && authorObj.name !== 'Collaborator' ? authorObj.name : undefined) ||
        matched?.email?.split('@')[0] ||
        authorObj?.name ||
        'Collaborator',
      color: (matched as any)?.color || '#38bdf8',
    };
  }, [reply, membersMap]);

  return (
    <div className="group flex flex-col py-1 text-xs">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="size-2 rounded-[2px] shrink-0"
            style={{ backgroundColor: authorDisplay.color }}
          />
          <span className="font-semibold text-foreground truncate text-12 leading-normal">
            {authorDisplay.name}
          </span>
          <span className="text-10 text-muted-foreground">
            {formatOverleafDate(reply.createdAt)}
          </span>
        </div>
        {isAuthor && (
          <button
            type="button"
            onClick={() => onDelete(reply.id)}
            disabled={isPending}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
            title="Delete reply"
            aria-label="Delete reply"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      <div className="text-foreground text-xs mt-1 pl-3.5 whitespace-pre-wrap break-words">
        <MentionRenderer content={reply.content} />
      </div>
    </div>
  );
});

// ── Suggestion Card (Track Changes) ──────────────────────────────────────────
const SuggestionCard = React.memo(function SuggestionCard({
  suggestion,
  pageId: _pageId,
  onNavigate,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
  isHighlighted = false,
  membersMap,
}: {
  suggestion: PageSuggestion;
  pageId: string;
  onNavigate?: (line: number) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
  isHighlighted?: boolean;
  membersMap?: Map<string, MentionMember>;
}) {
  const isPending = suggestion.status === 'pending';
  const typeColor =
    suggestion.type === 'insert'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
      : suggestion.type === 'delete'
        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';

  const authorDisplay = useMemo(() => {
    const authorObj = suggestion.author || (suggestion as any).user;
    const authorId = authorObj?.id || suggestion.authorId || (suggestion as any).userId;
    const matched = authorId ? membersMap?.get(authorId) : undefined;
    return {
      name:
        matched?.name ||
        (authorObj?.name && authorObj.name !== 'Collaborator' ? authorObj.name : undefined) ||
        matched?.email?.split('@')[0] ||
        authorObj?.name ||
        'Collaborator',
      avatar: matched?.avatar || authorObj?.avatar,
    };
  }, [suggestion, membersMap]);

  return (
    <div
      id={`suggestion-${suggestion.id}`}
      className={cn(
        'mb-2.5 rounded-lg border border-border bg-card p-3 space-y-2.5 transition-colors duration-150 text-xs text-card-foreground',
        isHighlighted && 'ring-1 ring-primary/40 border-primary',
        !isPending && 'opacity-70',
      )}
    >
      {/* Author & Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar author={authorDisplay} size={5} />
          <div className="min-w-0 leading-tight">
            <span className="font-semibold text-foreground truncate block text-xs">
              {authorDisplay.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatOverleafDate(suggestion.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize border',
              typeColor,
            )}
          >
            {suggestion.type}
          </span>
          {suggestion.fromLine && (
            <button
              type="button"
              onClick={() => onNavigate?.(suggestion.fromLine)}
              className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
              title={`Jump to line ${suggestion.fromLine}`}
            >
              L{suggestion.fromLine}
            </button>
          )}
        </div>
      </div>

      {/* Diff Preview */}
      <div className="rounded bg-muted/40 p-2 font-mono text-xs leading-relaxed break-words space-y-1 border border-border">
        {suggestion.originalText && (
          <div className="text-rose-600 dark:text-rose-400 line-through bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
            - {suggestion.originalText}
          </div>
        )}
        {suggestion.suggestedText && (
          <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            + {suggestion.suggestedText}
          </div>
        )}
      </div>

      {/* Note / Description if any */}
      {suggestion.description && (
        <p className="text-muted-foreground text-12 italic leading-normal">
          "{suggestion.description}"
        </p>
      )}

      {/* Accept / Reject Action Buttons */}
      {isPending ? (
        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
          <button
            type="button"
            onClick={() => onReject(suggestion.id)}
            disabled={isRejecting || isAccepting}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="size-3.5 shrink-0" />
            <span>Reject</span>
          </button>
          <button
            type="button"
            onClick={() => onAccept(suggestion.id)}
            disabled={isAccepting || isRejecting}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-50 cursor-pointer"
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

// ── Overview File Group Component ───────────────────────────────────────────
interface OverviewFileGroupProps {
  file: { id: string; title: string };
  currentUserId: string | undefined;
  showResolved: boolean;
  onNavigateToFile: (fileId: string, line?: number) => void;
  members: MentionMember[];
  membersMap?: Map<string, MentionMember>;
  onCountChange?: (fileId: string, count: number, resolvedCount: number) => void;
}

const OverviewFileGroup = React.memo(function OverviewFileGroup({
  file,
  currentUserId,
  showResolved,
  onNavigateToFile,
  members,
  membersMap,
  onCountChange,
}: OverviewFileGroupProps) {
  const { data: comments = [], isLoading: isCommentsLoading } = usePageComments(file.id);
  const { data: suggestions = [], isLoading: isSuggestionsLoading } = usePageSuggestions(file.id);
  const acceptMutation = useAcceptSuggestion();
  const rejectMutation = useRejectSuggestion();

  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);
  const resolvedComments = useMemo(() => comments.filter((c) => c.status === 'resolved'), [comments]);
  const pendingSuggestions = useMemo(() => suggestions.filter((s) => s.status === 'pending'), [suggestions]);
  const resolvedSuggestions = useMemo(
    () => suggestions.filter((s) => s.status === 'accepted' || s.status === 'rejected'),
    [suggestions],
  );

  const fileResolvedCount = resolvedComments.length + resolvedSuggestions.length;
  const visibleComments = showResolved ? comments : openComments;
  const visibleSuggestions = showResolved ? suggestions : pendingSuggestions;
  const totalVisibleCount = visibleComments.length + visibleSuggestions.length;

  useEffect(() => {
    onCountChange?.(file.id, totalVisibleCount, fileResolvedCount);
  }, [file.id, totalVisibleCount, fileResolvedCount, onCountChange]);

  if (isCommentsLoading || isSuggestionsLoading) {
    return (
      <div className="border-b border-border px-3.5 py-2.5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{file.title}</span>
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (totalVisibleCount === 0) {
    return null;
  }

  return (
    <div className="border-b border-border last:border-b-0">
      {/* File Section Header */}
      <div
        onClick={() => onNavigateToFile(file.id)}
        className="flex items-center justify-between px-3.5 py-2 bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors border-b border-border"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">{file.title}</span>
        </div>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-background text-foreground border border-border">
          {totalVisibleCount}
        </span>
      </div>

      {/* Items under this file */}
      <div className="flex flex-col">
        {visibleSuggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            pageId={file.id}
            onNavigate={(line) => onNavigateToFile(file.id, line)}
            onAccept={(suggId) => acceptMutation.mutate({ pageId: file.id, suggestionId: suggId })}
            onReject={(suggId) => rejectMutation.mutate({ pageId: file.id, suggestionId: suggId })}
            isAccepting={acceptMutation.isPending}
            isRejecting={rejectMutation.isPending}
            membersMap={membersMap}
          />
        ))}
        {visibleComments.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            pageId={file.id}
            currentUserId={currentUserId}
            onNavigate={(line) => onNavigateToFile(file.id, line)}
            members={members}
            membersMap={membersMap}
          />
        ))}
      </div>
    </div>
  );
});

// ── Overview View ───────────────────────────────────────────────────────────
function OverviewView({
  files,
  currentUserId,
  showResolved,
  onNavigateToFile,
  members,
  membersMap,
  onOverviewResolvedCount,
}: {
  files: Array<{ id: string; title: string }>;
  currentUserId: string | undefined;
  showResolved: boolean;
  onNavigateToFile: (fileId: string, line?: number) => void;
  members: MentionMember[];
  membersMap?: Map<string, MentionMember>;
  onOverviewResolvedCount?: (count: number) => void;
}) {
  const [fileCounts, setFileCounts] = useState<Record<string, { visible: number; resolved: number }>>({});

  const handleCountChange = useCallback((fileId: string, visible: number, resolved: number) => {
    setFileCounts((prev) => {
      if (prev[fileId]?.visible === visible && prev[fileId]?.resolved === resolved) {
        return prev;
      }
      return { ...prev, [fileId]: { visible, resolved } };
    });
  }, []);

  const totalVisible = Object.values(fileCounts).reduce((acc, curr) => acc + curr.visible, 0);
  const totalResolved = Object.values(fileCounts).reduce((acc, curr) => acc + curr.resolved, 0);

  useEffect(() => {
    onOverviewResolvedCount?.(totalResolved);
  }, [totalResolved, onOverviewResolvedCount]);

  if (files.length === 0) {
    return <EmptyReviewState />;
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {files.map((file) => (
        <OverviewFileGroup
          key={file.id}
          file={file}
          currentUserId={currentUserId}
          showResolved={showResolved}
          onNavigateToFile={onNavigateToFile}
          members={members}
          membersMap={membersMap}
          onCountChange={handleCountChange}
        />
      ))}
      {Object.keys(fileCounts).length >= files.length && totalVisible === 0 && (
        <EmptyReviewState
          title={totalResolved > 0 ? 'No open comments or suggestions' : 'No comments or suggestions'}
          subtitle={
            totalResolved > 0
              ? 'All comments across all files have been resolved.'
              : 'No one has commented or left any suggestions yet.'
          }
        />
      )}
    </div>
  );
}

// ── Main ReviewTab (White / Light Theme) ─────────────────────────────────────
export const ReviewTab = React.memo(function ReviewTab({ onClose }: { onClose?: () => void }) {
  const { pageId: rootPageId, projectId: routeProjectId } = useParams<{ pageId: string; projectId?: string }>();
  const storeActivePageId = usePageStore((s) => s.activePageId);
  const currentPage = usePageStore((s) => s.currentPage);
  const pageId = storeActivePageId || currentPage?.id || rootPageId;
  const storeProjectId = usePageStore((s) => s.projectId);
  const rawProjectId = currentPage?.projectId || routeProjectId || storeProjectId || '';
  const projectId = typeof rawProjectId === 'string' ? rawProjectId : (rawProjectId as any)?.id || '';

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { selectFile } = useActiveDocument();

  // Scope: 'current' | 'overview'
  const [scope, setScope] = useState<'current' | 'overview'>('current');
  // Resolved comments toggle: default false (hide resolved)
  const [showResolved, setShowResolved] = useState(false);
  const [showResolvedTooltip, setShowResolvedTooltip] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [overviewResolvedCount, setOverviewResolvedCount] = useState(0);

  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const setTrackChangesViewMode = useSettingsStore((s) => s.setTrackChangesViewMode);

  // Fetch project members for @mention autocomplete & author matching
  const { data: projectMembersData } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      try {
        const res = await ProjectService.getMembers(projectId);
        return res?.members || (res as any)?.data?.members || [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(projectId),
  });

  const mentionMembers: MentionMember[] = React.useMemo(() => {
    const list: MentionMember[] = [];
    const seen = new Set<string>();

    if (Array.isArray(projectMembersData)) {
      for (const m of projectMembersData) {
        const anyM = m as any;
        const id = m.userId || anyM.id || m.user?.id;
        const name = m.user?.name || anyM.name || m.user?.email?.split('@')[0] || 'Collaborator';
        if (id && !seen.has(id)) {
          seen.add(id);
          list.push({
            id,
            name,
            email: m.user?.email || anyM.email,
            avatar: m.user?.avatar || anyM.avatar,
            role: m.role,
          });
        }
      }
    }

    if (user?.id && !seen.has(user.id)) {
      seen.add(user.id);
      list.push({
        id: user.id,
        name: user.name || user.email?.split('@')[0] || 'You',
        email: user.email,
        avatar: user.avatar,
        role: 'you',
      });
    }

    return list;
  }, [projectMembersData, user]);

  const membersMap = useMemo(() => {
    const map = new Map<string, MentionMember>();
    for (const m of mentionMembers) {
      map.set(m.id, m);
    }
    return map;
  }, [mentionMembers]);

  // Real-time invalidation & mention notification from Socket.IO room events
  useEffect(() => {
    if (!pageId) return;
    const unsub = EditorEventBus.on('flux:review-event', ({ pageId: evtPageId, event, payload }) => {
      if (evtPageId !== pageId) return;

      if (event.startsWith('comment:') || event.startsWith('comments:')) {
        queryClient.invalidateQueries({ queryKey: ['page-comments', pageId] });
        queryClient.invalidateQueries({ queryKey: ['page-comments'] });
      }
      if (event.startsWith('suggestion:') || event.startsWith('suggestions:')) {
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
        queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', pageId] });
      }
      if (event === 'notification:digest') {
        queryClient.invalidateQueries({ queryKey: ['notification-bundler'] });
        const digest = payload?.digest;
        if (digest && user?.id === payload?.recipientId) {
          toast.info('Review digest received', {
            description: digest.summary,
          });
        }
      }
      if (event === 'comment:mention') {
        const mentionedIds = payload?.mentionedUserIds || [];
        if (user?.id && mentionedIds.includes(user.id)) {
          toast.info('You were mentioned in a review discussion!', {
            description: payload?.content ? payload.content.slice(0, 120) : 'A collaborator tagged you in a comment.',
          });
        }
      }
    });

    return () => unsub();
  }, [pageId, queryClient, user?.id]);

  // Deep-link from Monaco decorations / glyphs
  useEffect(() => {
    const unsub = EditorEventBus.on('flux:open-panel', (detail) => {
      if (typeof detail === 'object' && detail !== null) {
        setScope('current');
        if (detail.commentId) {
          setHighlightId(detail.commentId);
          setTimeout(() => {
            const el = document.getElementById(`comment-${detail.commentId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        } else if (detail.suggestionId) {
          setHighlightId(detail.suggestionId);
          setTimeout(() => {
            const el = document.getElementById(`suggestion-${detail.suggestionId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        }
      }
    });

    return () => unsub();
  }, []);

  const form = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: {
      content: '',
      line: null,
      lineEnd: null,
    },
  });

  const {
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { isSubmitting },
  } = form;

  const lineStartVal = useWatch({ control, name: 'line' });
  const newCommentContent = useWatch({ control, name: 'content' }) || '';

  const {
    data: comments = [],
    isLoading: isCommentsLoading,
    isError: isCommentsError,
    error: commentsError,
  } = usePageComments(pageId ?? null);
  const {
    data: suggestions = [],
    isLoading: isSuggestionsLoading,
    isError: isSuggestionsError,
    error: suggestionsError,
  } = usePageSuggestions(pageId ?? null);
  const createMutation = useCreateComment();
  const acceptMutation = useAcceptSuggestion();
  const rejectMutation = useRejectSuggestion();
  const acceptAllMutation = useAcceptAllSuggestions();
  const rejectAllMutation = useRejectAllSuggestions();
  const pendingComment = useActionsStore((s) => s.pendingComment);
  const clearPendingComment = useActionsStore((s) => s.clearPendingComment);

  // Project files query for Overview tab
  const { data: projectFiles = [] } = useQuery(filesQuery(rootPageId || pageId || ''));
  const allProjectFiles = useMemo<Array<{ id: string; title: string }>>(() => {
    const list: Array<{ id: string; title: string }> = (projectFiles || []).map((f) => ({
      id: f.id,
      title: f.title,
    }));
    const targetRoot = rootPageId || pageId;
    if (targetRoot && !list.some((f) => f.id === targetRoot)) {
      list.unshift({ id: targetRoot, title: currentPage?.title || 'main.tex' });
    }
    return list;
  }, [projectFiles, rootPageId, pageId, currentPage]);

  const handleNavigateToLine = useCallback((line: number) => {
    editorCommandBus.dispatch({ type: 'editor:jump-to-line', line });
    editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
  }, []);

  const handleNavigateToFileAndLine = useCallback((targetFileId: string, line?: number) => {
    selectFile(targetFileId);
    if (line != null) {
      setTimeout(() => {
        editorCommandBus.dispatch({ type: 'editor:jump-to-line', line });
        editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
      }, 150);
    }
  }, [selectFile]);

  useEffect(() => {
    if (!pendingComment) return;
    setValue('line', pendingComment.startLine);
    setValue('lineEnd', pendingComment.endLine);
    setValue('content', '');
    setShowAddForm(true);
    clearPendingComment();
  }, [pendingComment, setValue, clearPendingComment]);

  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);
  const resolvedComments = useMemo(() => comments.filter((c) => c.status === 'resolved'), [comments]);
  const pendingSuggestions = useMemo(() => suggestions.filter((s) => s.status === 'pending'), [suggestions]);
  const resolvedSuggestions = useMemo(
    () => suggestions.filter((s) => s.status === 'accepted' || s.status === 'rejected'),
    [suggestions],
  );

  const currentFileResolvedCount = resolvedComments.length + resolvedSuggestions.length;
  const activeResolvedCount = scope === 'current' ? currentFileResolvedCount : overviewResolvedCount;

  const handleToggleResolved = useCallback(() => {
    if (activeResolvedCount === 0) {
      setShowResolvedTooltip(true);
      setTimeout(() => setShowResolvedTooltip(false), 2200);
      return;
    }
    setShowResolved((prev) => !prev);
  }, [activeResolvedCount]);

  const visibleComments = showResolved ? comments : openComments;
  const visibleSuggestions = showResolved ? suggestions : pendingSuggestions;
  const totalVisibleItems = visibleComments.length + visibleSuggestions.length;
  const totalAllItems = comments.length + suggestions.length;

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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground border-l border-border select-none">
      {/* ── Top Header ── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3.5 bg-background">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Review</h2>

        <div className="flex items-center gap-0.5">
          {/* Quick Add Comment button */}
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className={cn(
              'flex size-7 items-center justify-center rounded transition-colors cursor-pointer',
              showAddForm
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            title="Add comment"
            aria-label="Add comment"
          >
            <MessageSquarePlus className="size-4 shrink-0" />
          </button>

          {/* Resolved comments toggle button */}
          <div className="relative">
            <button
              type="button"
              onClick={handleToggleResolved}
              onMouseEnter={() => setShowResolvedTooltip(true)}
              onMouseLeave={() => setShowResolvedTooltip(false)}
              className={cn(
                'flex size-7 items-center justify-center rounded transition-colors cursor-pointer',
                showResolved
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
              title="Resolved comments"
              aria-label="Resolved comments"
            >
              <MessageSquareCheck className="size-4 shrink-0" />
            </button>

            {/* Resolved tooltip popover */}
            {showResolvedTooltip && (
              <div className="absolute right-0 top-full mt-1.5 z-50 rounded bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-lg border border-border whitespace-nowrap pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100">
                {activeResolvedCount === 0
                  ? 'No resolved comments'
                  : showResolved
                    ? 'Hide resolved comments'
                    : `Show resolved comments (${activeResolvedCount})`}
              </div>
            )}
          </div>

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-4 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* ── Content View Area ── */}
      {isCommentsError || isSuggestionsError ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
          <PlaneErrorState
            title="Unable to load reviews"
            description="An issue occurred while loading comments and suggestions."
            error={commentsError || suggestionsError || new Error('Review data load failed')}
          />
        </div>
      ) : scope === 'current' ? (
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          {/* 10-Minute Notification Digest Banner */}
          {totalAllItems > 0 && (
            <div className="px-3 pt-2 shrink-0">
              <NotificationDigestBadge projectId={projectId} pageId={pageId} />
            </div>
          )}

          {/* Track Changes Display Mode & Bulk Actions */}
          {suggestions.length > 0 && (
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-1.5 text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Mode
                </span>
                <div className="inline-flex rounded-md bg-muted p-0.5 text-xs font-medium border border-border">
                  {(['changes', 'clean', 'original'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTrackChangesViewMode(m)}
                      className={cn(
                        'px-2 py-0.5 rounded-sm capitalize transition-colors cursor-pointer text-[11px]',
                        trackChangesViewMode === m
                          ? 'bg-background text-foreground font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      title={
                        m === 'changes'
                          ? 'Diffs (All changes)'
                          : m === 'clean'
                            ? 'Clean (All accepted)'
                            : 'Original (No suggestions)'
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {pendingSuggestions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => pageId && rejectAllMutation.mutate({ pageId })}
                    disabled={rejectAllMutation.isPending}
                    className="px-2 py-0.5 rounded text-12 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer leading-normal"
                  >
                    Reject All
                  </button>
                  <button
                    type="button"
                    onClick={() => pageId && acceptAllMutation.mutate({ pageId })}
                    disabled={acceptAllMutation.isPending}
                    className="px-2 py-0.5 rounded text-12 bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors cursor-pointer leading-normal"
                  >
                    Accept All
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Add comment form */}
          {showAddForm && (
            <div className="border-b border-border bg-card p-3.5">
              <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">New Comment</span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
                      aria-label="Close comment form"
                    >
                      <X className="size-3.5 shrink-0" />
                    </button>
                  </div>
                  <MentionTextarea
                    value={newCommentContent}
                    onChange={(val) => setValue('content', val, { shouldValidate: true })}
                    members={mentionMembers}
                    placeholder="Leave a comment... Type @ to mention a collaborator"
                    rows={3}
                    className="bg-background text-foreground border border-input focus:border-primary text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-10 text-muted-foreground">
                      {lineStartVal ? `Line ${lineStartVal}` : 'Whole document'}
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="size-3" />
                      Post
                    </button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Main Feed */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3">
            {isCommentsLoading || isSuggestionsLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin shrink-0" />
                <span className="text-xs">Loading review items…</span>
              </div>
            ) : totalAllItems === 0 ? (
              <EmptyReviewState />
            ) : totalVisibleItems === 0 ? (
              <EmptyReviewState
                title="No open comments or suggestions"
                subtitle="All comments and suggestions have been resolved."
                action={
                  <button
                    type="button"
                    onClick={() => setShowResolved(true)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    Show resolved comments ({currentFileResolvedCount})
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col">
                {/* Suggestions */}
                {visibleSuggestions.map((s) => (
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
                    isHighlighted={highlightId === s.id}
                    membersMap={membersMap}
                  />
                ))}

                {/* Comments */}
                <div className="flex flex-col">
                  {visibleComments.map((comment) => (
                    <CommentCard
                      key={comment.id}
                      comment={comment}
                      pageId={pageId!}
                      currentUserId={user?.id}
                      onNavigate={comment.line != null ? handleNavigateToLine : undefined}
                      isHighlighted={highlightId === comment.id}
                      members={mentionMembers}
                      membersMap={membersMap}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Scope: Overview View ── */
        <OverviewView
          files={allProjectFiles}
          currentUserId={user?.id}
          showResolved={showResolved}
          onNavigateToFile={handleNavigateToFileAndLine}
          members={mentionMembers}
          membersMap={membersMap}
          onOverviewResolvedCount={setOverviewResolvedCount}
        />
      )}

      {/* ── Bottom Navigation Tabs: Current file vs Overview ── */}
      <nav aria-label="Review scope" className="flex h-11 shrink-0 border-t border-border bg-background select-none">
        {/* Tab 1: Current file */}
        <button
          type="button"
          onClick={() => setScope('current')}
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors cursor-pointer font-medium',
            scope === 'current' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {scope === 'current' && (
            <div className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
          )}
          <FileText className="size-3.5 shrink-0" />
          <span className="text-12 leading-normal">Current file</span>
        </button>

        {/* Tab 2: Overview */}
        <button
          type="button"
          onClick={() => setScope('overview')}
          className={cn(
            'relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors cursor-pointer font-medium',
            scope === 'overview' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {scope === 'overview' && (
            <div className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
          )}
          <List className="size-3.5 shrink-0" />
          <span className="text-12 leading-normal">Overview</span>
        </button>
      </nav>
    </div>
  );
});

export default ReviewTab;
