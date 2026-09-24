'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Layers,
  Settings,
} from 'lucide-react';
import { LibraryIcon, StorageIcon } from '@/shared/components/icons';
import { cn } from "@/shared/lib/utils";
import { useAiCompanionStore } from '@/features/ai/store';

const NAV_ITEMS_LEFT = [
  { label: 'Projects', icon: Layers, to: '/home' },
  { label: 'Library', icon: LibraryIcon, to: '/library' },
] as const;

const NAV_ITEMS_RIGHT = [
  { label: 'Storage', icon: StorageIcon, to: '/storage' },
  { label: 'Settings', icon: Settings, to: '/settings' },
] as const;

const ALL_NAV_ITEMS = [...NAV_ITEMS_LEFT, ...NAV_ITEMS_RIGHT] as const;

export default function Sidebar() {
  const id = useId();
  const pathname = usePathname();
  const { isOpen, toggleOpen } = useAiCompanionStore();

  const renderNavLink = (item: typeof ALL_NAV_ITEMS[number]) => {
    const Icon = item.icon;
    const fullPath = item.to;

    const isActive =
      item.label === 'Projects'
        ? pathname === '/' ||
          pathname === '/home' ||
          pathname.startsWith('/home/') ||
          pathname === '/dashboard' ||
          pathname.startsWith('/dashboard/') ||
          pathname === '/projects' ||
          pathname.startsWith('/projects/') ||
          pathname === '/drafts' ||
          pathname.startsWith('/drafts/') ||
          pathname === '/your-work' ||
          pathname.startsWith('/your-work/')
        : pathname === item.to || pathname.startsWith(`${item.to}/`);

    return (
      <Link
        key={item.label}
        href={fullPath}
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
            <motion.div
              layoutId={`sidebar-active-${id}`}
              className='absolute inset-0 rounded-md bg-sidebar-accent'
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}

          <Icon
            className="relative z-10 size-4.5 text-foreground transition-transform duration-200"
          />
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
  };

  return (
    <LayoutGroup id={id}>
      <nav
        aria-label='Main Navigation'
        className='order-2 relative flex h-14 shrink-0 items-center justify-between bg-transparent px-2 py-1 md:order-1 md:h-full md:w-11 md:flex-col md:justify-start md:gap-3 md:rounded-none md:border-t-0 md:border-r-0 md:bg-muted md:p-0 md:py-2 select-none z-30'
      >
        {/* ── Mobile Real Scooped Notch Background & Border (Khoét rãnh chuẩn, rộng rãi không bị móp) ── */}
        <div className='md:hidden absolute inset-0 pointer-events-none overflow-visible -z-10'>
          {/* Left panel */}
          <div className='absolute left-0 top-0 w-[calc(50%-44px)] h-full bg-muted border-t border-border' />
          
          {/* Center notched cutout */}
          <div className='absolute left-1/2 -translate-x-1/2 top-0 w-[88px] h-full overflow-visible'>
            <svg
              className='w-[88px] h-full overflow-visible'
              viewBox='0 0 88 56'
              fill='none'
              preserveAspectRatio='none'
            >
              {/* Notch Background Fill */}
              <path
                d='M 0,0 C 8,0 14,5 19,18 A 26 26 0 0 0 69 18 C 74,5 80,0 88,0 L 88,56 L 0,56 Z'
                className='fill-muted'
              />
              {/* Top Notch Border Stroke */}
              <path
                d='M 0,0.5 C 8,0.5 14,5.5 19,18.5 A 26 26 0 0 0 69 18.5 C 74,5.5 80,0.5 88,0.5'
                className='stroke-border'
                strokeWidth='1'
                fill='none'
              />
            </svg>
          </div>

          {/* Right panel */}
          <div className='absolute right-0 top-0 w-[calc(50%-44px)] h-full bg-muted border-t border-border' />
        </div>

        {/* ── Mobile Layout (< md): Left 2 items + Elevated Center AI Button + Right 2 items ── */}
        <div className='flex md:hidden items-center justify-around w-full'>
          {NAV_ITEMS_LEFT.map(renderNavLink)}

          {/* Center Floating AI Chat Button nested in Notch */}
          <div className='flex items-center justify-center px-1 shrink-0'>
            <button
              type='button'
              onClick={toggleOpen}
              aria-label='Ask Flux AI'
              title='Ask Flux AI'
              className={cn(
                'relative flex size-10 shrink-0 -translate-y-4 items-center justify-center rounded-full bg-background border border-border/80 shadow-md transition-all duration-200 cursor-pointer outline-none hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary select-none overflow-hidden z-20',
                isOpen && 'border-foreground/30 shadow-lg'
              )}
            >
              <img
                src='/Chat.svg'
                alt='Flux AI'
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

        {/* Desktop Chat AI Button at bottom of Left Rail */}
        <div className='hidden md:flex w-full mt-auto flex-col items-center relative shrink-0 pt-2 border-t border-border/40'>
          <button
            type='button'
            onClick={toggleOpen}
            className={cn(
              'group relative flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200 outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary text-foreground hover:bg-sidebar-hover',
              isOpen && 'bg-sidebar-accent text-primary'
            )}
            title='Ask Flux AI'
            aria-label='Ask Flux AI'
          >
            <img
              src='/Chat.svg'
              alt='Flux AI'
              className={cn(
                'size-4.5 shrink-0 rounded-full block object-contain transition-transform duration-300',
                isOpen ? 'scale-110' : 'group-hover:scale-110'
              )}
            />
          </button>
        </div>
      </nav>
    </LayoutGroup>
  );
}


