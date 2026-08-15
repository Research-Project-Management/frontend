'use client';

import React, { useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import {
  ChevronRight,
  Search,
  Check,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react';
import { useProjects } from '@/features/workspaces/projects/shell/services/project.services';
import type { Project } from '@/features/workspaces/projects/shell/services/project.services';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

export interface TopbarProps {
  project?: {
    name: string;
    avatar?: string;
  };
  title: string;
  Icon: LucideIcon;
  centerContent?: React.ReactNode;
  titleExtra?: React.ReactNode;
  actions?: React.ReactNode;
  onTitleClick?: () => void;
  count?: number;
}

function ProjectAvatar({ avatar, name }: { avatar?: string; name: string }) {
  if (!avatar) {
    return (
      <div className="size-5 flex items-center justify-center rounded-sm bg-amber-100/50">
        <FolderKanban className="size-3.5 text-amber-600" />
      </div>
    );
  }

  const isUrl =
    avatar.startsWith('http') ||
    avatar.startsWith('/') ||
    avatar.startsWith('data:');

  if (isUrl) {
    return (
      <div className="size-5 shrink-0 overflow-hidden rounded-sm border border-border/50">
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <span className="text-sm leading-none shrink-0" title={name}>
      {avatar}
    </span>
  );
}

export function Topbar({
  project,
  title,
  Icon,
  centerContent,
  titleExtra,
  actions,
  onTitleClick,
  count,
}: TopbarProps) {
  const { workspaceId, projectId } = useParams() as { workspaceId: string; projectId: string };
  const router = useRouter();
  const pathname = usePathname();
  const { projects = [] } = useProjects(workspaceId);
  const [searchValue, setSearchValue] = useState('');

  const currentModule = (() => {
    const segments = pathname.split('/');
    const projectIndex = segments.findIndex((s) => s === 'projects');
    if (projectIndex !== -1 && segments.length > projectIndex + 2) {
      return segments[projectIndex + 2] ?? 'tasks';
    }
    return 'tasks';
  })();

  const filteredProjects = projects.filter((p: Project) =>
    p.name.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const handleProjectClick = (proj: Project) => {
    if (proj._id === projectId) return;
    router.push(`/${workspaceId}/projects/${proj._id}/${currentModule || 'tasks'}`);
  };

  return (
    <header
      className="flex items-center px-4 h-13 bg-background border-b border-border sticky top-0 z-50 shrink-0 gap-0"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center min-w-0 flex-1">
        {project && (
          <div className="flex items-center">
            <DropdownMenu onOpenChange={() => setSearchValue('')}>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-all group">
                  <ProjectAvatar avatar={project.avatar} name={project.name} />
                  <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                    {project.name}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-60 p-0 rounded-md border border-border bg-popover shadow-xl z-50 overflow-hidden"
              >
                <div className="p-2 border-b border-border bg-muted/20">
                  <div className="relative flex items-center h-8 rounded-md border border-border bg-background overflow-hidden">
                    <Search className="absolute left-2.5 size-3.5 text-foreground" />
                    <Input
                      autoFocus
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Search projects..."
                      className="h-full text-sm py-0 border-none bg-transparent focus-visible:ring-0 shadow-none pl-8 text-foreground"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredProjects.map((proj: Project) => {
                    const isActive = proj._id === projectId;
                    return (
                      <DropdownMenuItem
                        key={proj._id}
                        onClick={() => handleProjectClick(proj)}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer outline-none transition-colors',
                          isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <span className="shrink-0 w-4 flex items-center justify-center">
                          <ProjectAvatar avatar={proj.avatar} name={proj.name} />
                        </span>
                        <span className="truncate flex-1 text-foreground">{proj.name}</span>
                        {isActive && <Check className="size-3.5 text-foreground" />}
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <ChevronRight className="size-3.5 text-foreground/40 mx-0.5" />
          </div>
        )}

        <div
          onClick={onTitleClick}
          className={cn(
            'flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all ml-1',
            onTitleClick ? 'hover:bg-muted cursor-pointer' : '',
          )}
        >
          <Icon className="size-4 text-foreground shrink-0 mt-[1px]" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight whitespace-nowrap">
            {title}
          </h1>
          {count !== undefined && !titleExtra && (
            <div className="ml-1.5 px-1.5 py-0.5 rounded-sm bg-muted text-foreground text-[11px] font-medium leading-none min-w-[18px] flex items-center justify-center border border-border">
              {count}
            </div>
          )}
        </div>

        {titleExtra}
      </div>

      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10">
        <div className="pointer-events-auto flex items-center h-full">
          {centerContent}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 min-w-0 flex-1">
        {actions}
      </div>
    </header>
  );
}

export default Topbar;
