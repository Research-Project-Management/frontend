'use client';

import React from 'react';
import { Search, PanelLeft } from 'lucide-react';
import AccountDropdown from './AccountDropdown';

export default function Topbar() {
  const handleToggleSidebar = () => {
    window.dispatchEvent(new CustomEvent('toggle-project-sidebar'));
  };

  return (
    <nav
      aria-label='App Header Navigation'
      className='relative flex h-11 max-h-11 w-full shrink-0 items-center justify-between bg-muted px-2.5 sm:px-3 select-none gap-2'
    >
      {/* Left: Sidebar Toggle Menu Button */}
      <div className='flex w-8 sm:w-11 items-center justify-center shrink-0 relative z-10'>
        <button
          type='button'
          onClick={handleToggleSidebar}
          aria-label='Toggle sidebar'
          title='Toggle menu'
          className='flex size-8 items-center justify-center rounded-md text-foreground hover:bg-background/70 active:bg-background transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
        >
          <PanelLeft className='size-4 text-foreground shrink-0' />
        </button>
      </div>

      {/* Center: Search box mathematically centered on desktop, fluid on mobile */}
      <div className='flex-1 max-w-[200px] sm:max-w-sm sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:px-4 pointer-events-none'>
        <button
          type='button'
          className='pointer-events-auto group flex h-8 w-full items-center gap-2 rounded-md border border-border bg-white dark:bg-card px-2.5 text-13 text-muted-foreground shadow-2xs transition-colors hover:border-foreground/30 hover:text-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
        >
          <Search className='size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0' />
          <span className='text-13 font-normal leading-none truncate'>Search...</span>
        </button>
      </div>

      {/* Right: User Avatar (AccountDropdown) */}
      <div className='flex items-center shrink-0 relative z-10'>
        <AccountDropdown align='end' />
      </div>
    </nav>
  );
}
