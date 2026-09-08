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
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { useProjectDetails, useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';
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
      m.user?.id === user?.id,
  );
  const role =
    project?.createdById === user?.id
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
        { id: 'statuses', label: 'Statuses', icon: Layers, to: `${base}/statuses` },
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
    <aside className="h-full w-60 shrink-0 overflow-x-hidden border-r border-border bg-transparent p-2 py-4 select-none sidebar-scrollbar">
      {/* Back */}
      <div className="mb-2 px-1">
        <Link
          href={`/${workspaceId}/projects/${projectId}/overview`}
          className="group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] leading-5 font-normal text-foreground hover:bg-muted/70 transition-colors"
        >
          <ArrowLeft className="size-4 shrink-0 text-foreground transition-transform group-hover:-translate-x-0.5" />
          <span className="tracking-tight">Project settings</span>
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
      <div className="mt-3 flex flex-col gap-3.5">
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
      <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium text-muted-foreground select-none">
        {group.title}
      </div>
      <nav className="flex flex-col gap-1">
        {group.items.map((item) => {
          const active = isItemActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.to}
              className={cn(
                'group flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] leading-5 transition-colors outline-none',
                active
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-foreground hover:bg-muted/70 font-normal',
              )}
            >
              <Icon
                className="size-4 shrink-0 text-foreground"
              />
              <span className="min-w-0 truncate tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
