'use client';

import React, { useState, useEffect } from 'react';
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
  Sparkles,
} from 'lucide-react';
import {
  usePendingBundles,
  useFlushBundle,
  useDigestHistory,
} from '@/features/editor/hooks/use-notification-bundler';
import {
  formatRemainingTime,
  BundledNotificationItem,
} from '@/features/editor/utils/notification-digest.util';
import { cn } from '@/shared/lib/utils';

interface NotificationDigestBadgeProps {
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

  // Find bundle relevant to current scope (or any pending bundle for user)
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

  // If no active bundle and no recent digests, render nothing to avoid clutter
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
        return <GitPullRequest className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    }
  };

  // If we have a pending bundle currently buffering
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
      <div className="mb-3 rounded-md border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-r from-amber-50/70 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 p-2.5 text-xs shadow-xs transition-all">
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="relative flex items-center justify-center p-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shrink-0">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-background" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200 truncate">
                <span>
                  {activeBundleInfo.itemCount} review update
                  {activeBundleInfo.itemCount > 1 ? 's' : ''} buffered
                </span>
                <span className="text-10 text-amber-600/80 dark:text-amber-400/80 font-normal">
                  ({formatRemainingTime(remainingSecs)})
                </span>
              </div>
              <p className="text-11 text-amber-700/80 dark:text-amber-400/80 truncate">
                From {authorsText} · 10m Overleaf digest window
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={flushBundle.isPending}
              onClick={handleFlushNow}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-11 font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 transition-colors disabled:opacity-50 cursor-pointer"
              title="Flush digest immediately to collaborators"
            >
              {flushBundle.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>Flush now</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-sm text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
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

        {/* Expandable list of buffered items */}
        {isExpanded && (
          <div className="mt-2.5 pt-2 border-t border-amber-200/50 dark:border-amber-900/40 space-y-1.5 max-h-48 overflow-y-auto">
            {items.map((item: BundledNotificationItem) => (
              <div
                key={item.id}
                className="flex items-start gap-2 p-1.5 rounded-sm bg-background/60 dark:bg-background/40 border border-border/40 text-11"
              >
                {getEventIcon(item.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-foreground truncate">
                      {item.authorName}
                    </span>
                    <span className="text-10 text-muted-foreground uppercase">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-1 italic">
                    "{item.contentSnippet}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If no pending bundle, but recent digest was flushed in history
  if (history.length > 0) {
    const latestDigest = history[0];
    const isRecent =
      Date.now() - new Date(latestDigest.createdAt).getTime() < 3600000; // 1 hour

    if (!isRecent) return null;

    return (
      <div className="mb-3 rounded-md border border-border/60 bg-muted/30 p-2 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
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
