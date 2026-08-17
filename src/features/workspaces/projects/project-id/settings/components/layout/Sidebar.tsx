'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Settings,
  Users,
  LayoutGrid,
  RefreshCcw,
  Tag,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { useProjectDetails, useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth';
import { cn } from '@/shared/lib/utils';
import Switcher from './Switcher';

// ── Types ──────────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  exact?: boolean;
  aliases?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const params = useParams() as { workspaceId: string; projectId: string };
  const pathname = usePathname();
  const { workspaceId, projectId } = params;

  const { user } = useAuth();
  const { data: projectData } = useProjectDetails(projectId);
  const project = (projectData as any)?.project || projectData;
  const { projects = [] } = useProjects(workspaceId);

  // User role within this project
  const userMember = project?.members?.find(
    (m: any) =>
      m.userId === user?.id ||
      m.userId === (user as any)?._id ||
      m.user?.id === user?.id ||
      m.user?._id === (user as any)?._id,
  );
  const role =
    project?.createdById === user?.id || project?.createdById === (user as any)?._id
      ? 'Admin'
      : userMember?.role === 'owner'
        ? 'Owner'
        : userMember?.role === 'admin'
          ? 'Admin'
          : userMember?.role === 'viewer'
            ? 'Viewer'
            : 'Admin';

  const base = `/${workspaceId}/projects/${projectId}/settings`;

  const navGroups: NavGroup[] = [
    {
      title: 'General',
      items: [
        { id: 'general', label: 'General', icon: Settings, to: base, exact: true },
        { id: 'members', label: 'Members', icon: Users, to: `${base}/members`, aliases: [`${base}/team`] },
        { id: 'worklogs', label: 'Worklogs', icon: Clock, to: `${base}/worklogs` },
      ],
    },
    {
      title: 'Features',
      items: [
        { id: 'modules', label: 'Modules', icon: LayoutGrid, to: `${base}/modules` },
        { id: 'cycles', label: 'Cycles', icon: RefreshCcw, to: `${base}/cycles` },
        { id: 'labels', label: 'Labels', icon: Tag, to: `${base}/labels` },
      ],
    },
  ];

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.to || pathname === `${item.to}/general`;
    return (
      pathname.startsWith(item.to) ||
      (item.aliases?.some((a) => pathname.startsWith(a)) ?? false)
    );
  };

  return (
    <aside className="h-full w-60 shrink-0 overflow-x-hidden border-r border-border bg-transparent p-2 py-4 select-none">
      {/* Back */}
      <div className="mb-1 px-2">
        <Link
          href={`/${workspaceId}/projects/${projectId}/overview`}
          className="group flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground hover:bg-accent/70 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span>Project settings</span>
        </Link>
      </div>

      {/* Project Switcher */}
      <Switcher
        currentProject={project}
        projects={projects}
        workspaceId={workspaceId}
        currentProjectId={projectId}
        role={role}
      />

      {/* Nav groups */}
      <div className="mt-2 flex flex-col gap-4">
        {navGroups.map((group) => (
          <GroupSection key={group.title} group={group} isItemActive={isItemActive} />
        ))}
      </div>
    </aside>
  );
}

// ── GroupSection ──────────────────────────────────────────────────────────────

function GroupSection({
  group,
  isItemActive,
}: {
  group: NavGroup;
  isItemActive: (item: NavItem) => boolean;
}) {
  return (
    <div>
      <div className="px-2.5 pb-1 pt-0.5 text-[11px] font-medium text-muted-foreground/60 select-none">
        {group.title}
      </div>
      <nav className="flex flex-col gap-0.5">
        {group.items.map((item) => {
          const active = isItemActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.to}
              className={cn(
                'group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                active
                  ? 'bg-accent text-foreground font-semibold'
                  : 'text-foreground/80 font-medium hover:bg-accent/70 hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0 transition-colors" />
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
