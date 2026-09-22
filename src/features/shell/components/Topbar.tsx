'use client';

import React, { useEffect } from 'react';
import { Search } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useAiCompanionStore } from '@/features/ai/store';
import AccountDropdown from './AccountDropdown';

export default function Topbar() {
  const { isOpen, toggleOpen } = useAiCompanionStore();

  // Global keyboard shortcut: Cmd+J or Ctrl+J to toggle AI Companion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleOpen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOpen]);

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

      {/* Right: Ask Flux AI button (clean, centered icon and text, rounded-md) */}
      <div className='flex items-center shrink-0'>
        <button
          type='button'
          onClick={toggleOpen}
          className={cn(
            'group inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-13 font-medium shadow-2xs transition-all duration-200 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none active:scale-98',
            isOpen
              ? 'border-primary/50 bg-primary/10 text-primary shadow-xs'
              : 'border-border bg-white dark:bg-card text-foreground hover:border-foreground/20 hover:bg-accent/40'
          )}
          title='Ask Flux AI'
        >
          <img
            src='/Chat.svg'
            alt='Flux AI'
            className={cn(
              'size-4 shrink-0 rounded-full block object-contain transition-transform duration-300',
              isOpen ? 'scale-110' : 'group-hover:scale-110'
            )}
          />
          <span className='tracking-tight leading-none'>Ask Flux AI</span>
        </button>
      </div>
    </nav>
  );
}
