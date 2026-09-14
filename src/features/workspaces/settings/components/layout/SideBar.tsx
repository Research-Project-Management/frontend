'use client';

import { usePathname } from 'next/navigation';
import { Puzzle, Tag, User, SlidersHorizontal, Bell, Lock } from 'lucide-react';
import React, { useId } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { cn } from "@/shared/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}

export function SideBar() {
  const pathname = usePathname();
  const id = useId();

  const accountItems: NavItem[] = [
    { label: 'Profile', icon: User, to: '/settings' },
    { label: 'Preferences', icon: SlidersHorizontal, to: '/settings/preferences' },
    { label: 'Notifications', icon: Bell, to: '/settings/notifications' },
    { label: 'Security', icon: Lock, to: '/settings/security' },
  ];

  const systemItems: NavItem[] = [
    { label: 'Labels', icon: Tag, to: '/settings/labels' },
    { label: 'Integrations', icon: Puzzle, to: '/settings/integrations' },
  ];

  const renderItem = (item: NavItem) => {
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
  };

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
          className="flex flex-col gap-4 max-md:flex-row max-md:overflow-x-auto"
        >
          <div>
            <div className="px-2 pb-1.5 pt-0.5 text-11 font-medium text-muted-foreground select-none max-md:hidden">
              Account
            </div>
            <div className="flex flex-col gap-0.5 max-md:flex-row">
              {accountItems.map(renderItem)}
            </div>
          </div>

          <div>
            <div className="px-2 pb-1.5 pt-0.5 text-11 font-medium text-muted-foreground select-none max-md:hidden">
              System
            </div>
            <div className="flex flex-col gap-0.5 max-md:flex-row">
              {systemItems.map(renderItem)}
            </div>
          </div>
        </nav>
      </LayoutGroup>
    </aside>
  );
}

export default SideBar;
