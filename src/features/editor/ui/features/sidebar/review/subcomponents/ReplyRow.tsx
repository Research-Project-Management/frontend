'use client';

import React, { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import type { CommentReply } from '@/features/editor/domain/types';
import type { MentionMember } from '@/features/editor/domain/collaboration/mention';
import { MentionRenderer } from './MentionBadge';
import { formatOverleafDate, resolveAuthorDisplay } from '../utils/review.util';

interface ReplyRowProps {
  reply: CommentReply;
  currentUserId?: string;
  onDelete: (replyId: string) => void;
  isPending?: boolean;
  membersMap?: Map<string, MentionMember>;
}

export const ReplyRow = React.memo(function ReplyRow({
  reply,
  currentUserId,
  onDelete,
  isPending = false,
  membersMap,
}: ReplyRowProps) {
  const isAuthor = Boolean(
    currentUserId && (currentUserId === reply.author?.id || (reply as any).userId === currentUserId),
  );

  const authorDisplay = useMemo(
    () => resolveAuthorDisplay(reply.author, membersMap, (reply as any).userId),
    [reply, membersMap],
  );

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
          <span className="text-11 font-mono text-muted-foreground">
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

export default ReplyRow;
