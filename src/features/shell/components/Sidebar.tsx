'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Settings,
  MessageSquare,
} from 'lucide-react';
import { ProjectsIcon, LibraryIcon, StorageIcon } from '@/shared/components/icons';
import { cn } from "@/shared/lib/utils";
import { useAiCompanionStore } from '@/features/ai/store/ai-companion.store';
import { useChatBadgeCounts } from '@/features/chat/hooks/use-chat-queries';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import dynamic from 'next/dynamic';

const StickyDock = dynamic(() => import('./StickyDock'), {
  ssr: false,
  loading: () => <div className="size-8" />,
});

const NAV_ITEMS_LEFT = [
  { label: 'Projects', icon: ProjectsIcon, to: '/home' },
  { label: 'Library', icon: LibraryIcon, to: '/library' },
] as const;

const NAV_ITEMS_RIGHT = [
  { label: 'Chat', icon: MessageSquare, to: '/chat' },
  { label: 'Storage', icon: StorageIcon, to: '/storage' },
  { label: 'Settings', icon: Settings, to: '/settings' },
] as const;

const ALL_NAV_ITEMS = [...NAV_ITEMS_LEFT, ...NAV_ITEMS_RIGHT] as const;

export default function Sidebar() {
  const id = useId();
  const pathname = usePathname();
  const isOpen = useAiCompanionStore((s) => s.isOpen);
  const toggleOpen = useAiCompanionStore((s) => s.toggleOpen);
  const { totalUnreadMessages, pendingFriendRequests, totalBadgeCount } = useChatBadgeCounts();

  const renderNavLink = (item: typeof ALL_NAV_ITEMS[number]) => {
    const Icon = item.icon;
    const fullPath = item.to;

    const isActive =
      item.label === 'Projects'
        ? pathname === '/' ||
          pathname === '/home' ||
          pathname.startsWith('/home/') ||
          pathname === '/projects' ||
          pathname.startsWith('/projects/') ||
          pathname === '/drafts' ||
          pathname.startsWith('/drafts/') ||
          pathname === '/your-work' ||
          pathname.startsWith('/your-work/')
        : pathname === item.to || pathname.startsWith(`${item.to}/`);

    const navContent = (
      <Link
        key={item.label}
        href={fullPath}
        prefetch={false}
        aria-current={isActive ? 'page' : undefined}
        className='group relative flex flex-1 md:w-full cursor-pointer flex-col items-center justify-center gap-0.5 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 text-foreground shrink-0 py-0.5'
      >
        <div
          className={cn(
            'relative flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
            !isActive && 'group-hover:bg-sidebar-hover'
          )}
        >
          {isActive && (
            <div className='absolute inset-0 rounded-md bg-sidebar-accent' />
          )}

          <Icon
            className="relative z-10 size-4.5 text-foreground transition-transform duration-200"
          />

          {item.label === 'Chat' && totalBadgeCount > 0 && (
            <span
              className="absolute -top-1 -right-1 z-20 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-10 font-semibold leading-none ring-2 ring-muted shadow-2xs pointer-events-none"
              title={`${totalUnreadMessages} unread messages, ${pendingFriendRequests} pending requests`}
            >
              {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
            </span>
          )}
        </div>

        <span
          className={cn(
            'relative z-10 whitespace-nowrap text-center text-10 md:text-11 tracking-tight leading-none select-none text-foreground transition-colors duration-200',
            isActive ? 'font-medium' : 'font-normal'
          )}
        >
          {item.label}
        </span>
      </Link>
    );

    if (item.label === 'Chat' && totalBadgeCount > 0) {
      return (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            {navContent}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <div className="flex flex-col gap-0.5 text-11">
              <span className="font-semibold text-foreground">Chat</span>
              {totalUnreadMessages > 0 && (
                <span className="text-muted-foreground">{totalUnreadMessages} unread message{totalUnreadMessages > 1 ? 's' : ''}</span>
              )}
              {pendingFriendRequests > 0 && (
                <span className="text-muted-foreground">{pendingFriendRequests} pending request{pendingFriendRequests > 1 ? 's' : ''}</span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return navContent;
  };

  return (
    <LayoutGroup id={id}>
      <nav
        aria-label='Main Navigation'
        className='order-2 relative flex h-14 shrink-0 items-center justify-between bg-transparent px-2 py-1 md:order-1 md:h-full md:w-11 md:flex-col md:justify-start md:gap-3 md:rounded-none md:border-t-0 md:border-r-0 md:bg-muted md:p-0 md:py-2 select-none z-30'
      >
        {/* ── Mobile Navigation Bar Background ── */}
        <div className='md:hidden absolute inset-0 pointer-events-none -z-10 bg-muted border-t border-border' />

        {/* ── Mobile Layout (< md): Left 2 items + Elevated Center AI Button + Right 2 items ── */}
        <div className='flex md:hidden items-center justify-around w-full'>
          {NAV_ITEMS_LEFT.map(renderNavLink)}

          {/* Center Floating AI Chat Button nested in Notch */}
          <div className='flex items-center justify-center px-1 shrink-0'>
            <button
              type='button'
              onClick={toggleOpen}
              aria-label='Ask AI Assistant'
              title='Ask AI Assistant'
              className={cn(
                'relative flex size-10 shrink-0 -translate-y-4 items-center justify-center rounded-full bg-background shadow-md transition-[transform,box-shadow] duration-200 cursor-pointer outline-none hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ai select-none overflow-hidden z-20',
                isOpen && 'shadow-lg'
              )}
            >
              <img
                src='/Chat.svg'
                alt='AI Assistant'
                className='size-full object-cover rounded-full block'
              />
            </button>
          </div>

          {NAV_ITEMS_RIGHT.map(renderNavLink)}
        </div>

        {/* ── Desktop Layout (>= md): Vertical Nav list on Left Rail + AI Chat Button at bottom ── */}
        <div className='hidden md:flex flex-col items-center justify-start gap-3 w-full'>
          {ALL_NAV_ITEMS.map(renderNavLink)}
        </div>

        {/* Desktop Tool Support Cluster at bottom of Left Rail: Sticky Dock + Chat AI */}
        <div className='hidden md:flex w-full mt-auto flex-col items-center gap-2 relative shrink-0 pt-2 pb-1'>
          <StickyDock />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={toggleOpen}
                className={cn(
                  'group relative flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ai text-foreground hover:bg-sidebar-hover',
                  isOpen && 'bg-sidebar-accent text-ai'
                )}
                aria-label='AI Assistant (Ctrl+J)'
              >
                <img
                  src='/Chat.svg'
                  alt='AI Assistant'
                  className='size-4.5 shrink-0 rounded-full block object-contain'
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side='right' sideOffset={10}>
              AI Assistant (Ctrl+J)
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </LayoutGroup>
  );
}


