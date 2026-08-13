'use client';

import { useEffect, useState, useId } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight, Cloud, Home, KanbanSquare, PanelLeftClose,
  PenLine, Pin, Plus, Settings, StickyNote, Layers2,
  RotateCcw, ChartBarBig, UserStar, BookMarked, type LucideIcon,
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/shared/components/ui';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/shared/components/ui';
import { useProjects } from '@/features/workspaces/projects/shell/services/project.services';
import type { Project } from '@/features/workspaces/projects/shell';
import CreateProject from './create-project';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProjectModuleKey =
  | 'overview' | 'tasks' | 'cycles' | 'drafts'
  | 'storage' | 'stickies' | 'collection' | 'settings';

const MODULE_ORDER: ProjectModuleKey[] = [
  'overview', 'drafts', 'tasks', 'cycles',
  'storage', 'collection', 'stickies', 'settings',
];

const modulesConfig: Record<ProjectModuleKey, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Overview', icon: ChartBarBig },
  drafts: { label: 'Drafts', icon: PenLine },
  tasks: { label: 'Tasks', icon: KanbanSquare },
  cycles: { label: 'Cycles', icon: RotateCcw },
  storage: { label: 'Storage', icon: Cloud },
  collection: { label: 'Collection', icon: BookMarked },
  stickies: { label: 'Notes', icon: StickyNote },
  settings: { label: 'Settings', icon: Settings },
};

// ── Sidebar items ─────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  exact?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();

  const navItems: NavItem[] = [
    { label: 'Home', icon: Home, to: `/${workspaceId}`, exact: true },
    { label: 'Your Work', icon: UserStar, to: `/${workspaceId}/your-work`, exact: false },
    { label: 'All Drafts', icon: PenLine, to: `/${workspaceId}/drafts`, exact: false },
    { label: 'Stickies', icon: Layers2, to: `/${workspaceId}/stickies`, exact: false },
  ];

  const { projects }: { projects?: Project[]; isLoading: boolean } = useProjects(workspaceId);

  // ── Expanded projects (persisted) ──────────────────────────────────────────

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_expanded_projects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem('sidebar_expanded_projects', JSON.stringify(Array.from(expandedProjects)));
  }, [expandedProjects]);

  // Auto-expand active project on navigation
  useEffect(() => {
    const active = projects?.find((p) => pathname.includes(`/projects/${p._id}`));
    if (!active) return;
    setExpandedProjects((prev) => prev.has(active._id) ? prev : new Set(prev).add(active._id));
  }, [pathname, projects]);

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.to || pathname === item.to + '/';
    return pathname === item.to || pathname.startsWith(item.to + '/');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <aside className='h-full w-60 overflow-x-hidden border-r border-border bg-card p-2 py-4'>
      {/* Header */}
      <div className='mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground'>
        <span>Projects</span>
        <button
          onClick={onToggle}
          className='rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden'
        >
          <PanelLeftClose className='size-5' />
        </button>
      </div>

      {/* Nav items */}
      <LayoutGroup id={`sb-nav-${id}`}>
        <nav className='flex flex-col gap-1'>
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                href={item.to}
                key={item.label}
                className='group relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent/70'
              >
                {active && (
                  <motion.div
                    layoutId={`sb-nav-active-${id}`}
                    className='absolute inset-0 rounded-md bg-accent'
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon className={`relative z-10 size-4 shrink-0 transition-colors ${active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span className={`relative z-10 min-w-0 truncate text-sm transition-colors ${active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground group-hover:text-foreground'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>

      {/* Projects section */}
      <nav className='mt-4 select-none'>
        <span className='ml-2 flex items-center justify-between gap-1 text-sm font-semibold text-muted-foreground'>
          Projects
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className='p-1 rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'>
                <Plus className='size-4' />
              </button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-xl'>
              <DialogHeader>
                <DialogTitle className='text-xl font-semibold'>New Project</DialogTitle>
              </DialogHeader>
              <CreateProject onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </span>

        <div className='flex flex-col mt-2 gap-1'>
          {projects && projects.length === 0 && (
            <p className='ml-2 text-xs font-medium text-muted-foreground/50'>No projects found</p>
          )}
          {(projects ?? []).map((project) => {
            const isOpen = expandedProjects.has(project._id);
            const projectModules = project.modules ?? [];
            return (
              <Collapsible
                className='w-full group'
                key={project._id}
                open={isOpen}
                onOpenChange={() => toggleProject(project._id)}
              >
                <div className='flex h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 transition-colors hover:bg-accent/70'>
                  <CollapsibleTrigger asChild>
                    <Link
                      href={`/${workspaceId}/projects/${project._id}/overview`}
                      className='flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm font-medium text-foreground transition-colors hover:text-foreground'
                    >
                      <span className='shrink-0 text-base leading-none'>{project.avatar}</span>
                      <span className='min-w-0 truncate'>{project.name}</span>
                    </Link>
                  </CollapsibleTrigger>
                  <CollapsibleTrigger asChild>
                    <button className='rounded-md p-1 hover:bg-accent'>
                      <ChevronRight className='size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90' />
                    </button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className='overflow-hidden space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up'>
                  {MODULE_ORDER.filter((k) => projectModules.includes(k)).map((moduleKey) => {
                    const mod = modulesConfig[moduleKey];
                    if (!mod) return null;
                    const link = `/${workspaceId}/projects/${project._id}/${moduleKey}`;
                    const modActive = pathname === link || pathname.startsWith(link + '/');
                    return (
                      <Link
                        href={link}
                        key={moduleKey}
                        className={`group flex h-9 items-center gap-2 rounded-md pl-8 pr-2.5 text-sm transition-colors ${modActive ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground font-medium hover:bg-accent/70 hover:text-foreground'}`}
                      >
                        <mod.icon className={`size-4 shrink-0 transition-colors ${modActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                        <span className='min-w-0 truncate'>{mod.label}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </nav>

      {/* Pinned (reserved) */}
      <nav className='hidden gap-2 flex-col pt-4 border-t border-secondary mt-4'>
        <div className='flex gap-1 justify-between text-muted-foreground font-semibold items-center ml-2 text-sm'>
          <span>Pinned</span>
          <Pin className='size-4' />
        </div>
        <p className='text-xs ml-2 font-medium text-muted-foreground/50'>Nothing here</p>
      </nav>
    </aside>
  );
}
