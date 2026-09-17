'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  LogOut,
  Check,
  Settings,
  UserPlus,
  Mail,
  Copy,
  CheckCheck,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@/shared/components/ui';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { CreateProjectModal } from '@/features/projects/shell/components/project/CreateProjectModal';
import { ProjectAvatar } from '@/shared/components/icon-picker/ProjectAvatar';
import { ProjectInvitesModal } from '@/features/projects/invitation/components/ProjectInvitesModal';
import { useMyProjectInvitations } from '@/features/projects/invitation/hooks/use-project-invitations';

export interface DisplayProjectItem {
  id: string;
  name: string;
  identifier?: string;
  avatar?: string | null;
  role: 'Owner' | 'Contributor' | 'Reviewer' | 'Viewer' | 'Member';
  membersCount: number;
}

const STORAGE_KEY_ACTIVE_PROJECT = 'flux_active_project_id';

export interface SwitcherProps {
  className?: string;
  // Legacy optional props for backward compatibility
  currentItem?: unknown;
  items?: unknown[];
  activeId?: string;
}

function formatProjectRole(
  role?: string | null,
): DisplayProjectItem['role'] | null {
  if (!role) return null;
  switch (String(role).toLowerCase()) {
    case 'owner':
      return 'Owner';
    case 'contributor':
      return 'Contributor';
    case 'commenter':
      return 'Reviewer';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Member';
  }
}

function resolveMemberRole(
  project: any,
  userId?: string,
): 'Owner' | 'Contributor' | 'Reviewer' | 'Viewer' | 'Member' {
  if (!userId) return 'Member';
  if (project.createdById === userId) return 'Owner';

  const member = project.members?.find((m: any) => m.userId === userId);
  if (!member?.role) return 'Member';

  switch (String(member.role).toLowerCase()) {
    case 'owner':
      return 'Owner';
    case 'contributor':
      return 'Contributor';
    case 'commenter':
      return 'Reviewer';
    case 'viewer':
      return 'Viewer';
    default:
      return 'Member';
  }
}

