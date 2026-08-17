'use client';

import { useParams, usePathname } from 'next/navigation';
import { Settings, Users } from 'lucide-react';
import React, { useId } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';

export function SideBar() {
  const params = useParams();
  const rawId = params?.workspaceId;
  const workspaceId = rawId && rawId !== 'undefined' ? rawId : '';
  const pathname = usePathname();
  const id = useId();

  const basePath = `/${workspaceId}/settings`;

  const sidebarItems = [
    { label: 'General', icon: Settings, to: basePath },
    { label: 'Members', icon: Users, to: `${basePath}/members` },
  ];

  return (
    <aside className="h-full w-52 shrink-0 border-r border-border/40 bg-transparent p-2 py-4 max-md:w-full max-md:border-r-0 max-md:border-b max-md:py-2">
      {/* Header */}
      <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 max-md:hidden">
        Settings
      </div>

      {/* Navigation */}
      <LayoutGroup id={`settings-nav-${id}`}>
        <nav
          aria-label="Settings Navigation"
          className="flex flex-col gap-0.5 max-md:flex-row max-md:overflow-x-auto"
        >
          {sidebarItems.map((item) => {
            const isActive =
              pathname === item.to ||
              (item.to !== basePath && pathname.startsWith(item.to + '/'));
            return (
              <Link
                href={item.to}
                key={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group/item relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors outline-none max-md:shrink-0 text-foreground hover:bg-black/5 dark:hover:bg-white/5',
                  isActive ? 'font-semibold' : 'font-medium',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId={`settings-nav-active-${id}`}
                    className="absolute inset-0 rounded-md bg-accent/80 shadow-2xs"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon className="relative z-10 size-4 shrink-0 text-foreground transition-colors" />
                <span
                  className={cn(
                    'relative z-10 min-w-0 truncate text-sm transition-colors text-foreground',
                    isActive ? 'font-semibold' : 'font-medium',
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

export default SideBar;
