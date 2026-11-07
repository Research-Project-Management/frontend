'use client';

import React, { useState, useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  Check,
  Settings,
  UserPlus,
  PlusCircle,
  Mail,
  LogOut,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';
import { ProjectAvatar } from '@/shared/components/icons';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { useMyProjectInvitations } from '@/features/projects/invitation/hooks/use-project-invitations';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useWorkspaceContextStore } from '../store/workspace-context.store';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { cn } from '@/shared/lib/utils';
import type { Project } from '@/features/projects/shell/types/project.types';

const CreateProjectModal = dynamic(
  () =>
    import('@/features/projects/shell/components/project/CreateProjectModal').then(
      (m) => m.CreateProjectModal
    ),
  { ssr: false }
);

const ProjectInvitesModal = dynamic(
  () =>
    import('@/features/projects/invitation/components/ProjectInvitesModal').then(
      (m) => m.ProjectInvitesModal
    ),
  { ssr: false }
);

const AVATAR_PALETTE = [
  'bg-[#B45309] text-white', // Warm Amber / Brown (Plane style)
  'bg-[#0969DA] text-white', // Primer Blue
  'bg-[#1A7F37] text-white', // Forest Green
  'bg-[#8250DF] text-white', // Purple
  'bg-[#CF222E] text-white', // Crimson
  'bg-[#0E7490] text-white', // Cyan
];

function getInitialAvatarColor(seed: string): string {
  if (!seed) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function SpaceSquareIcon({
  name,
  avatar,
  id,
  size = 'sm',
}: {
  name: string;
  avatar?: string | null;
  id?: string;
  size?: 'sm' | 'md';
}) {
  const initial = (name?.trim()?.[0] || 'P').toUpperCase();
  const colorClass = getInitialAvatarColor(id || name);
  const sizeClass = size === 'md' ? 'size-8 rounded-md text-13' : 'size-5 rounded-[5px] text-11';

  if (avatar && avatar.trim()) {
    return (
      <ProjectAvatar
        avatar={avatar}
        name={name}
        id={id || name}
        size={size === 'md' ? 'md' : 'xs'}
        className={cn(size === 'md' ? 'size-8 rounded-md' : 'size-5 rounded-[5px]')}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold select-none leading-none',
        sizeClass,
        colorClass
      )}
    >
      {initial}
    </div>
  );
}