export function Switcher({
  className,
}: SwitcherProps = {}) {
  const router = useRouter();
  const params = useParams<{ projectId?: string }>();
  const { user, logout } = useAuth();
  const { projects = [] } = useProjects();
  const { data: pendingInvitations = [] } = useMyProjectInvitations();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isProjectInvitesOpen, setIsProjectInvitesOpen] = useState(false);

  // Invite states
  const [inviteEmail, setInviteEmail] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Active Project ID state from localStorage
  const [storedActiveId, setStoredActiveId] = useState<string>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);
      if (stored) {
        setStoredActiveId(stored);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Map API projects into unified display items
  const combinedProjects = useMemo<DisplayProjectItem[]>(() => {
    if (!projects || projects.length === 0) return [];
    const nonArchived = projects.filter((p) => !p.isArchived);
    return nonArchived.map((p) => ({
      id: p.id,
      name: p.name,
      identifier: p.identifier,
      avatar: p.avatar,
      role: formatProjectRole(p.yourRole) || resolveMemberRole(p, user?.id),
      membersCount: p.members?.length || 1,
    }));
  }, [projects, user?.id]);

  // Determine current active project
  const activeProjectId = params?.projectId;
  const activeProject = useMemo<DisplayProjectItem | null>(() => {
    if (!combinedProjects.length) return null;
    if (activeProjectId) {
      const found = combinedProjects.find(
        (p) => p.id === activeProjectId || p.identifier === activeProjectId
      );
      if (found) return found;
    }
    if (storedActiveId) {
      const found = combinedProjects.find((p) => p.id === storedActiveId);
      if (found) return found;
    }
    return combinedProjects[0] ?? null;
  }, [combinedProjects, activeProjectId, storedActiveId]);

  const otherProjects = useMemo(() => {
    if (!activeProject) return combinedProjects;
    return combinedProjects.filter((p) => p.id !== activeProject.id);
  }, [combinedProjects, activeProject]);

  const handleSelectProject = (proj: DisplayProjectItem) => {
    setStoredActiveId(proj.id);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, proj.id);
    } catch {}
    setIsOpen(false);
    router.push(`/projects/${proj.id}`);
  };

  const handleCopyInviteLink = () => {
    if (!activeProject) return;
    const link = typeof window !== 'undefined' ? `${window.location.origin}/invite/${activeProject.identifier || activeProject.id}` : '';
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          aria-label={activeProject ? `Project: ${activeProject.name}` : 'Projects'}
          className='group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors hover:bg-muted data-[state=open]:bg-muted'
        >
          {/* Project Avatar */}
          {activeProject ? (
            <div className="relative flex items-center justify-center shrink-0">
              <ProjectAvatar
                avatar={activeProject.avatar}
                name={activeProject.name}
                id={activeProject.id}
                size='xs'
                className='size-5.5 rounded-md'
              />
              {pendingInvitations.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </div>
          ) : null}

          {/* Project Name */}
          <span className='max-w-[150px] truncate text-13 font-semibold tracking-tight text-foreground'>
            {activeProject ? activeProject.name : 'Projects'}
          </span>

          {isOpen ? (
            <ChevronUp className='size-3.5 text-muted-foreground transition-colors shrink-0' strokeWidth={1.5} />
          ) : (
            <ChevronDown className='size-3.5 text-muted-foreground transition-colors shrink-0' strokeWidth={1.5} />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align='start'
          onCloseAutoFocus={(e) => e.preventDefault()}
          className='w-[310px] p-0 rounded-lg overflow-hidden bg-popover border border-border shadow-raised-200 select-none'
          sideOffset={8}
        >
          {/* User Email Header */}
          <div className='px-4 pt-3.5 pb-2.5 text-xs font-normal text-muted-foreground bg-background truncate'>
            {user?.email || 'Personal Account'}
          </div>

          {/* Current Active Project Card */}
          {activeProject ? (
            <div className='bg-muted px-4 py-3.5 border-b border-border/60'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3 min-w-0'>
                  <ProjectAvatar
                    avatar={activeProject.avatar}
                    name={activeProject.name}
                    id={activeProject.id}
                    size='lg'
                    className='size-9 rounded-md'
                  />
                  <div className='flex flex-col min-w-0'>
                    <span className='text-sm font-semibold text-foreground tracking-tight truncate'>
                      {activeProject.name}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {activeProject.role}
                    </span>
                  </div>
                </div>
                <Check className='size-4 text-foreground shrink-0' strokeWidth={1.75} />
              </div>

              {/* Settings & Invite Members Buttons */}
              <div className='flex items-center gap-2 mt-3.5'>
                <button
                  type='button'
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/projects/${activeProject.id}/settings`);
                  }}
                  className='h-8 flex-1 px-2.5 bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-xs rounded-md border border-border text-foreground transition-colors cursor-pointer flex items-center justify-center gap-1.5 outline-none shadow-none'
                >
                  <Settings className='size-3.5 text-foreground shrink-0' />
                  <span>Settings</span>
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/projects/${activeProject.id}/settings/members`);
                  }}
                  className='h-8 flex-1 px-2.5 bg-background hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium text-xs rounded-md border border-border text-foreground transition-colors cursor-pointer flex items-center justify-center gap-1.5 outline-none shadow-none'
                >
                  <UserPlus className='size-3.5 text-foreground shrink-0' />
                  <span>Invite members</span>
                </button>
              </div>
            </div>
          ) : (
            <div className='bg-muted/50 px-4 py-3 text-xs text-muted-foreground border-b border-border/60'>
              No projects yet. Create a project to start collaborating.
            </div>
          )}

          {/* Other Projects List */}
          {otherProjects.length > 0 && (
            <div className='max-h-[260px] overflow-y-auto bg-background flex flex-col border-b border-border/60 py-1 thin-scrollbar'>
              {otherProjects.map((proj) => (
                <button
                  key={proj.id}
                  type='button'
                  onClick={() => handleSelectProject(proj)}
                  className='w-full px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-colors text-left outline-none'
                >
                  <div className='flex items-center gap-3 min-w-0'>
                    <ProjectAvatar
                      avatar={proj.avatar}
                      name={proj.name}
                      id={proj.id}
                      size='md'
                      className='size-8 rounded-md'
                    />
                    <div className='flex flex-col min-w-0'>
                      <span className='text-sm font-medium text-foreground truncate'>{proj.name}</span>
                      <span className='text-xs text-muted-foreground truncate'>
                        {proj.membersCount || 1} {proj.membersCount === 1 ? 'Member' : 'Members'}
                      </span>
                    </div>
                  </div>
                  <span className='text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/40 shrink-0 capitalize'>
                    {proj.role}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className='p-1.5 bg-background space-y-0.5'>
            <button
              type='button'
              onClick={() => {
                setIsOpen(false);
                setIsCreateProjectOpen(true);
              }}
              className='flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm font-medium text-foreground hover:bg-muted/60 transition-colors w-full text-left outline-none'
            >
              <PlusCircle className='size-4 text-foreground shrink-0' />
              <span>Create project</span>
            </button>

            <button
              type='button'
              onClick={() => {
                setIsOpen(false);
                setIsProjectInvitesOpen(true);
              }}
              className='flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm font-medium text-foreground hover:bg-muted/60 transition-colors w-full text-left outline-none'
            >
              <div className='flex items-center gap-3 min-w-0'>
                <Mail className='size-4 text-foreground shrink-0' />
                <span>Project invites</span>
              </div>
              {pendingInvitations.length > 0 && (
                <span className='px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-10 font-semibold leading-none'>
                  {pendingInvitations.length}
                </span>
              )}
            </button>

            <button
              type='button'
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className='flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full text-left outline-none'
            >
              <LogOut className='size-4 text-destructive shrink-0' />
              <span className='text-destructive'>Sign out</span>
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Create Project Modal ─────────────────────────────────── */}
      <CreateProjectModal
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        onSuccess={(newProj) => {
          setIsCreateProjectOpen(false);
          if (newProj?.id) {
            router.push(`/projects/${newProj.id}`);
          }
        }}
      />

      {/* ── Invite Members Modal (Fallback / Direct Share) ─────────── */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className='sm:max-w-[500px] p-6 rounded-lg bg-background border border-border shadow-raised-200'>
          <DialogHeader>
            <DialogTitle>Invite members to {activeProject ? activeProject.name : 'Project'}</DialogTitle>
            <DialogDescription>
              Invite collaborators to join your project.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 pt-2'>
            <div className='space-y-2'>
              <Label htmlFor='invite-email'>Email address</Label>
              <div className='flex gap-2'>
                <Input
                  id='invite-email'
                  type='email'
                  placeholder='colleague@example.com'
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  autoFocus
                />
                <Button
                  type='button'
                  disabled={!inviteEmail.trim() || !inviteEmail.includes('@')}
                  onClick={() => {
                    setInviteEmail('');
                    setIsInviteOpen(false);
                  }}
                >
                  Send invite
                </Button>
              </div>
            </div>

            <div className='relative my-2'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t border-border' />
              </div>
              <div className='relative flex justify-center text-xs'>
                <span className='bg-background px-2 text-muted-foreground'>Or share link</span>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Input
                readOnly
                value={activeProject && typeof window !== 'undefined' ? `${window.location.origin}/invite/${activeProject.identifier || activeProject.id}` : ''}
                className='text-xs font-mono bg-muted/50'
              />
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={handleCopyInviteLink}
                className='shrink-0'
                title='Copy link'
              >
                {isCopied ? <CheckCheck className='size-4 text-green-600' /> : <Copy className='size-4' />}
              </Button>
            </div>
          </div>
          <DialogFooter className='pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsInviteOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Project Invites Modal ─────────────────────────────────── */}
      <ProjectInvitesModal
        open={isProjectInvitesOpen}
        onOpenChange={setIsProjectInvitesOpen}
      />
    </>
  );
}

export const ProjectSwitcher = Switcher;
export default Switcher;
