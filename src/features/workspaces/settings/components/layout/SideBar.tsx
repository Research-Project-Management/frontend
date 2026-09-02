'use client';

import { useParams, usePathname } from 'next/navigation';
import { Users } from 'lucide-react';
import { BuildingOfficeIcon } from '../icons/BuildingOfficeIcon';
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
    { label: 'General', icon: BuildingOfficeIcon, to: basePath },
    { label: 'Members', icon: Users, to: `${basePath}/members` },
  ];

  return (
    <aside className="h-full w-60 shrink-0 border-r border-border bg-transparent p-2 py-4 select-none max-md:w-full max-md:border-r-0 max-md:border-b max-md:py-2">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground max-md:hidden">
        <span>Settings</span>
      </div>

      {/* Navigation */}
      <LayoutGroup id={`settings-nav-${id}`}>
        <nav
          aria-label="Settings Navigation"
          className="flex flex-col gap-1 max-md:flex-row max-md:overflow-x-auto"
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
                  'group/item relative flex h-9.5 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors outline-none max-md:shrink-0 text-foreground hover:bg-accent/70',
                  isActive ? 'font-semibold' : 'font-medium',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId={`settings-nav-active-${id}`}
                    className="absolute inset-0 rounded-md bg-accent"
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
