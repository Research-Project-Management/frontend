'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Search, Bell } from 'lucide-react';
import { useAiCompanionStore } from '@/features/ai/store/ai-companion.store';
import { usePathname } from 'next/navigation';
import { useUnreadNotificationCount } from '../hooks/use-inbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import AccountDropdown from './AccountDropdown';
import SpaceSwitcher from './SpaceSwitcher';

export default function Topbar() {
  const pathname = usePathname();
  const isAiRoute = pathname?.startsWith('/ai');
  const isInboxActive = pathname === '/inbox' || pathname?.startsWith('/inbox/');
  const toggleOpen = useAiCompanionStore((s) => s.toggleOpen);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  // Global keyboard shortcut: Cmd+J or Ctrl+J to toggle AI Companion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (!isAiRoute) {
          toggleOpen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOpen, isAiRoute]);

  return (
    <nav
      aria-label='App Header Navigation'
      className='relative flex h-11 max-h-11 w-full shrink-0 items-center justify-between bg-muted px-2.5 sm:px-3 select-none gap-2'
    >
      {/* Left: Space Switcher (Personal Space vs Project Spaces) */}
      <div className='flex items-center justify-start shrink-0 relative z-10'>
        <SpaceSwitcher />
      </div>

      {/* Center: Search box mathematically centered on desktop, fluid on mobile */}
      <div className='flex-1 max-w-[200px] sm:max-w-[300px] md:max-w-[340px] lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:px-4 pointer-events-none'>
        <button
          type='button'
          onClick={() => window.dispatchEvent(new CustomEvent('open-quick-search'))}
          className='pointer-events-auto group flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-13 text-foreground transition-colors hover:border-foreground/30 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
          aria-label='Search'
        >
          <Search className='size-3.5 text-foreground shrink-0' />
          <span className='text-13 font-normal leading-none truncate text-foreground'>
            Search...
          </span>
        </button>
      </div>

      {/* Right: Standalone Inbox Button + User Avatar */}
      <div className='flex items-center justify-end gap-1.5 shrink-0 relative z-10'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href='/inbox'
              aria-label='Inbox'
              className={cn(
                'relative flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-background/80 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-1.5 md:before:hidden',
                isInboxActive && 'bg-background border border-border/60'
              )}
            >
              <Bell className='size-4 text-foreground shrink-0' strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className='absolute top-1 right-1 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[9px] font-semibold leading-none ring-2 ring-muted pointer-events-none'>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side='bottom' sideOffset={6}>
            Inbox {unreadCount > 0 ? `(${unreadCount})` : ''}
          </TooltipContent>
        </Tooltip>

        <AccountDropdown align='end' />
      </div>
    </nav>
  );
}
