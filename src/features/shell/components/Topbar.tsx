'use client';

import React, { useEffect } from 'react';
import { Search } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useAiCompanionStore } from '@/features/ai/store';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import { usePathname, useRouter } from 'next/navigation';
import AccountDropdown from './AccountDropdown';
import InboxPopover from '@/features/inbox/components/InboxPopover';

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAiRoute = pathname?.startsWith('/ai');
  const { toggleOpen } = useAiCompanionStore();

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

  const handleAiClick = () => {
    if (isAiRoute) {
      router.push('/ai');
    } else {
      toggleOpen();
    }
  };

  return (
    <nav
      aria-label='App Header Navigation'
      className='relative flex h-11 max-h-11 w-full shrink-0 items-center justify-between bg-muted px-2.5 select-none'
    >
      {/* Left: User Avatar (aligned with 44px left rail) */}
      <div className='flex w-11 items-center justify-center shrink-0'>
        <AccountDropdown align='start' />
      </div>

      {/* Center: Search box mathematically centered in Topbar */}
      <div className='absolute left-1/2 -translate-x-1/2 w-full max-w-sm px-4 pointer-events-none'>
        <button
          type='button'
          className='pointer-events-auto group flex h-8 w-full items-center gap-2 rounded-md border border-border bg-white dark:bg-card px-2.5 text-13 text-muted-foreground shadow-2xs transition-colors hover:border-foreground/30 hover:text-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
        >
          <Search className='size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0' />
          <span className='text-13 font-normal leading-none truncate'>Search...</span>
        </button>
      </div>

      {/* Right: Inbox Notification Bell + AI assistant button */}
      <div className='flex items-center gap-2 shrink-0'>
        <InboxPopover align='end' />

        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={handleAiClick}
                className='inline-flex h-8 items-center gap-2 rounded-md border border-border bg-white dark:bg-card px-2.5 text-13 font-medium text-foreground shadow-2xs cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none'
                aria-label='AI assistant'
              >
                <img
                  src='/Chat.svg'
                  alt='AI assistant'
                  className='size-4 shrink-0 rounded-full block object-contain'
                />
                <span className='tracking-tight leading-none'>AI assistant</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' sideOffset={6} className='flex items-center gap-1.5'>
              <span>AI assistant</span>
              <kbd className='rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground'>
                Ctrl+J
              </kbd>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </nav>
  );
}
