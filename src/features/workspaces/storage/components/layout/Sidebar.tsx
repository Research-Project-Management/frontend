'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Home,
  File,
  Users,
  Star,
  Trash,
  PanelLeftClose,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export default function Sidebar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId } = useParams();
  const pathname = usePathname();
  const id = useId();

  const basePath = `/${workspaceId}/storage`;

  // Storage-specific navigation
  const storageItems = [
    { label: 'Home', icon: Home, to: basePath },
    { label: 'My Drive', icon: File, to: `${basePath}/my-files` },
    { label: 'Shared', icon: Users, to: `${basePath}/shared` },
    { label: 'Starred', icon: Star, to: `${basePath}/starred` },
    { label: 'Trash', icon: Trash, to: `${basePath}/trash` },
  ];

  return (
    <aside className='h-full w-60 flex flex-col justify-between overflow-x-hidden border-r border-border bg-transparent p-2.5 py-4 select-none max-md:w-full max-md:border-r-0 max-md:border-b max-md:py-2'>
      <div>
        {/* Header */}
        <div className='mb-3 px-2 flex items-center justify-between font-semibold text-sm tracking-tight text-foreground max-md:hidden'>
          <span>Storage</span>
          <button
            onClick={onToggle}
            aria-label='Toggle Storage Sidebar'
            className='p-1 hidden rounded-md cursor-pointer text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring'
          >
            <PanelLeftClose className='size-4 text-foreground shrink-0' />
          </button>
        </div>

        {/* Storage Navigation */}
        <LayoutGroup id={`storage-nav-${id}`}>
          <nav
            aria-label='Storage Navigation'
            className='flex flex-col gap-1 max-md:flex-row max-md:overflow-x-auto'
          >
            {storageItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  href={item.to}
                  key={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex h-8 items-center gap-1.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none max-md:shrink-0',
                    isActive
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground hover:bg-muted font-normal'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId={`storage-nav-active-${id}`}
                      className='absolute inset-0 rounded-md bg-muted'
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <item.icon
                    className='relative z-10 size-4 shrink-0 text-foreground'
                  />
                  <span className='relative z-10 min-w-0 truncate tracking-tight'>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
      </div>
    </aside>
  );
}
