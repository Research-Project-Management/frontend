'use client';

import Link from 'next/link';
import { Mail, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";
import AccountDropdown from './AccountDropdown';

export default function Topbar() {
  return (
    <nav
      aria-label='App Header Navigation'
      className='flex h-11 w-full shrink-0 items-center justify-between gap-4 bg-muted px-2 select-none'
    >
      {/* Left: Project logo */}
      <div className='flex items-center gap-2 min-w-0 shrink-0'>
        <Link
          href='/home'
          className='flex items-center gap-2 px-2 py-1 rounded-md hover:bg-foreground/5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary select-none group'
          title='Flux Home'
        >
          <img src='/Flux.svg' alt='Flux' className='size-5 shrink-0 group-hover:scale-105 transition-transform' />
          <span className='text-13 font-semibold tracking-tight text-foreground'>Flux</span>
        </Link>
      </div>

      {/* Center: Search placeholder */}
      <div className='flex flex-1 items-center justify-center max-w-sm px-2'>
        <button
          type='button'
          className='group flex h-8 w-full items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-13 text-foreground shadow-none transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
        >
          <Search className='size-3.5 text-foreground shrink-0' />
          <span className='text-13 text-muted-foreground truncate'>Search...</span>
        </button>
      </div>

      {/* Right: Inbox & User Avatar */}
      <div className='flex items-center gap-1.5 shrink-0'>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                className='group flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
                aria-label='Inbox'
              >
                <Mail className='size-4 text-foreground shrink-0' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' sideOffset={6}>
              Inbox
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <AccountDropdown />
      </div>
    </nav>
  );
}
