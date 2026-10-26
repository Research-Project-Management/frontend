'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Rss, ChevronRight, Plus } from 'lucide-react';
import { SidebarNavItem } from './SidebarNavItem';
import { FeedContextMenu } from './FeedContextMenu';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import {
  useFeedSubscriptionsQuery,
  useUnsubscribeFeedMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import { FeedsService } from '@/features/library/sdk/clients/ingestion-sync.client';

const EditFeedModal = dynamic(
  () => import('../modals/EditFeedModal').then((m) => m.EditFeedModal),
  { ssr: false },
);
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';

export interface FeedsListSectionProps {
  basePath: string;
  navId: string;
  currentFilter: string | null;
  currentFeedId?: string | null;
  isActiveScope?: boolean;
  onItemClick?: () => void;
}

export function FeedsListSection({
  basePath,
  navId,
  currentFilter,
  currentFeedId,
  isActiveScope = true,
  onItemClick,
}: FeedsListSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  useFeedSubscriptionsQuery({ enabled: isActiveScope });
  const feeds = useFeedsStore((s) => s.feeds);
  const { mutateAsync: unsubscribeFeed } = useUnsubscribeFeedMutation();
  const triggerRefresh = useFeedsStore((s) => s.triggerRefresh);
  const markAllEntriesAsRead = useFeedsStore((s) => s.markAllEntriesAsRead);
  const setActiveFeedId = useFeedsStore((s) => s.setActiveFeedId);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingFeed, setEditingFeed] = useState<SavedFeedSubscription | null>(null);

  if (!isActiveScope) {
    return null;
  }

  const isFeedsRootActive = pathname === `${basePath}/feeds`;

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 w-full">
      {/* Root Section Item: Feeds */}
      <div className="relative group/root flex items-center w-full">
        <div
          onClick={() => {
            setIsExpanded(true);
            router.push(`${basePath}/feeds`);
            onItemClick?.();
          }}
          className={cn(
            "group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-14 cursor-pointer text-left font-normal",
            isFeedsRootActive
              ? "bg-muted font-medium text-foreground"
              : "text-foreground hover:bg-muted group-hover/root:bg-muted",
          )}
        >
          <Rss className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground">
            Feeds
          </span>
        </div>

        {/* Quick Add Feed Button - hidden by default, visible on root hover */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openModal('ADD_FEED');
              }}
              className="absolute right-7 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background opacity-0 max-md:opacity-100 group-hover/root:opacity-100 focus-visible:opacity-100 cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="New feed"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            New feed
          </TooltipContent>
        </Tooltip>

        {/* Collapse / Expand Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded((v) => !v);
              }}
              aria-label={isExpanded ? 'Collapse Feeds' : 'Expand Feeds'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 transition-transform duration-150 shrink-0',
                  isExpanded && 'rotate-90',
                )}
                strokeWidth={1.5}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Subscribed Feeds List (Child Items aligned with Sidebar items) */}
      {isExpanded && feeds.length === 0 && (
        <div className="px-3 py-1.5 text-11 text-muted-foreground/60 italic select-none">
          No feeds subscribed
        </div>
      )}
      {isExpanded && feeds.length > 0 && (
        <div className="flex flex-col gap-0.5 w-full">
          {feeds.map((feed) => {
            const isFeedActive =
              pathname === `${basePath}/feeds/${feed.id}` ||
              (currentFilter === 'feed' &&
                (currentFeedId === feed.id || (!currentFeedId && feed === feeds[0])));

            return (
              <SidebarNavItem
                key={feed.id}
                href={`${basePath}/feeds/${feed.id}`}
                icon={Rss}
                label={feed.name}
                isActive={isFeedActive}
                navId={navId}
                onClick={onItemClick}
                action={
                  <FeedContextMenu
                    feed={feed}
                    onRefresh={() => {
                      setActiveFeedId(feed.id);
                      triggerRefresh();
                      toast.info(`Refreshing "${feed.name}"...`);
                    }}
                    onMarkAllAsRead={async () => {
                      try {
                        const res = await FeedsService.getItems(feed.id);
                        const items = (res?.data as Array<{ id?: string; guid?: string; url?: string }>) || [];
                        const itemIds = items.map((it) => it.id || it.guid || it.url).filter(Boolean) as string[];
                        if (itemIds.length > 0) {
                          markAllEntriesAsRead(itemIds);
                        } else {
                          markAllEntriesAsRead();
                        }
                      } catch {
                        markAllEntriesAsRead();
                      }
                      toast.success(`Marked all articles in "${feed.name}" as read`);
                    }}
                    onEdit={(f) => setEditingFeed(f)}
                    onDelete={(f) => {
                      void unsubscribeFeed(f.id);
                      toast.success(`Unsubscribed from "${f.name}"`);
                    }}
                  />
                }
              />
            );
          })}
        </div>
      )}

      {/* Edit Feed Modal */}
      <EditFeedModal
        open={Boolean(editingFeed)}
        onOpenChange={(open) => {
          if (!open) setEditingFeed(null);
        }}
        feed={editingFeed}
      />
    </div>
  );
}

export default FeedsListSection;
