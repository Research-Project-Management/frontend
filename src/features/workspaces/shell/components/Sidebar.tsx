'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Cloud,
  Layers,
  Settings,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const NAV_ITEMS = [
  { label: 'Projects', icon: Layers, to: '' },
  { label: 'AI', imageSrc: '/Chat.svg', to: '/ai' },
  { label: 'Library', icon: BookOpen, to: '/library' },
  { label: 'Storage', icon: Cloud, to: '/storage' },
  { label: 'Settings', icon: Settings, to: '/settings' },
] as const;

export default function Sidebar() {
  const id = useId();
  const pathname = usePathname();
  const { workspaceId } = useParams() as { workspaceId: string };

  return (
    <LayoutGroup id={id}>
      <nav
        aria-label='Main Navigation'
        className='order-2 flex h-12 shrink-0 items-center justify-around gap-1 border-t border-border bg-sidebar p-1 md:order-1 md:h-full md:w-12 md:flex-col md:justify-start md:gap-2.5 md:rounded-none md:border-t-0 md:border-r-0 md:bg-sidebar md:p-0 md:py-2'
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
                  !rest.startsWith('/stickies') &&
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
              className='group relative flex w-full cursor-pointer flex-col items-center justify-center gap-1 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 text-foreground'
            >
              <div
                className={cn(
                  'relative flex size-8.5 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
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

                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={item.label}
                    className='relative z-10 size-5 transition-transform duration-200'
                  />
                ) : Icon ? (
                  <Icon
                    className="relative z-10 size-5 text-foreground transition-transform duration-200"
                  />
                ) : null}
              </div>

              <span
                className={cn(
                  'relative z-10 whitespace-nowrap text-center text-11 tracking-tight leading-none select-none text-foreground transition-colors duration-200',
                  isActive ? 'font-medium' : 'font-normal'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}


