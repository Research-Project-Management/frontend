'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Search, FolderOpen, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useClickOutside } from '@/shared/hooks/use-click-outside';
import { useHotkeys } from '@/shared/hooks/use-hotkeys';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SwitcherProps {
  currentProject: any;
  projects: any[];
  workspaceId: string;
  currentProjectId: string;
  role?: string;
}

// ── Avatar helper ─────────────────────────────────────────────────────────────

function ProjectAvatar({ project, size = 'md' }: { project: any; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'size-5 text-sm' : 'size-7 text-base';
  return (
    <div className={cn('flex items-center justify-center rounded-md shrink-0 overflow-hidden', dim)}>
      {project?.avatar ? (
        project.avatar.startsWith('http') || project.avatar.startsWith('/') ? (
          <img src={project.avatar} alt="" className="size-full object-cover" />
        ) : (
          <span className="leading-none">{project.avatar}</span>
        )
      ) : (
        <span className="leading-none">📁</span>
      )}
    </div>
  );
}

// ── Switcher ──────────────────────────────────────────────────────────────────

export default function Switcher({
  currentProject,
  projects,
  workspaceId,
  currentProjectId,
  role,
}: SwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useClickOutside(ref, () => setOpen(false), { enabled: open });

  // Close on Escape
  useHotkeys('escape', () => setOpen(false), {
    enabled: open,
    enableOnFormTags: true,
  });

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  // Always include the current project — even if the projects list hasn't loaded yet
  const allProjects = React.useMemo(() => {
    if (!currentProject?.id) return projects;
    const exists = projects.some((p) => p.id === currentProject.id);
    return exists ? projects : [currentProject, ...projects];
  }, [projects, currentProject]);

  const filtered = allProjects.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (project: any) => {
    setOpen(false);
    router.push(`/${workspaceId}/projects/${project.id}/settings`);
  };

  return (
    <div ref={ref} className="relative px-2 mb-1">
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors cursor-pointer',
          open ? 'bg-accent' : 'hover:bg-accent/70',
        )}
      >
        <ProjectAvatar project={currentProject} size="sm" />
        <span className="flex-1 min-w-0 text-left font-medium text-xs text-foreground truncate">
          {currentProject?.name ?? 'Select project…'}
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground shrink-0" />
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          className={cn(
            'absolute left-2 right-2 top-full z-50 mt-1.5',
            'rounded-xl border border-border bg-popover text-popover-foreground shadow-xl',
            'animate-in fade-in-0 zoom-in-95 duration-100',
            'flex flex-col overflow-hidden',
          )}
          style={{ maxHeight: '340px' }}
        >
          {/* Search box */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Project List */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-56">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-center">
                <span className="text-xs text-muted-foreground">
                  {search ? 'No projects found' : 'No projects yet'}
                </span>
              </div>
            ) : (
              filtered.map((proj) => {
                const isCurrent = proj.id === currentProjectId;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleSelect(proj)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer',
                      isCurrent
                        ? 'bg-accent font-semibold text-foreground'
                        : 'hover:bg-accent/60 font-medium text-foreground',
                    )}
                  >
                    <ProjectAvatar project={proj} size="sm" />
                    <span className="flex-1 min-w-0 truncate text-left">{proj.name}</span>
                    {isCurrent && <Check className="size-3.5 shrink-0 text-foreground" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
