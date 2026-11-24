'use client';

/**
 * Comments.tsx
 *
 * Cohesive comment interactions for the Review sidebar:
 * - CommentCard: displays thread, author, line link, status resolve/reopen, options menu
 * - ReplyRow: individual reply entry with delete capability
 * - ReplyForm: quick inline reply submission
 * - NewCommentForm: full comment form with quote preview and @mention textarea
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  Loader2,
  MoreVertical,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import {
  useResolveComment,
  useDeleteComment,
  useDeleteReply,
  useAddReply,
  useCreateComment,
  useUpdateComment,
} from '../hooks/useComments';
import type { PageComment, CommentReply, CreateReplyInput, CreateCommentInput } from '@/features/editor/domain/types/comment.types';
import { createReplySchema, createCommentSchema } from '@/features/editor/domain/types/comment.types';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';
import { MentionRenderer } from './Badges';
import { MentionTextarea } from './MentionInput';
import { formatReviewDate, resolveAuthorDisplay } from '@/features/editor/domain/collaboration/author-display';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';

// ── Reply Row ───────────────────────────────────────────────────────────────

interface ReplyRowProps {
  reply: CommentReply;
  currentUserId?: string;
  onDelete: (replyId: string) => void;
  isPending?: boolean;
  membersMap?: Map<string, MentionMember>;
}

const ReplyRow = React.memo(function ReplyRow({
  reply,
  currentUserId,
  onDelete,
  isPending = false,
  membersMap,
}: ReplyRowProps) {
  const isAuthor = Boolean(
    currentUserId && (currentUserId === reply.author?.id || reply.userId === currentUserId),
  );

  const authorDisplay = useMemo(
    () => resolveAuthorDisplay(reply.author, membersMap, reply.userId),
    [reply, membersMap],
  );

  return (
    <div className="group flex flex-col py-1 text-xs">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: authorDisplay.color }}
          />
          <span className="font-semibold text-foreground truncate text-12 leading-normal">
            {authorDisplay.name}
          </span>
          <span className="text-11 font-mono text-muted-foreground">
            {formatReviewDate(reply.createdAt)}
          </span>
        </div>
        {isAuthor && (
          <button
            type="button"
            onClick={() => onDelete(reply.id)}
            disabled={isPending}
            className="opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
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

// ── Reply Form ──────────────────────────────────────────────────────────────

interface ReplyFormProps {
  commentId: string;
  pageId: string;
  projectId?: string;
}

export const ReplyForm = React.memo(function ReplyForm({
  commentId,
  pageId,
  projectId,
}: ReplyFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<CreateReplyInput>({
    resolver: zodResolver(createReplySchema),
    defaultValues: {
      content: '',
      projectId,
    },
    mode: 'onSubmit',
  });

  const addReplyMutation = useAddReply();

  const onSubmit = (data: CreateReplyInput) => {
    const trimmed = data.content?.trim();
    if (!trimmed) return;
    addReplyMutation.mutate(
      { pageId, commentId, content: trimmed, projectId },
      {
        onSuccess: () => {
          reset({ content: '', projectId });
        },
      },
    );
  };

  const isPending = isSubmitting || addReplyMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="relative mt-2.5">
      <Controller
        name="content"
        control={control}
        render={({ field }) => (
          <input
            {...field}
            type="text"
            aria-label="Reply to comment"
            placeholder="Reply..."
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(onSubmit)();
              }
            }}
            className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-border transition-colors disabled:opacity-50"
          />
        )}
      />
      {errors.content?.message && (
        <span className="block mt-1 text-11 text-destructive">
          {errors.content.message}
        </span>
      )}
    </form>
  );
});

const REVIEW_CARD_CONTAINMENT_STYLE: React.CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 140px',
};

// ── Comment Card ────────────────────────────────────────────────────────────

export interface CommentCardProps {
  comment: PageComment;
  pageId: string;
  projectId?: string;
  currentUserId?: string;
  onNavigate?: (line: number) => void;
  isHighlighted?: boolean;
  members?: MentionMember[];
  membersMap?: Map<string, MentionMember>;
}

export const CommentCard = React.memo(function CommentCard({
  comment,
  pageId,
  projectId,
  currentUserId,
  onNavigate,
  isHighlighted = false,
  members = [],
  membersMap,
}: CommentCardProps) {
  const resolveMutation = useResolveComment();
  const deleteMutation = useDeleteComment();
  const deleteReplyMutation = useDeleteReply();
  const updateMutation = useUpdateComment();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const authorId = comment.author?.id || comment.authorId || comment.createdById || comment.userId;
  const isAuthor = Boolean(currentUserId && authorId === currentUserId);

  const authorDisplay = useMemo(
    () => resolveAuthorDisplay(comment.author, membersMap, authorId),
    [comment.author, membersMap, authorId],
  );

  const isResolved = comment.status === 'resolved';
  const replies = comment.replies ?? [];
  const hasReplies = replies.length > 0;
  const [showAllReplies, setShowAllReplies] = useState(false);
  const COLLAPSE_THRESHOLD = 3;
  const hiddenRepliesCount =
    !showAllReplies && replies.length > COLLAPSE_THRESHOLD
      ? replies.length - 2
      : 0;
  const displayedReplies =
    hiddenRepliesCount > 0 ? replies.slice(replies.length - 2) : replies;

  const handleToggleStatus = () => {
    resolveMutation.mutate({
      pageId,
      commentId: comment.id,
      resolved: !isResolved,
      projectId,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ pageId, commentId: comment.id, projectId });
  };

  const handleDeleteReply = (replyId: string) => {
    deleteReplyMutation.mutate({ pageId, commentId: comment.id, replyId, projectId });
  };

  return (
    <div
      id={`comment-${comment.id}`}
      style={REVIEW_CARD_CONTAINMENT_STYLE}
      onClick={(e) => {
        if (comment.line == null || !onNavigate) return;
        if ((e.target as HTMLElement).closest('button, input, textarea, a, [role="menuitem"]')) {
          return;
        }
        onNavigate(comment.line);
      }}
      className={cn(
        'rounded-md border p-3 bg-card text-card-foreground mb-2.5 transition-colors duration-150',
        comment.line != null && onNavigate && 'cursor-pointer',
        isHighlighted
          ? 'border-primary ring-1 ring-primary/40'
          : 'border-border hover:border-border/80',
        isResolved && 'opacity-70',
      )}
    >
      {/* Row 1: Header (color dot + author name + resolved badge + resolve button + more menu) */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: authorDisplay.color }}
          />
          <span className="text-13 font-medium text-foreground truncate">
            {authorDisplay.name}
          </span>
          {isResolved && (
            <span className="text-10 font-medium px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border/50">
              Resolved
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={resolveMutation.isPending}
            title={isResolved ? 'Reopen comment' : 'Resolve comment'}
            aria-label={isResolved ? 'Reopen comment' : 'Resolve comment'}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
          >
            {resolveMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            )}
            {!resolveMutation.isPending && isResolved && (
              <RotateCcw className="size-3.5" />
            )}
            {!resolveMutation.isPending && !isResolved && (
              <Check className="size-3.5" />
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Comment options"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
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
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditContent(comment.content);
                      setIsEditing(true);
                    }}
                    className="text-xs hover:bg-muted cursor-pointer"
                  >
                    Edit comment
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  >
                    Delete comment
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Timestamp */}
      <div className="text-12 font-mono text-muted-foreground mt-0.5 leading-normal">
        {formatReviewDate(comment.createdAt)}
      </div>

      {/* Row 3: Comment Body (or Edit Form) */}
      {isEditing ? (
        <div className="mt-2 space-y-1.5">
          <MentionTextarea
            value={editContent}
            onChange={setEditContent}
            members={members}
            rows={2}
            className="w-full text-xs p-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-border resize-y"
            autoFocus
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="h-6 min-h-[26px] px-2.5 text-11 rounded-sm border border-border text-muted-foreground hover:text-foreground cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={updateMutation.isPending || !editContent.trim()}
              onClick={() => {
                const trimmed = editContent.trim();
                if (!trimmed) return;
                updateMutation.mutate(
                  { pageId, commentId: comment.id, content: trimmed },
                  {
                    onSuccess: () => setIsEditing(false),
                  },
                );
              }}
              className="h-6 min-h-[26px] px-3 text-11 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 cursor-pointer disabled:opacity-50 relative after:absolute after:-inset-1 after:content-['']"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-13 text-foreground mt-1.5 font-normal leading-relaxed whitespace-pre-wrap break-words">
          <MentionRenderer content={comment.content} />
        </div>
      )}

      {/* Row 4: Replies */}
      {hasReplies && (
        <div className="mt-2.5 pt-2 border-t border-border space-y-2">
          {hiddenRepliesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllReplies(true)}
              className="text-11 font-medium text-primary hover:underline cursor-pointer"
            >
              Show {hiddenRepliesCount} earlier {hiddenRepliesCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
          {showAllReplies && replies.length > COLLAPSE_THRESHOLD && (
            <button
              type="button"
              onClick={() => setShowAllReplies(false)}
              className="text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Hide earlier replies
            </button>
          )}
          {displayedReplies.map((reply: CommentReply) => (
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

      {/* Row 5: Isolated Reply Form (only for open threads) */}
      {!isResolved && (
        <ReplyForm commentId={comment.id} pageId={pageId} projectId={projectId} />
      )}
    </div>
  );
});

// ── New Comment Form ────────────────────────────────────────────────────────

export interface NewCommentFormProps {
  pageId: string;
  projectId?: string;
  pendingQuote?: string | null;
  initialLine?: number | null;
  initialLineEnd?: number | null;
  members: MentionMember[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function NewCommentForm({
  pageId,
  projectId,
  pendingQuote,
  initialLine,
  initialLineEnd,
  members,
  onClose,
  onSuccess,
}: NewCommentFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: {
      content: '',
      line: initialLine ?? null,
      lineEnd: initialLineEnd ?? null,
      projectId,
      pageId,
    },
    mode: 'onSubmit',
  });

  const content = watch('content') || '';
  const createMutation = useCreateComment();

  const handlePost = (data: CreateCommentInput) => {
    const trimmed = data.content?.trim();
    if (!trimmed || !pageId) return;

    createMutation.mutate(
      {
        pageId,
        content: trimmed,
        line: data.line ?? undefined,
        lineEnd: data.lineEnd ?? undefined,
        projectId: projectId || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onSuccess?.();
          onClose();
        },
      },
    );
  };

  const isPending = isSubmitting || createMutation.isPending;

  useEffect(() => {
    useDocumentCollaborationStore.getState().setActiveDraftComment(
      initialLine != null
        ? { startLine: initialLine, endLine: initialLineEnd ?? initialLine }
        : null,
    );
    return () => {
      useDocumentCollaborationStore.getState().setActiveDraftComment(null);
    };
  }, [initialLine, initialLineEnd]);

  return (
    <div className="mx-3 mt-3 rounded-lg border border-border bg-card p-3 shadow-xs">
      <form onSubmit={handleSubmit(handlePost)} className="flex flex-col gap-2.5">
        {/* Textarea with Mention autocomplete & Keyboard shortcuts */}
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <MentionTextarea
              value={field.value || ''}
              onChange={field.onChange}
              members={members}
              placeholder="Comment or @ mention someone"
              rows={3}
              autoFocus
              disabled={isPending}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(handlePost)();
                }
              }}
              className="bg-background text-foreground border border-input focus:border-input focus:ring-0 focus-visible:ring-0 focus-visible:outline-none shadow-none text-xs rounded-md"
            />
          )}
        />

        {/* Validation error message */}
        {errors.content?.message && (
          <span className="text-11 text-destructive">
            {errors.content.message}
          </span>
        )}

        {/* Form Footer */}
        <div className="flex items-center justify-end gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-7 px-2.5 rounded-md text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="flex items-center gap-1.5 h-7 rounded-md bg-primary px-3 text-11 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-45 cursor-pointer transition-colors"
          >
            {isPending && (
              <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
            )}
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
