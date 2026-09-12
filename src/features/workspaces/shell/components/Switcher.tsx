'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Settings,
  Plus,
  Search,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { resolveFileUrl } from "@/shared/lib/file-client";
import { cn } from "@/shared/lib/utils";
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { CreateProjectModal } from '@/features/workspaces/projects/shell/components/project/CreateProjectModal';
import { ProjectAvatar } from '@/shared/components/icon-picker/ProjectAvatar';
import type { Workspace } from '../types/workspace.types';

interface SwitcherProps {
  currentItem: Workspace | null;
  items?: Workspace[];
  activeId: string;
}

export default function Switcher({
  currentItem,
  activeId,
}: SwitcherProps) {
  const router = useRouter();
  const params = useParams<{ workspaceId?: string; projectId?: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const workspaceId = activeId || params?.workspaceId || currentItem?.url || '';
  const { projects = [] } = useProjects(workspaceId);

  const activeProjectId = params?.projectId;
  const currentProject = useMemo(() => {
    if (!activeProjectId || !projects.length) return null;
    return projects.find((p) => p.id === activeProjectId || p.identifier === activeProjectId) || null;
  }, [activeProjectId, projects]);

  const nonArchivedProjects = useMemo(() => {
    return projects.filter((p) => !p.isArchived);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return nonArchivedProjects;
    const q = searchQuery.toLowerCase().trim();
    return nonArchivedProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.identifier && p.identifier.toLowerCase().includes(q))
    );
  }, [nonArchivedProjects, searchQuery]);

  const displayName = currentItem?.name || 'Flux';

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          aria-label={currentProject ? `Project: ${currentProject.name}` : `Workspace: ${displayName}`}
          className='group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors hover:bg-background/80 data-[state=open]:bg-background/90'
        >
          {/* Workspace Avatar */}
          <Avatar className='size-5 rounded-md font-semibold shrink-0'>
            {currentItem?.avatar ? (
              <AvatarImage
                src={resolveFileUrl(currentItem.avatar) || undefined}
                alt={String(displayName)}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-10 font-semibold">
              {String(displayName).substring(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Breadcrumb: Workspace Name [/ Project Name] */}
          <span className='max-w-[120px] truncate text-13 font-semibold tracking-tight text-foreground'>
            {displayName}
          </span>

          {currentProject && (
            <>
              <span className='text-muted-foreground text-12 select-none'>/</span>
              <div className='flex items-center gap-1.5 min-w-0'>
                <ProjectAvatar avatar={currentProject.avatar} name={currentProject.name} size="xs" />
                <span className='max-w-[120px] truncate text-13 font-medium text-foreground'>
                  {currentProject.name}
                </span>
              </div>
            </>
          )}

          {isOpen ? (
            <ChevronUp className='size-3.5 text-muted-foreground transition-colors shrink-0' strokeWidth={1.5} />
          ) : (
            <ChevronDown className='size-3.5 text-muted-foreground transition-colors shrink-0' strokeWidth={1.5} />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align='start'
          onCloseAutoFocus={(e) => e.preventDefault()}
          className='w-72 p-1 rounded-lg overflow-hidden bg-popover border border-border '
          sideOffset={6}
        >
          {/* ── Context Header ─────────────────────────── */}
          <div className='flex items-center justify-between px-2.5 py-2 select-none bg-muted/40 rounded-md mb-1'>
            <div className='flex items-center gap-2 min-w-0'>
              <Avatar className='size-6 rounded-md shrink-0'>
                {currentItem?.avatar ? (
                  <AvatarImage
                    src={resolveFileUrl(currentItem.avatar) || undefined}
                    alt={String(displayName)}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-10 font-medium">
                  {String(displayName).substring(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col min-w-0'>
                <span className='text-12 font-semibold text-foreground truncate'>
                  {displayName}
                </span>
                <span className='text-10 text-muted-foreground truncate'>Research Projects</span>
              </div>
            </div>

            <button
              type='button'
              title='Settings'
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                router.push('/settings');
              }}
              className='size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer'
            >
              <Settings className='size-3.5 shrink-0' />
            </button>
          </div>

          <DropdownMenuSeparator className='my-1' />

          {/* ── Projects Section Header & Search ─────────────────── */}
          <div className='flex items-center justify-between px-2.5 pt-1.5 pb-1 text-11 font-medium text-muted-foreground select-none'>
            <span>Projects</span>
            <span className='font-mono text-11'>{nonArchivedProjects.length}</span>
          </div>

          {nonArchivedProjects.length > 4 && (
            <div className='px-1.5 py-1'>
              <div className='relative flex items-center'>
                <Search className='size-3 shrink-0 absolute left-2 text-muted-foreground pointer-events-none' />
                <input
                  type='text'
                  placeholder='Filter projects...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full h-7 pl-6 pr-2 text-11 bg-muted border border-border/50 focus:border-border rounded-md outline-none placeholder:text-muted-foreground text-foreground'
                />
              </div>
            </div>
          )}

          {/* ── Projects List ─────────────────────────────────────── */}
          <div className='max-h-56 overflow-y-auto space-y-0.5 py-0.5'>
            {filteredProjects.length === 0 ? (
              <div className='px-3 py-3 text-center text-xs text-muted-foreground'>
                {searchQuery ? 'No matching projects' : 'No projects yet'}
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const isActive = proj.id === activeProjectId || proj.identifier === activeProjectId;
                return (
                  <DropdownMenuItem
                    key={proj.id}
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/projects/${proj.id}`);
                    }}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors outline-none',
                      isActive
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-foreground/80 hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <div className='flex items-center gap-2 min-w-0'>
                      <ProjectAvatar avatar={proj.avatar} name={proj.name} size="xs" />
                      <span className='truncate max-w-[160px] text-12 font-medium'>{proj.name}</span>
                      {proj.identifier && (
                        <span className='text-10 font-mono text-muted-foreground shrink-0'>
                          {proj.identifier}
                        </span>
                      )}
                    </div>
                    {isActive && <Check className='size-3.5 text-primary shrink-0' />}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          <DropdownMenuSeparator className='my-1' />

          {/* ── Action: Create Project ─────────────────────────── */}
          <div className='p-0.5'>
            <DropdownMenuItem
              onClick={() => {
                setIsOpen(false);
                setIsCreateProjectOpen(true);
              }}
              className='flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs font-medium text-foreground hover:bg-muted transition-colors outline-none'
            >
              <Plus className='size-3.5 text-foreground shrink-0' />
              <span>Create project</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Create Project Modal ─────────────────────────────────── */}
      <CreateProjectModal
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        onSuccess={(newProject) => {
          setIsCreateProjectOpen(false);
          if (newProject?.id) {
            router.push(`/projects/${newProject.id}`);
          }
        }}
      />
    </>
  );
}
