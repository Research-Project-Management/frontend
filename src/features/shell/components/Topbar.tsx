'use client';

import React, { useEffect } from 'react';
import { Search } from 'lucide-react';
import { useAiCompanionStore } from '@/features/ai';
import { usePathname } from 'next/navigation';
import AccountDropdown from './AccountDropdown';
import SpaceSwitcher from './SpaceSwitcher';

export default function Topbar() {
  const pathname = usePathname();
  const isAiRoute = pathname?.startsWith('/ai');
  const toggleOpen = useAiCompanionStore((s) => s.toggleOpen);

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

      {/* Right: User Avatar */}
      <div className='flex items-center justify-end gap-1.5 shrink-0 relative z-10'>
        <AccountDropdown align='end' />
      </div>
    </nav>
  );
}
