'use client';

import React, { useMemo } from 'react';
import { Check, Loader2, MoreVertical, RotateCcw } from 'lucide-react';
import { useResolveComment, useDeleteComment, useDeleteReply } from '@/features/editor/ui/hooks/use-comment';
import type { PageComment, CommentReply } from '@/features/editor/domain/types';
import type { MentionMember } from '@/features/editor/domain/utils/mention.util';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { MentionRenderer } from './MentionBadge';
import { ReplyRow } from './ReplyRow';
import { ReplyForm } from './ReplyForm';
import { formatOverleafDate, resolveAuthorDisplay } from '../utils/review.util';

interface CommentCardProps {
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
  membersMap,
}: CommentCardProps) {
  const resolveMutation = useResolveComment();
  const deleteMutation = useDeleteComment();
  const deleteReplyMutation = useDeleteReply();

  const isAuthor = Boolean(
    currentUserId && (
      currentUserId === comment.author?.id ||
      (comment as any).createdById === currentUserId ||
      (comment as any).authorId === currentUserId ||
      (comment as any).userId === currentUserId
    ),
  );

  const authorDisplay = useMemo(
    () => resolveAuthorDisplay(comment.author, membersMap, (comment as any).authorId || (comment as any).userId),
    [comment, membersMap],
  );

  const isResolved = comment.status === 'resolved';
  const hasReplies = Boolean(comment.replies && comment.replies.length > 0);

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
      className={cn(
        'rounded-lg border p-3 bg-card text-card-foreground mb-2.5 transition-colors duration-150',
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
            className="size-2.5 rounded-[2px] shrink-0"
            style={{ backgroundColor: authorDisplay.color }}
          />
          <span className="text-13 font-medium text-foreground truncate">
            {authorDisplay.name}
          </span>
          {isResolved && (
            <span className="text-10 font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
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
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
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

      {/* Row 2: Timestamp */}
      <div className="text-12 font-mono text-muted-foreground mt-0.5 leading-normal">
        {formatOverleafDate(comment.createdAt)}
      </div>

      {/* Row 3: Comment Body */}
      <div className="text-13 text-foreground mt-1.5 font-normal leading-relaxed whitespace-pre-wrap break-words">
        <MentionRenderer content={comment.content} />
      </div>

      {/* Row 4: Replies */}
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

      {/* Row 5: Isolated Reply Form */}
      <ReplyForm commentId={comment.id} pageId={pageId} projectId={projectId} />
    </div>
  );
});

export default CommentCard;
