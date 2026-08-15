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
  FileText,
} from 'lucide-react';
import { cn } from '@/shared/lib';

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
        className='order-2 flex h-11 shrink-0 items-center justify-around gap-1 rounded-lg border border-border bg-muted p-1 md:order-1 md:h-full md:w-14 md:flex-col md:justify-start md:gap-1 md:rounded-none md:border-0 md:bg-transparent md:px-1 md:py-3'
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
              className={cn(
                'group relative flex w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg py-1 select-none outline-none transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                isActive
                  ? 'text-foreground'
                  : 'text-foreground/80 hover:text-foreground'
              )}
            >
              <div className={cn(
                'relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
                !isActive && 'group-hover:bg-black/10 dark:group-hover:bg-white/10'
              )}>
                {isActive && (
                  <motion.div
                    layoutId={`sidebar-active-${id}`}
                    className='absolute inset-0 rounded-lg bg-black/10 dark:bg-white/10'
                    initial={false}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                  />
                )}

                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={item.label}
                    className={cn(
                      'relative z-10 size-5 transition-opacity duration-200',
                      isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'
                    )}
                  />
                ) : Icon ? (
                  <Icon
                    className="relative z-10 size-5 text-foreground transition-transform duration-200"
                  />
                ) : null}
              </div>

              <span className='relative z-10 max-w-full whitespace-nowrap text-[11px] font-medium tracking-tight leading-none transition-colors data-[active=true]:font-semibold data-[active=true]:text-foreground text-foreground' data-active={isActive}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
