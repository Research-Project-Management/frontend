'use client';

import { usePathname } from 'next/navigation';
import { Tag, User, SlidersHorizontal, Blocks, Bell, Lock } from 'lucide-react';
import React, { useId } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { cn } from "@/shared/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  to: string;
}

export function SideBar() {
  const pathname = usePathname();
  const id = useId();

  const navItems: NavItem[] = [
    { label: 'Profile', icon: User, to: '/settings' },
    { label: 'Preferences', icon: SlidersHorizontal, to: '/settings/preferences' },
    { label: 'Integrations', icon: Blocks, to: '/settings/integrations' },
    { label: 'Notifications', icon: Bell, to: '/settings/notifications' },
    { label: 'Security', icon: Lock, to: '/settings/security' },
    { label: 'Labels', icon: Tag, to: '/settings/labels' },
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
        title={item.label}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group/item relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors duration-150 outline-none select-none max-md:shrink-0',
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
          strokeWidth={1.5}
        />
        <span className="relative z-10 min-w-0 truncate flex-1 tracking-tight">
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <aside
      aria-label="Settings navigation"
      className="h-full w-60 shrink-0 border-r border-border bg-background md:bg-transparent flex flex-col select-none max-md:w-full max-md:border-r-0 max-md:border-b"
    >
      <div className="flex-1 min-h-0 flex flex-col p-2.5 pt-4 pb-1 overflow-hidden">
        {/* Header */}
        <div className="mb-3 px-2 flex items-center justify-between font-semibold tracking-tight text-foreground select-none">
          <span className="truncate min-w-0 font-semibold text-16 tracking-tight text-foreground">
            Settings
          </span>
        </div>

        {/* Navigation Links */}
        <LayoutGroup id={`settings-nav-${id}`}>
          <nav
            aria-label="Settings Navigation"
            className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-0.5 pr-1 max-md:flex-row max-md:overflow-x-auto"
          >
            {navItems.map(renderItem)}
          </nav>
        </LayoutGroup>
      </div>
    </aside>
  );
}

export default SideBar;
