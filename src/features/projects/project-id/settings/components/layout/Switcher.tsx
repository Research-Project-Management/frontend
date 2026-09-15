'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search, ChevronsUpDown, X } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { useClickOutside, useHotkeys } from "@/shared/hooks";
import { ProjectAvatar } from "@/shared/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SwitcherProps {
  currentProject: any;
  projects: any[];
  currentProjectId: string;
}

// ── Switcher ──────────────────────────────────────────────────────────────────

export default function Switcher({
  currentProject,
  projects,
  currentProjectId,
}: SwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useClickOutside(ref, () => setOpen(false), { enabled: open });

  // Close on Escape
  useHotkeys('escape', () => {
    if (open) setOpen(false);
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
    router.push(`/projects/${project.id}/settings`);
  };

  return (
    <div ref={ref} className="relative px-1 mb-1">
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors cursor-pointer border border-border/70 bg-card hover:bg-muted',
          open && 'bg-muted border-border',
        )}
      >
        <ProjectAvatar
          avatar={currentProject?.avatar}
          name={currentProject?.name}
          id={currentProject?.id}
          size="sm"
        />
        <span className="flex-1 min-w-0 text-left font-medium text-xs text-foreground truncate">
          {currentProject?.name ?? 'Select project…'}
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground shrink-0" />
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          className={cn(
            'absolute left-1 right-1 top-full z-50 mt-1.5',
            'rounded-md border border-border bg-popover text-popover-foreground shadow-md',
            'animate-in fade-in-0 zoom-in-95 duration-100',
            'flex flex-col overflow-hidden',
          )}
          style={{ maxHeight: '340px' }}
        >
          {/* Search box */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 bg-background">
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
                className="text-foreground cursor-pointer"
              >
                <X className="size-3 shrink-0" />
              </button>
            )}
          </div>

          {/* Project List */}
          <div className="overflow-y-auto p-1 space-y-0.5 max-h-56">
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
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer',
                      isCurrent
                        ? 'bg-muted font-medium text-foreground'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <ProjectAvatar
                      avatar={proj?.avatar}
                      name={proj?.name}
                      id={proj?.id}
                      size="xs"
                    />
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
