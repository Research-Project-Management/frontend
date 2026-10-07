'use client';

/**
 * features/shell/components/inbox/InboxItem.tsx
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
import { inboxService } from '../../services/inbox.service';
import type { NotificationItem } from '../../types/inbox.types';

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
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [isDeclining, setIsDeclining] = useState<boolean>(false);
  const [hasResponded, setHasResponded] = useState<'accepted' | 'declined' | null>(null);

  const opts = item.messageOpts || {};
  const isProjectInvite = item.type === 'project_invite' || item.templateKey === 'project_invite';

  // Determine icon & theme color based on type
  const getIconConfig = () => {
    switch (item.type) {
      case 'mention':
        return {
          icon: AtSign,
          color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
          label: 'Mentioned you',
        };
      case 'comment_reply':
        return {
          icon: MessageSquare,
          color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
          label: 'Replied to comment',
        };
      case 'thread_resolved':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
          label: 'Resolved comment thread',
        };
      case 'project_invite':
        return {
          icon: UserPlus,
          color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
          label: 'Project Invitation',
        };
      case 'review_request':
        return {
          icon: FileText,
          color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
          label: 'Manuscript Review Request',
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-muted-foreground bg-muted border-border',
          label: 'Notification',
        };
    }
  };

  const { icon: TypeIcon, color: iconStyle, label: typeLabel } = getIconConfig();

  // Accept Project Invitation handler
  const handleAcceptInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const token = opts.token || item.id;
    setIsAccepting(true);
    try {
      const res = await inboxService.acceptInvitation(token);
      if (res.success) {
        setHasResponded('accepted');
        await onMarkAsRead(item.id);
        toast.success(`Joined project ${opts.projectName || ''}!`);
        if (res.projectId) {
          onClosePopover?.();
          router.push(`/projects/${res.projectId}/overview`);
        }
      } else {
        toast.error('Failed to accept invitation. It may have expired.');
      }
    } catch {
      toast.error('Network error accepting invitation.');
    } finally {
      setIsAccepting(false);
    }
  };

  // Decline Project Invitation handler
  const handleDeclineInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeclining(true);
    try {
      const success = await inboxService.declineInvitation(item.id);
      if (success) {
        setHasResponded('declined');
        await onDelete(item.id);
        toast.info('Invitation declined.');
      }
    } catch {
      toast.error('Could not decline invitation.');
    } finally {
      setIsDeclining(false);
    }
  };

  // Determine deep-link target
  const getTargetUrl = () => {
    if (opts.actionUrl) return opts.actionUrl;
    if (item.projectId && item.docId) {
      return `/projects/${item.projectId}/pages/${item.docId}${opts.commentId ? `?commentId=${opts.commentId}` : ''}`;
    }
    if (item.projectId) {
      return `/projects/${item.projectId}/overview`;
    }
    return null;
  };

  const targetUrl = getTargetUrl();

  const handleCardClick = () => {
    if (!item.isRead) {
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
        'group relative flex items-start gap-3 p-3.5 transition-colors duration-150 border-b border-border/60 hover:bg-muted/50 cursor-pointer',
        !item.isRead && 'bg-primary/5 hover:bg-primary/10',
        className
      )}
    >
      {/* Category / Type Icon */}
      <div
        className={cn(
          'size-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5',
          iconStyle
        )}
      >
        <TypeIcon className="size-4" />
      </div>

      {/* Main Content Body */}
      <div className="flex-1 min-w-0 pr-6">
        {/* Header row: Actor & Action description */}
        <div className="flex items-center gap-1.5 flex-wrap text-13 leading-snug">
          <span className="font-semibold text-foreground tracking-tight">
            {opts.actorName || opts.inviterName || 'Someone'}
          </span>
          <span className="text-muted-foreground">{typeLabel.toLowerCase()}</span>
          {opts.projectName && (
            <>
              <span className="text-muted-foreground">in</span>
              <span className="font-medium text-foreground truncate max-w-[160px]">
                {opts.projectName}
              </span>
            </>
          )}
        </div>

        {/* Snippet / Quote if available */}
        {(opts.snippet || opts.quote) && (
          <div className="mt-1.5 px-2.5 py-1.5 rounded-md bg-background/80 border border-border/80 text-12 text-foreground/90 font-sans line-clamp-2 leading-relaxed">
            &ldquo;{opts.snippet || opts.quote}&rdquo;
          </div>
        )}

        {/* Project Invitation Action Controls */}
        {isProjectInvite && !hasResponded && (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              disabled={isAccepting || isDeclining}
              onClick={handleAcceptInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-12 font-medium transition-colors hover:bg-primary/90 cursor-pointer disabled:opacity-50"
            >
              {isAccepting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              <span>Accept Invite</span>
            </button>
            <button
              type="button"
              disabled={isAccepting || isDeclining}
              onClick={handleDeclineInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-12 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeclining ? <Loader2 className="size-3.5 animate-spin" /> : null}
              <span>Decline</span>
            </button>
          </div>
        )}

        {hasResponded && (
          <div className="mt-2 text-12 font-medium text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Invitation {hasResponded}.</span>
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-1.5 flex items-center gap-1.5 text-11 text-muted-foreground">
          <Clock className="size-3 shrink-0" />
          <span>{formatRelativeTime(item.createdAt)}</span>
        </div>
      </div>

      {/* Right Quick Actions (Mark Read & Dismiss) */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!item.isRead && (
          <button
            type="button"
            title="Mark as read"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(item.id);
            }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            <Check className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Delete notification"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Unread indicator dot */}
      {!item.isRead && (
        <span className="absolute top-4 right-3 size-2 rounded-full bg-primary ring-2 ring-background group-hover:hidden" />
      )}
    </div>
  );
}
