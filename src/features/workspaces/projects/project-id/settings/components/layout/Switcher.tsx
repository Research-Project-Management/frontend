'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check, Search, FolderOpen } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

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
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
    if (!currentProject?._id) return projects;
    const exists = projects.some((p) => p._id === currentProject._id);
    return exists ? projects : [currentProject, ...projects];
  }, [projects, currentProject]);

  const filtered = allProjects.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (project: any) => {
    setOpen(false);
    router.push(`/${workspaceId}/projects/${project._id}/settings`);
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
        {/* Big avatar */}
        <ProjectAvatar project={currentProject} size="md" />

        {/* Name + role */}
        <div className="flex flex-col min-w-0 flex-1 text-left">
          <span className="text-sm font-semibold text-foreground truncate leading-tight">
            {currentProject?.name || 'Project'}
          </span>
          {role && (
            <span className="text-xs text-muted-foreground leading-tight">{role}</span>
          )}
        </div>

        {/* Chevron — hidden by default, visible on hover or when open */}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-all duration-150',
            open
              ? 'opacity-100 rotate-180'
              : 'opacity-0 group-hover:opacity-100 rotate-0',
          )}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-lg border border-border bg-popover shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search */}
          <div className="p-1.5 border-b border-border/40">
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 h-8">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-1.5">
                <FolderOpen className="size-5 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">
                  {search ? 'No projects found' : 'No projects yet'}
                </span>
              </div>
            ) : (
              filtered.map((proj) => {
                const isCurrent = proj._id === currentProjectId;
                return (
                  <button
                    key={proj._id}
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
