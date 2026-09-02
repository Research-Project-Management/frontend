'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Home,
  Folder,
  Users,
  Star,
  Trash,
  PanelLeftClose,
  Cloud,
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
    { label: 'All Files', icon: Folder, to: `${basePath}/my-files` },
    { label: 'Shared', icon: Users, to: `${basePath}/shared` },
    { label: 'Starred', icon: Star, to: `${basePath}/starred` },
    { label: 'Trash', icon: Trash, to: `${basePath}/trash` },
  ];

  return (
    <aside className='h-full w-60 flex flex-col justify-between overflow-x-hidden border-r border-border/50 bg-transparent p-2 py-4 max-md:w-full max-md:border-r-0 max-md:border-b max-md:py-2'>
      <div>
        {/* Header */}
        <div className='mb-4 px-2.5 flex items-center justify-between font-bold text-base tracking-tight text-foreground max-md:hidden'>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <Cloud className="size-3.5" />
            </div>
            <span>Storage</span>
          </div>
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
              const isActive = pathname === item.to || (item.to !== basePath && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  href={item.to}
                  key={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group/item relative flex h-9.5 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-accent/60 outline-none focus-visible:ring-1 focus-visible:ring-ring max-md:shrink-0 text-foreground',
                    isActive ? 'font-semibold text-primary' : 'font-medium text-muted-foreground hover:text-foreground'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId={`storage-nav-active-${id}`}
                      className='absolute inset-0 rounded-lg bg-accent'
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "relative z-10 size-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover/item:text-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      'relative z-10 min-w-0 truncate',
                      isActive ? 'font-semibold text-foreground' : 'font-medium'
                    )}
                  >
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
