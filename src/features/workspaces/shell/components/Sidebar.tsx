'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import {
  CloudIcon,
  Square3Stack3DIcon,
  Cog6ToothIcon,
  BookOpenIcon,
} from '@heroicons/react/24/solid';
import { cn } from '@/shared/lib';

const NAV_ITEMS = [
  { label: 'Projects', icon: Square3Stack3DIcon, to: '' },
  { label: 'AI', imageSrc: '/Chat.svg', to: '/ai' },
  { label: 'Library', icon: BookOpenIcon, to: '/library' },
  { label: 'Storage', icon: CloudIcon, to: '/storage' },
  { label: 'Settings', icon: Cog6ToothIcon, to: '/settings' },
] as const;

export default function Sidebar() {
  const id = useId();
  const pathname = usePathname();
  const { workspaceId } = useParams() as { workspaceId: string };

  return (
    <LayoutGroup id={id}>
      <nav
        aria-label='Main Navigation'
        className='order-2 flex h-11 shrink-0 items-center justify-around gap-1 rounded-lg border border-border bg-[oklch(0.9543_0.001_230.67)] dark:bg-[oklch(0.1932_0.002_230.81)] p-1 md:order-1 md:h-auto md:w-[52px] md:flex-col md:justify-start md:gap-1.5 md:rounded-none md:border-0 md:bg-transparent md:px-1 md:py-2'
      >
        {NAV_ITEMS.map((item) => {
          const Icon = 'icon' in item ? item.icon : null;
          const imageSrc = 'imageSrc' in item ? item.imageSrc : null;
          const fullPath = `/${workspaceId}${item.to}`;

          const isActive = (() => {
            if (item.to === '') {
              const rest = pathname.replace(`/${workspaceId}`, '');
              return (
                rest === '' ||
                rest === '/' ||
                (!rest.startsWith('/ai') &&
                  !rest.startsWith('/team') &&
                  !rest.startsWith('/storage') &&
                  !rest.startsWith('/settings') &&
                  !rest.startsWith('/library'))
              );
            }
            return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
          })();

          return (
            <Link
              key={item.label}
              href={fullPath}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1 md:h-10 md:w-full md:flex-none select-none outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors',
                isActive
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId={`sidebar-active-${id}`}
                  className='absolute inset-0 rounded-md bg-background shadow-2xs border border-border/40'
                  initial={false}
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}

              <div className='relative flex size-8 items-center justify-center'>
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={item.label}
                    className={cn(
                      'relative z-10 size-4 transition-all duration-200 group-hover:scale-110',
                      isActive
                        ? 'grayscale-0 opacity-100'
                        : 'grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100'
                    )}
                  />
                ) : Icon ? (
                  <Icon
                    className={cn(
                      'relative z-10 size-4 transition-transform duration-200 group-hover:scale-110',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                ) : null}
              </div>

              <span className='relative z-10 max-w-full whitespace-nowrap text-[10px] font-medium leading-tight'>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
