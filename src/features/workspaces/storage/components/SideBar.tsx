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

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId, projectId } = useParams();
  const pathname = usePathname();
  const id = useId();

  // Determine if we're in project or workspace context
  const basePath = projectId
    ? `/${workspaceId}/projects/${projectId}/storage`
    : `/${workspaceId}/storage`;

  // Storage-specific navigation
  const storageItems = [
    { label: 'Home', icon: Home, to: basePath },
    { label: 'My Drive', icon: File, to: `${basePath}/my-files` },
    { label: 'Shared', icon: Users, to: `${basePath}/shared` },
    { label: 'Starred', icon: Star, to: `${basePath}/starred` },
    { label: 'Trash', icon: Trash, to: `${basePath}/trash` },
  ];

  return (
    <aside className='h-full w-60 overflow-x-hidden border-r border-border bg-card p-2 py-4 max-md:w-full max-md:border-r-0 max-md:border-b max-md:py-2'>
      {/* Header */}
      <div className='mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground max-md:hidden'>
        <span>Storage</span>
        <button
          onClick={onToggle}
          aria-label='Toggle Storage Sidebar'
          className='p-1 hidden rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring'
        >
          <PanelLeftClose className='size-5' />
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
                  'group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent/70 outline-none focus-visible:ring-1 focus-visible:ring-ring max-md:shrink-0',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId={`storage-nav-active-${id}`}
                    className='absolute inset-0 rounded-md bg-accent'
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon
                  className={cn(
                    'relative z-10 size-4 shrink-0',
                    isActive ? 'text-foreground' : 'text-muted-foreground group-hover/item:text-foreground'
                  )}
                />
                <span
                  className={cn(
                    'relative z-10 min-w-0 truncate',
                    isActive
                      ? 'font-semibold text-foreground'
                      : 'font-medium text-muted-foreground group-hover/item:text-foreground'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>
    </aside>
  );
}
