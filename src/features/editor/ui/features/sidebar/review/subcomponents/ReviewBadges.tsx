'use client';

/**
 * ReviewBadges.tsx
 *
 * Cohesive badge and icon presentations for the Review sidebar:
 * - Overleaf review, solid cutout, and resolved comment icons
 * - Mention badges and mention text tokens renderer
 * - Notification digest buffering badge with countdown & manual flush
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  Bell,
  Clock,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  GitPullRequest,
  AtSign,
  Bot,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { parseMentionTokens } from '@/features/editor/domain/collaboration/mention';
import {
  usePendingBundles,
  useFlushBundle,
  useDigestHistory,
} from '@/features/editor/ui/hooks/use-notification-bundler';
import {
  formatRemainingTime,
  BundledNotificationItem,
} from '@/features/editor/domain/collaboration/notification-digest';

// ── Overleaf Review Icons ───────────────────────────────────────────────────

export function OverleafReviewIcon({
  className = 'size-4',
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 6 3.5 H 18 A 2.5 2.5 0 0 1 20.5 6 V 14.5 A 2.5 2.5 0 0 1 18 17 H 8.5 L 4.5 20.5 A 0.5 0.5 0 0 1 3.5 20 V 6 A 2.5 2.5 0 0 1 6 3.5 Z M 7.8 13.2 L 7.6 11.8 L 13.6 5.8 A 1 1 0 0 1 15 5.8 L 15.2 6 A 1 1 0 0 1 15.2 7.4 L 9.2 13.4 Z M 11.5 12.6 H 15.5 A 0.6 0.6 0 0 1 15.5 13.8 H 11.5 A 0.6 0.6 0 0 1 11.5 12.6 Z"
      />
    </svg>
  );
}

export function OverleafReviewSolidIcon({
  className = 'size-9',
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 6 3.5 H 18 A 2.5 2.5 0 0 1 20.5 6 V 14.5 A 2.5 2.5 0 0 1 18 17 H 8.5 L 4.5 20.5 A 0.5 0.5 0 0 1 3.5 20 V 6 A 2.5 2.5 0 0 1 6 3.5 Z M 7.8 13.2 L 7.6 11.8 L 13.6 5.8 A 1 1 0 0 1 15 5.8 L 15.2 6 A 1 1 0 0 1 15.2 7.4 L 9.2 13.4 Z M 11.5 12.6 H 15.5 A 0.6 0.6 0 0 1 15.5 13.8 H 11.5 A 0.6 0.6 0 0 1 11.5 12.6 Z"
      />
    </svg>
  );
}

export function OverleafResolvedCommentsIcon({
  className = 'size-4',
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 2.5 2.5 C 1.67 2.5 1 3.17 1 4 V 12 C 1 12.83 1.67 13.5 2.5 13.5 H 13.5 C 14.33 13.5 15 12.83 15 12 V 4 C 15 3.17 14.33 2.5 13.5 2.5 H 2.5 Z M 3 4.2 H 13 V 8.5 H 10.85 C 10.5 8.5 10.18 8.68 10 8.95 L 9.15 10.15 C 9.05 10.25 8.9 10.3 8.75 10.3 H 7.25 C 7.1 10.3 6.95 10.25 6.85 10.15 L 6 8.95 C 5.82 8.68 5.5 8.5 5.15 8.5 H 3 V 4.2 Z"
      />
    </svg>
  );
}

// ── Mention Badges & Renderer ───────────────────────────────────────────────

export interface MentionBadgeProps {
  name: string;
  userId?: string;
  className?: string;
}

export const MentionBadge = React.memo(function MentionBadge({
  name,
  userId,
  className,
}: MentionBadgeProps) {
  return (
    <span
      data-mention-user-id={userId}
      data-mention-name={name}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.2 mx-0.5 rounded-sm font-medium text-xs text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors select-all align-baseline',
        className,
      )}
      title={userId ? `@${name} (ID: ${userId})` : `@${name}`}
    >
      <AtSign className="size-2.5 shrink-0 opacity-70" />
      <span>{name}</span>
    </span>
  );
});

export interface MentionRendererProps {
  content: string;
  className?: string;
}

export const MentionRenderer = React.memo(function MentionRenderer({
  content,
  className,
}: MentionRendererProps) {
  const tokens = useMemo(() => parseMentionTokens(content), [content]);

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <React.Fragment key={index}>{token.content}</React.Fragment>;
        }
        return (
          <MentionBadge
            key={index}
            name={token.name}
            userId={token.id}
          />
        );
      })}
    </span>
  );
});

// ── Notification Digest Badge ───────────────────────────────────────────────

export interface NotificationDigestBadgeProps {
  projectId?: string;
  pageId?: string;
}

export const NotificationDigestBadge: React.FC<NotificationDigestBadgeProps> = ({
  projectId,
  pageId,
}) => {
  const { data: bundles = [], isLoading } = usePendingBundles();
  const { data: history = [] } = useDigestHistory(5);
  const flushBundle = useFlushBundle();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeBundleInfo = bundles.find(
    (b) =>
      (projectId && b.bundle.projectId === projectId) ||
      (pageId && b.bundle.pageId === pageId) ||
      (!b.bundle.projectId && !b.bundle.pageId),
  ) || bundles[0];

  const [remainingSecs, setRemainingSecs] = useState<number>(
    activeBundleInfo?.remainingSeconds || 0,
  );

  useEffect(() => {
    if (!activeBundleInfo) return;
    setRemainingSecs(activeBundleInfo.remainingSeconds);

    const interval = setInterval(() => {
      setRemainingSecs((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBundleInfo]);

  if (isLoading && !activeBundleInfo) {
    return null;
  }

  if (!activeBundleInfo && history.length === 0) {
    return null;
  }

  const handleFlushNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    flushBundle.mutate({
      projectId,
      scopeId: activeBundleInfo?.bundle.projectId || projectId || pageId,
    });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return <AtSign className="w-3.5 h-3.5 text-primary shrink-0" />;
      case 'suggestion':
        return <GitPullRequest className="w-3.5 h-3.5 text-warning shrink-0" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />;
    }
  };

  if (activeBundleInfo && activeBundleInfo.itemCount > 0) {
    const items = activeBundleInfo.bundle.items;
    const authorNames = Array.from(
      new Set(items.map((i) => i.authorName)),
    ).slice(0, 3);
    const authorsText =
      authorNames.join(', ') +
      (authorNames.length < new Set(items.map((i) => i.authorName)).size
        ? ' et al.'
        : '');

    return (
      <div className="mb-3 rounded-md border border-border bg-muted/30 p-2.5 text-xs transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label="Toggle notification digest details"
            className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0 outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsExpanded(!isExpanded);
              }
            }}
          >
            <div className="relative flex items-center justify-center p-1.5 rounded-sm bg-muted text-muted-foreground shrink-0 border border-border/60">
              <Clock className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                <span>
                  <span className="font-mono">{activeBundleInfo.itemCount}</span> review update
                  {activeBundleInfo.itemCount > 1 ? 's' : ''} buffered
                </span>
                <span className="text-11 font-mono text-muted-foreground font-normal">
                  ({formatRemainingTime(remainingSecs)})
                </span>
              </div>
              <p className="text-12 text-muted-foreground truncate leading-normal">
                From {authorsText} · 10m Overleaf digest window
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={flushBundle.isPending}
              onClick={handleFlushNow}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-12 font-medium bg-warning/20 hover:bg-warning/30 text-foreground transition-colors disabled:opacity-50 cursor-pointer leading-normal outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Flush digest immediately to collaborators"
            >
              {flushBundle.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>Flush now</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title={isExpanded ? 'Collapse' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-2.5 pt-2 border-t border-warning/20 space-y-1.5 max-h-48 overflow-y-auto">
            {items.map((item: BundledNotificationItem) => (
              <div
                key={item.id}
                className="flex items-start gap-2 p-1.5 rounded-sm bg-background/60 dark:bg-background/40 border border-border/40 text-12"
              >
                {getEventIcon(item.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-foreground truncate">
                      {item.authorName}
                    </span>
                    <span className="text-11 text-muted-foreground capitalize">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-1 italic">
                    &ldquo;{item.contentSnippet}&rdquo;
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (history.length > 0) {
    const latestDigest = history[0];
    const isRecent =
      Date.now() - new Date(latestDigest.createdAt).getTime() < 3600000;

    if (!isRecent) return null;

    return (
      <div className="mb-3 rounded-md border border-border/60 bg-muted/30 p-2 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-3.5 h-3.5 text-foreground shrink-0" />
          <div className="truncate">
            <span className="font-medium text-foreground">Latest Digest: </span>
            <span className="text-muted-foreground">{latestDigest.summary}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
