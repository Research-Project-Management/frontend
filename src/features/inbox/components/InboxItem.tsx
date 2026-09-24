'use client';

/**
 * features/inbox/components/InboxItem.tsx
 * Card item for rendering notifications (Pages/Editor reviews, mentions, and Project invitations).
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AtSign,
  MessageSquare,
  CheckCircle2,
  UserPlus,
  FileText,
  Clock,
  X,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { inboxService } from '../services/inbox.service';
import type { NotificationItem } from '../types/inbox.types';

export interface InboxItemProps {
  item: NotificationItem;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClosePopover?: () => void;
  className?: string;
}

/**
 * Formats ISO date to human readable relative time.
 */
function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 30) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'recently';
  }
}

export default function InboxItem({
  item,
  onMarkAsRead,
  onDelete,
  onClosePopover,
  className,
}: InboxItemProps) {
  const router = useRouter();
  const [isActing, setIsActing] = useState<boolean>(false);
  const { type, messageOpts, isRead, createdAt, projectId, docId } = item;

  const actorName = messageOpts?.actorName || messageOpts?.inviterName || 'A collaborator';
  const projectName = messageOpts?.projectName || 'Manuscript';
  const docName = messageOpts?.docName || 'Document';
  const snippet = messageOpts?.snippet || messageOpts?.quote || '';

  // Get icon and color scheme based on notification type
  const getBadgeConfig = () => {
    switch (type) {
      case 'mention':
        return {
          icon: AtSign,
          bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          label: 'Mention',
        };
      case 'comment_reply':
        return {
          icon: MessageSquare,
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          label: 'Reply',
        };
      case 'thread_resolved':
        return {
          icon: CheckCircle2,
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          label: 'Resolved',
        };
      case 'project_invite':
        return {
          icon: UserPlus,
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          label: 'Invite',
        };
      default:
        return {
          icon: FileText,
          bg: 'bg-muted text-muted-foreground border-border',
          label: 'Notice',
        };
    }
  };

  const badge = getBadgeConfig();
  const BadgeIcon = badge.icon;

  // Handle Accept Project Invite
  const handleAcceptInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActing(true);
    const token = messageOpts?.token || item.id;
    const res = await inboxService.acceptInvitation(token);
    setIsActing(false);

    if (res.success) {
      toast.success(`You joined project ${projectName}`);
      await onMarkAsRead(item.id);
      if (res.projectId) {
        onClosePopover?.();
        router.push(`/projects/${res.projectId}`);
      }
    } else {
      toast.error('Failed to accept invitation. It may have expired.');
    }
  };

  // Handle Decline Project Invite
  const handleDeclineInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActing(true);
    await inboxService.declineInvitation(item.id);
    await onDelete(item.id);
    setIsActing(false);
    toast.info('Invitation declined');
  };

  // Resolve target navigation link for Editor (Pages)
  const getTargetUrl = () => {
    if (projectId && docId) {
      return `/projects/${projectId}/pages/${docId}`;
    }
    if (projectId) {
      return `/projects/${projectId}`;
    }
    return null;
  };

  const targetUrl = getTargetUrl();

  const handleCardClick = () => {
    if (!isRead) {
      onMarkAsRead(item.id);
    }
    if (targetUrl) {
      onClosePopover?.();
      router.push(targetUrl);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'group relative flex items-start gap-3 p-3 transition-colors rounded-lg border text-left cursor-pointer select-none',
        !isRead
          ? 'bg-muted/40 border-border hover:bg-muted/70'
          : 'bg-background border-transparent hover:bg-muted/30 hover:border-border/60',
        className
      )}
    >
      {/* Icon Badge */}
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md border mt-0.5',
          badge.bg
        )}
      >
        <BadgeIcon className="size-4 shrink-0" />
      </div>

      {/* Main Body */}
      <div className="flex-1 min-w-0 pr-6">
        {/* Header line: Title & Project Name */}
        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium leading-tight">
          <span className="font-semibold truncate">{actorName}</span>
          {type === 'mention' && (
            <span className="text-muted-foreground truncate">
              mentioned you in <span className="text-foreground font-medium">{docName || projectName}</span>
            </span>
          )}
          {type === 'comment_reply' && (
            <span className="text-muted-foreground truncate">
              replied in <span className="text-foreground font-medium">{projectName}</span>
            </span>
          )}
          {type === 'thread_resolved' && (
            <span className="text-muted-foreground truncate">
              resolved a thread in <span className="text-foreground font-medium">{projectName}</span>
            </span>
          )}
          {type === 'project_invite' && (
            <span className="text-muted-foreground truncate">
              invited you to collaborate on <span className="text-foreground font-medium">{projectName}</span>
            </span>
          )}
        </div>

        {/* Snippet / Quote text preview */}
        {snippet && (
          <div className="mt-1.5 text-xs text-muted-foreground line-clamp-2 bg-background/80 rounded px-2 py-1 border border-border/50 font-normal">
            &ldquo;{snippet}&rdquo;
          </div>
        )}

        {/* Action Row for Invitations */}
        {type === 'project_invite' && (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={isActing}
              onClick={handleAcceptInvite}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isActing ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              <span>Accept</span>
            </button>
            <button
              type="button"
              disabled={isActing}
              onClick={handleDeclineInvite}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="size-3" />
              <span>Decline</span>
            </button>
          </div>
        )}

        {/* Footer Meta */}
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatRelativeTime(createdAt)}
          </span>

          {targetUrl && type !== 'project_invite' && (
            <span className="inline-flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Open in Pages
              <ExternalLink className="size-2.5" />
            </span>
          )}
        </div>
      </div>

      {/* Right Action Icons (Mark read & Dismiss) */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
        {/* Unread Dot Indicator */}
        {!isRead && (
          <span
            className="size-2 rounded-full bg-primary ring-2 ring-background shrink-0"
            title="Unread notification"
          />
        )}

        {/* Hover Delete Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          title="Dismiss notification"
          className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}
