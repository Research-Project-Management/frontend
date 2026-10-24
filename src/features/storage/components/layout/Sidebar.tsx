'use client';

import Link from 'next/link';
import {
  Home,
  Folder,
  Users,
  Star,
  Trash,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

import { useStorageUIStore, buildStorageUrl, type StorageSection } from '../../store/storage-ui.store';

export default function Sidebar() {
  const activeSection = useStorageUIStore((s) => s.activeSection);
  const navigateToSection = useStorageUIStore((s) => s.navigateToSection);

  // Storage-specific navigation
  const storageItems: { label: string; icon: React.ComponentType<{ className?: string }>; section: StorageSection }[] = [
    { label: 'Home', icon: Home, section: 'home' },
    { label: 'All Files', icon: Folder, section: 'my-files' },
    { label: 'Shared', icon: Users, section: 'shared' },
    { label: 'Starred', icon: Star, section: 'starred' },
    { label: 'Trash', icon: Trash, section: 'trash' },
  ];

  return (
    <aside className="hidden md:flex h-full w-60 shrink-0 flex-col justify-between overflow-x-hidden border-r border-border bg-transparent p-2.5 py-4 select-none">
      <div className="w-full">
        {/* Header (Desktop) */}
        <div className="mb-3 px-2 flex items-center justify-between font-semibold text-sm tracking-tight text-foreground max-md:hidden">
          <span>Storage</span>
        </div>

        {/* Storage Navigation */}
        <nav
          aria-label="Storage Navigation"
          className="flex flex-col gap-1 max-md:flex-row max-md:overflow-x-auto max-md:no-scrollbar max-md:py-0.5 max-md:gap-1.5"
        >
          {storageItems.map((item) => {
            const isActive = activeSection === item.section;
            const href = buildStorageUrl(item.section);
            return (
              <Link
                href={href}
                key={item.label}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToSection(item.section);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex h-8 items-center gap-2 rounded-md px-2.5 text-13 leading-5 outline-none max-md:shrink-0 max-md:h-8 max-md:px-3 max-md:rounded-full cursor-pointer',
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <item.icon
                  className="relative z-10 size-4 shrink-0 text-foreground"
                />
                <span className="relative z-10 min-w-0 truncate tracking-tight text-xs sm:text-13">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
