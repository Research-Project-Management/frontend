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
        aria-label='Main Navigation'
        className='order-2 flex h-11 shrink-0 items-center justify-around gap-1 rounded-lg border border-border bg-muted p-1 md:order-1 md:h-full md:w-14 md:flex-col md:justify-start md:gap-2 md:rounded-none md:border-0 md:bg-transparent md:px-1.5 md:py-3'
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
                'group relative flex h-10 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-0.5 md:h-12 md:w-full md:flex-none select-none outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors',
                isActive
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId={`sidebar-active-${id}`}
                  className='absolute inset-0 rounded-lg bg-accent'
                  initial={false}
                  transition={{ ease: 'easeOut', duration: 0.2 }}
                />
              )}

              <div className='relative flex size-6 items-center justify-center'>
                {imageSrc ? (
                  <div
                    className={cn(
                      'relative z-10 size-4 transition-colors duration-200',
                      isActive
                        ? 'bg-foreground'
                        : 'bg-muted-foreground group-hover:bg-foreground'
                    )}
                    style={{
                      WebkitMaskImage: `url(${imageSrc})`,
                      WebkitMaskSize: 'contain',
                      WebkitMaskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskImage: `url(${imageSrc})`,
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                    }}
                  />
                ) : Icon ? (
                  <Icon
                    className={cn(
                      'relative z-10 size-4 transition-transform duration-200',
                      isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                ) : null}
              </div>

              <span className='relative z-10 max-w-full whitespace-nowrap text-[11px] font-medium tracking-wide leading-none transition-colors data-[active=true]:font-semibold data-[active=true]:text-foreground text-muted-foreground group-hover:text-foreground' data-active={isActive}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