function formatRoleLabel(role?: string): string {
  if (!role) return 'Owner';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export default function SpaceSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const { user, logout } = useAuth();
  const { projects = [] } = useProjects();
  const { data: invitations = [] } = useMyProjectInvitations();

  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);
  const setPersonalSpace = useWorkspaceContextStore((s) => s.setPersonalSpace);
  const setProjectSpace = useWorkspaceContextStore((s) => s.setProjectSpace);
  const setLibraryScope = useLibraryUIStore((s) => s.setActiveScope);

  const [open, setOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isProjectInvitesOpen, setIsProjectInvitesOpen] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.isArchived),
    [projects]
  );

  // Sync URL [projectId] param with WorkspaceContextStore
  React.useEffect(() => {
    const urlProjectId = params?.projectId;
    if (urlProjectId) {
      const matched = projects.find((p) => p.id === urlProjectId);
      if (
        activeSpace.type !== 'project' ||
        activeSpace.projectId !== urlProjectId ||
        (matched && activeSpace.projectName !== matched.name)
      ) {
        setProjectSpace({
          id: urlProjectId,
          name: matched?.name || activeSpace.projectName || 'Project',
          avatar: matched?.avatar ?? activeSpace.projectAvatar ?? null,
        });
      }
    }
  }, [
    params?.projectId,
    projects,
    activeSpace.type,
    activeSpace.projectId,
    activeSpace.projectName,
    activeSpace.projectAvatar,
    setProjectSpace,
  ]);

  const personalDisplayName = useMemo(() => {
    if (user?.name && user.name.trim()) return user.name.trim();
    if (user?.email) return user.email.split('@')[0];
    return 'Personal';
  }, [user?.name, user?.email]);

  const currentProject: Project | null = useMemo(() => {
    if (activeSpace.type !== 'project' || !activeSpace.projectId) return null;
    return (
      projects.find((p) => p.id === activeSpace.projectId) ||
      ({
        id: activeSpace.projectId,
        name: activeSpace.projectName || 'Project',
        avatar: activeSpace.projectAvatar ?? undefined,
        members: [],
      } as unknown as Project)
    );
  }, [activeSpace, projects]);

  const isPersonal = activeSpace.type === 'personal';

  const handleSelectPersonal = () => {
    setOpen(false);
    setPersonalSpace();
    setLibraryScope({
      type: 'user',
      id: 'user',
      name: 'My Library',
    });

    if (pathname?.startsWith('/projects/')) {
      if (pathname.includes('/settings')) {
        router.push('/settings');
      } else if (pathname.includes('/pages')) {
        router.push('/pages');
      } else {
        router.push('/home');
      }
    }
  };

  const handleSelectProject = (proj: {
    id: string;
    name: string;
    avatar?: string | null;
  }) => {
    setOpen(false);
    setProjectSpace(proj);
    setLibraryScope({
      type: 'project',
      id: proj.id,
      projectId: proj.id,
      name: proj.name,
    });

    if (!pathname) {
      router.push(`/projects/${proj.id}/overview`);
      return;
    }

    if (
      pathname.startsWith('/library') ||
      pathname.startsWith('/experiments') ||
      pathname.startsWith('/ai') ||
      pathname.startsWith('/home') ||
      pathname.startsWith('/your-work') ||
      pathname.startsWith('/drafts') ||
      pathname.startsWith('/stickies')
    ) {
      return;
    }
    if (pathname.startsWith('/settings') || pathname.includes('/settings')) {
      router.push(`/projects/${proj.id}/settings`);
      return;
    }
    if (pathname.startsWith('/pages') || pathname.includes('/pages')) {
      router.push(`/projects/${proj.id}/pages`);
      return;
    }
    if (pathname.startsWith('/projects/') && params?.projectId) {
      const nextPath = pathname.replace(
        `/projects/${params.projectId}`,
        `/projects/${proj.id}`
      );
      router.push(nextPath);
      return;
    }

    router.push(`/projects/${proj.id}/overview`);
  };

  const activeTitle = isPersonal
    ? personalDisplayName
    : currentProject?.name || 'Project';

  const activeSubtitle = isPersonal
    ? 'Owner · Personal'
    : `${formatRoleLabel(currentProject?.yourRole)} · ${Math.max(1, currentProject?.members?.length || 1)} Member${(currentProject?.members?.length || 1) > 1 ? 's' : ''}`;

  const settingsHref = isPersonal
    ? '/settings'
    : `/projects/${currentProject?.id}/settings`;

  const membersHref = isPersonal
    ? '/settings'
    : `/projects/${currentProject?.id}/settings/members`;

  return (
    <>
      {isCreateProjectOpen && (
        <CreateProjectModal
          open={isCreateProjectOpen}
          onOpenChange={setIsCreateProjectOpen}
          onSuccess={(newProj) => {
            setIsCreateProjectOpen(false);
            if (newProj?.id) {
              handleSelectProject({
                id: newProj.id,
                name: newProj.name || 'New Project',
                avatar: newProj.avatar ?? null,
              });
            }
          }}
        />
      )}

      {isProjectInvitesOpen && (
        <ProjectInvitesModal
          open={isProjectInvitesOpen}
          onOpenChange={setIsProjectInvitesOpen}
        />
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Switch space"
            className={cn(
              'group flex h-8 items-center gap-2 rounded-md px-2 text-13 font-medium text-foreground transition-colors hover:bg-background/80 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none max-w-[200px]',
              open && 'bg-background shadow-2xs border border-border/60'
            )}
          >
            <SpaceSquareIcon
              name={activeTitle}
              avatar={isPersonal ? null : currentProject?.avatar}
              id={isPersonal ? user?.id || 'personal' : currentProject?.id}
              size="sm"
            />

            <span className="truncate text-13 font-medium tracking-tight text-foreground">
              {activeTitle}
            </span>

            <ChevronDown
              className={cn(
                'size-3.5 text-muted-foreground transition-transform duration-150 shrink-0',
                open && 'rotate-180 text-foreground'
              )}
              strokeWidth={1.75}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-72 p-0 border border-border bg-popover text-popover-foreground rounded-lg shadow-raised-200 select-none z-50 overflow-hidden"
        >
          {/* ── 1. Active Space Header Card (Plane.so style) ── */}
          <div className="p-2">
            <div className="rounded-md bg-muted/60 p-2.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <SpaceSquareIcon
                  name={activeTitle}
                  avatar={isPersonal ? null : currentProject?.avatar}
                  id={isPersonal ? user?.id || 'personal' : currentProject?.id}
                  size="md"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-13 font-semibold text-foreground leading-tight">
                    {activeTitle}
                  </span>
                  <span className="truncate text-11 text-muted-foreground leading-tight mt-0.5">
                    {activeSubtitle}
                  </span>
                </div>
                <Check className="size-4 text-foreground shrink-0" strokeWidth={1.75} />
              </div>

              {/* Action Pills: Settings & Invite members */}
              <div className="flex items-center gap-1.5">
                <Link
                  href={settingsHref}
                  onClick={() => setOpen(false)}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-12 font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Settings className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Settings</span>
                </Link>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (isPersonal) {
                    setIsProjectInvitesOpen(true);
                  } else if (currentProject?.id) {
                    router.push(`/projects/${currentProject.id}/settings/members`);
                  }
                }}
                className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-12 font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <UserPlus className="size-3.5 text-muted-foreground shrink-0" />
                <span>Invite members</span>
              </button>
              </div>
            </div>
          </div>

          {/* ── 2. Other Spaces List (Personal + Projects) ── */}
          <div className="max-h-60 overflow-y-auto px-2 pb-2 space-y-0.5">
            {/* Show Personal Space in list if currently inside a Project */}
            {!isPersonal && (
              <button
                type="button"
                onClick={handleSelectPersonal}
                className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-left outline-none"
              >
                <SpaceSquareIcon
                  name={personalDisplayName}
                  id={user?.id || 'personal'}
                  size="md"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-13 font-medium text-foreground leading-tight">
                    {personalDisplayName}
                  </span>
                  <span className="truncate text-11 text-muted-foreground leading-tight mt-0.5">
                    Personal Space
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-sm bg-muted text-muted-foreground text-11 font-medium shrink-0">
                  Private
                </span>
              </button>
            )}

            {/* Project Spaces List */}
            {activeProjects
              .filter((p) => isPersonal || p.id !== currentProject?.id)
              .map((proj) => {
                const memberCount = Math.max(1, proj.members?.length || 1);
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() =>
                      handleSelectProject({
                        id: proj.id,
                        name: proj.name,
                        avatar: proj.avatar,
                      })
                    }
                    className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer text-left outline-none"
                  >
                    <SpaceSquareIcon
                      name={proj.name}
                      avatar={proj.avatar}
                      id={proj.id}
                      size="md"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate text-13 font-medium text-foreground leading-tight">
                        {proj.name}
                      </span>
                      <span className="truncate text-11 text-muted-foreground leading-tight mt-0.5">
                        {memberCount} Member{memberCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-sm bg-muted text-muted-foreground text-11 font-medium shrink-0">
                      Free
                    </span>
                  </button>
                );
              })}
          </div>

          {/* ── 3. Footer Actions (Create project & Invites) ── */}
          <div className="border-t border-border p-1.5 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setIsCreateProjectOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal text-foreground hover:bg-muted transition-colors cursor-pointer text-left outline-none"
            >
              <PlusCircle className="size-4 text-muted-foreground shrink-0" />
              <span>Create project</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setIsProjectInvitesOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal text-foreground hover:bg-muted transition-colors cursor-pointer text-left outline-none"
            >
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <span>Project invites</span>
              {invitations.length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-10 font-semibold leading-none">
                  {invitations.length}
                </span>
              )}
            </button>
          </div>

          {/* ── 4. Sign Out Row (Plane.so style) ── */}
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-md text-13 font-normal text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left outline-none"
            >
              <LogOut className="size-4 text-destructive shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
