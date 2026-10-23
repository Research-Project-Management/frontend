'use client';

import React, { memo } from 'react';
import { Reply, Smile, FileText, Download } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ChatMessage, ChatAttachment } from '../types/chat.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';

interface MessageItemProps {
  message: ChatMessage;
  isSelf: boolean;
  onReply: (message: ChatMessage) => void;
  onReaction: (messageId: string, emoji: string) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '💡', '🚀', '👀'];

export const MessageItem = memo(function MessageItem({
  message,
  isSelf,
  onReply,
  onReaction,
}: MessageItemProps) {
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Group reactions by emoji
  const reactionGroups = (message.reactions || []).reduce<Record<string, { count: number; userIds: string[] }>>(
    (acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { count: 0, userIds: [] };
      }
      acc[r.emoji].count += 1;
      acc[r.emoji].userIds.push(r.userId);
      return acc;
    },
    {},
  );

  const attachments = Array.isArray(message.attachments)
    ? (message.attachments as ChatAttachment[])
    : [];

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        'group relative flex gap-3 px-4 py-1.5 transition-colors hover:bg-muted/40 rounded-lg',
        isSelf && 'flex-row-reverse',
      )}
    >
      {/* Sender Avatar */}
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarImage src={message.sender?.avatar || undefined} />
        <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
          {(message.sender?.name || 'U').slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Message Body */}
      <div className={cn('flex flex-col max-w-[75%] space-y-1', isSelf && 'items-end')}>
        {/* Sender Name & Timestamp */}
        <div className="flex items-center gap-2 text-12">
          <span className="font-medium text-foreground">
            {isSelf ? 'You' : message.sender?.name || 'User'}
          </span>
          <span className="text-muted-foreground text-11 font-mono tabular-nums">{formattedTime}</span>
        </div>

        {/* Reply Quote Banner (Click to jump to quoted message) */}
        {message.replyTo && (
          <button
            type="button"
            onClick={() => {
              const target = document.getElementById(`message-${message.replyTo?.id}`);
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.classList.add('bg-primary/10', 'ring-1', 'ring-primary/20');
                setTimeout(() => {
                  target.classList.remove('bg-primary/10', 'ring-1', 'ring-primary/20');
                }, 1500);
              }
            }}
            className="text-11 px-2.5 py-1 rounded bg-muted/80 hover:bg-muted border-l-2 border-primary text-muted-foreground truncate max-w-full text-left cursor-pointer transition-colors inline-flex items-center gap-1.5"
            title="Jump to replied message"
          >
            <span className="font-medium text-foreground shrink-0">
              {message.replyTo.sender?.name || (message.replyTo.sender as any)?.profile?.name || 'User'}:
            </span>
            <span className="truncate">{message.replyTo.content}</span>
          </button>
        )}

        {/* Message Content Bubble (Tactile Flat Precision per DESIGN.md Section 1 & 4.3) */}
        <div
          className={cn(
            'px-3 py-2 rounded-md text-13 leading-relaxed whitespace-pre-wrap break-words',
            isSelf
              ? 'bg-background border border-border text-foreground shadow-2xs'
              : 'bg-muted border border-border/50 text-foreground',
          )}
        >
          {message.content}
        </div>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachments.map((att, idx) => {
              const isImg = att.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.url);
              if (isImg) {
                return (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-md border border-border max-w-xs hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={att.url}
                      alt={att.name || 'Attachment'}
                      className="max-h-48 object-cover rounded-md"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={idx}
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  download={att.name}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted text-12 transition-colors shadow-2xs"
                >
                  <FileText className="size-4 text-foreground shrink-0" />
                  <span className="truncate max-w-36 font-medium text-foreground">{att.name}</span>
                  <Download className="size-3 text-muted-foreground" />
                </a>
              );
            })}
          </div>
        )}

        {/* Emoji Reaction Badges */}
        {Object.entries(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {Object.entries(reactionGroups).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReaction(message.id, emoji)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-11 bg-muted hover:bg-muted/80 border border-border transition-colors cursor-pointer"
              >
                <span>{emoji}</span>
                <span className="font-mono font-medium text-muted-foreground text-11 tabular-nums">{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Hover Actions */}
      <div
        className={cn(
          'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background border border-border shadow-2xs rounded-md p-0.5 z-10',
          isSelf ? 'left-4' : 'right-4',
        )}
      >
        <button
          onClick={() => onReply(message)}
          className="size-6 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Reply"
        >
          <Reply className="size-3.5" />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button
              className="size-6 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Add reaction"
            >
              <Smile className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1.5 flex gap-1 bg-background border border-border shadow-raised-200 rounded-md">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReaction(message.id, emoji)}
                className="size-7 flex items-center justify-center text-sm rounded-sm hover:bg-muted transition-colors cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
