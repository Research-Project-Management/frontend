'use client';

import React from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  Settings,
  Users,
  Clock,
  LayoutGrid,
  RefreshCcw,
  Tag,
} from 'lucide-react';
import Sidebar from '@/features/workspaces/projects/project-id/settings/components/layout/Sidebar';

// ── Route → Header metadata ───────────────────────────────────────────────────

const ROUTE_MAP: { match: (p: string) => boolean; title: string; icon: React.ElementType }[] = [
  { match: (p) => p.includes('/settings/members') || p.includes('/settings/team'), title: 'Members', icon: Users },
  { match: (p) => p.includes('/settings/worklogs'), title: 'Worklogs', icon: Clock },
  { match: (p) => p.includes('/settings/modules'), title: 'Modules', icon: LayoutGrid },
  { match: (p) => p.includes('/settings/cycles'), title: 'Cycles', icon: RefreshCcw },
  { match: (p) => p.includes('/settings/labels'), title: 'Labels', icon: Tag },
];

function getHeaderInfo(pathname: string) {
  const match = ROUTE_MAP.find((r) => r.match(pathname));
  return match ?? { title: 'General', icon: Settings };
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function ProjectSettingLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { title, icon: HeaderIcon } = getHeaderInfo(pathname);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Right Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-2.5 px-7 h-12 border-b border-border/50 shrink-0">
          <HeaderIcon className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        </header>

        {/* Body */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
