'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Rss,
  ChevronRight,
  Plus,
  CheckCheck,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { SidebarNavItem } from './SidebarSystemNav';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import {
  useFeedSubscriptionsQuery,
  useUnsubscribeFeedMutation,
} from '@/features/library/sdk/queries/ingestion.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type { SavedFeedSubscription } from '@/features/library/domain/types/ingestion.types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface FeedContextMenuProps {
  feed: SavedFeedSubscription;
  onRefresh?: (feed: SavedFeedSubscription) => void;
  onMarkAllAsRead?: (feed: SavedFeedSubscription) => void;
  onEdit: (feed: SavedFeedSubscription) => void;
  onDelete: (feed: SavedFeedSubscription) => void;
}

export function FeedContextMenu({
  feed,
  onRefresh,
  onMarkAllAsRead,
  onEdit,
  onDelete,
}: FeedContextMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground opacity-0 max-md:opacity-100 group-hover/item:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-background data-[state=open]:border-border data-[state=open]:text-foreground focus-visible:opacity-100 border border-transparent hover:border-border/50 hover:bg-background transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          aria-label={`Options for ${feed.name}`}
        >
          <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-48 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
      >
        {onRefresh && (
          <DropdownMenuItem
            onClick={() => onRefresh(feed)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <RefreshCw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Refresh Feed</span>
          </DropdownMenuItem>
        )}

        {onMarkAllAsRead && (
          <DropdownMenuItem
            onClick={() => onMarkAllAsRead(feed)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <CheckCheck className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Mark Feed as Read</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => onEdit(feed)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Pencil className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Edit Feed...</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => onDelete(feed)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
        >
          <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
          <span>Unsubscribe</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  const markFeedAsRead = useFeedsStore((s) => s.markFeedAsRead);
  const setActiveFeedId = useFeedsStore((s) => s.setActiveFeedId);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isActiveScope) {
    return null;
  }

  const isFeedsRootActive = pathname === `${basePath}/feeds`;

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 w-full">
      <div className="relative group/root flex items-center w-full">
        <div
          onClick={() => {
            setIsExpanded(true);
            router.push(`${basePath}/feeds`);
            onItemClick?.();
          }}
          className={cn(
            'group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none pr-14 cursor-pointer text-left font-normal',
            isFeedsRootActive
              ? 'bg-muted font-medium text-foreground'
              : 'text-foreground hover:bg-muted group-hover/root:bg-muted',
          )}
        >
          <Rss className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
          <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground">
            Feeds
          </span>
        </div>

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
                        await markFeedAsRead(feed.id);
                        toast.success(`Marked all articles in "${feed.name}" as read`);
                      } catch {
                        toast.error(`Failed to mark articles in "${feed.name}" as read`);
                      }
                    }}
                    onEdit={(f) => openModal('EDIT_FEED', { feed: f })}
                    onDelete={async (f) => {
                      try {
                        await unsubscribeFeed(f.id);
                        toast.success(`Unsubscribed from "${f.name}"`);
                      } catch {
                        // Error toast handled by mutation or caller
                      }
                    }}
                  />
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FeedsListSection;
