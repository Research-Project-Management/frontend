'use client';

import { usePathname } from 'next/navigation';
import { Puzzle, Tag } from 'lucide-react';
import { BuildingOfficeIcon } from '../icons/BuildingOfficeIcon';
import React, { useId } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { cn } from "@/shared/lib/utils";

export function SideBar() {
  const pathname = usePathname();
  const id = useId();

  const sidebarItems = [
    { label: 'General', icon: BuildingOfficeIcon, to: '/settings' },
    { label: 'Labels', icon: Tag, to: '/settings/labels' },
    { label: 'Integrations', icon: Puzzle, to: '/settings/integrations' },
  ];

  return (
    <aside className="h-full w-60 shrink-0 border-r border-border bg-transparent p-2.5 py-4 select-none max-md:w-full max-md:border-r-0 max-md:border-b max-md:py-2">
      {/* Header */}
      <div className="mb-3 px-2 flex items-center justify-between font-semibold text-sm tracking-tight text-foreground max-md:hidden">
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
              item.to === '/settings'
                ? pathname === '/settings'
                : pathname === item.to || pathname.startsWith(item.to + '/');

            return (
              <Link
                href={item.to}
                key={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex h-8 items-center gap-2 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none max-md:shrink-0',
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId={`settings-nav-active-${id}`}
                    className="absolute inset-0 rounded-md bg-muted"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon
                  className="relative z-10 size-4 shrink-0 text-foreground"
                />
                <span className="relative z-10 min-w-0 truncate tracking-tight">
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
