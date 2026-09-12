'use client';

import React from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  Settings,
  Users,
  LayoutGrid,
  Sparkles,
  RefreshCcw,
  Tag,
  Layers,
  Download,
  SlidersHorizontal,
} from 'lucide-react';
import Sidebar from '@/features/workspaces/projects/project-id/settings/components/layout/Sidebar';
import { ProjectTopbarSwitcher } from '@/features/workspaces/projects/project-id/components/layout';

// ── Route → Header metadata ───────────────────────────────────────────────────

const ROUTE_MAP: { match: (p: string) => boolean; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { match: (p) => p.includes('/settings/members'), title: 'Members', icon: Users },
  { match: (p) => p.includes('/settings/modules'), title: 'Modules', icon: LayoutGrid },
  { match: (p) => p.includes('/settings/ai'), title: 'AI', icon: Sparkles },
  { match: (p) => p.includes('/settings/cycles'), title: 'Cycles', icon: RefreshCcw },
  { match: (p) => p.includes('/settings/states'), title: 'States', icon: Layers },
  { match: (p) => p.includes('/settings/labels'), title: 'Labels', icon: Tag },
  { match: (p) => p.includes('/settings/views'), title: 'Saved Views', icon: SlidersHorizontal },
  { match: (p) => p.includes('/settings/export'), title: 'Export', icon: Download },
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
        <header className="h-11 px-6 flex items-center justify-between border-b border-border bg-background shrink-0 select-none sticky top-0 z-10">
          <ProjectTopbarSwitcher
            moduleTitle={title}
            moduleIcon={HeaderIcon}
          />
        </header>

        {/* Body */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
