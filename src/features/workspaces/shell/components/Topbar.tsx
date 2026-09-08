'use client';

import { useRouter, useParams } from 'next/navigation';
import { Mail, Search } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useWorkspaces } from '../hooks/use-workspace';
import AccountDropdown from './AccountDropdown';
import Switcher from './Switcher';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

import type { Workspace } from '@/features/setup/types/workspace.types';

export default function Topbar() {
  const { user, isLoading } = useAuth();
  const params = useParams<{ workspaceId?: string }>();
  const rawWorkspaceId = params?.workspaceId && params.workspaceId !== 'undefined' ? params.workspaceId : null;

  const { workspaces = [] } = useWorkspaces();
  const currentWorkspace: Workspace | null =
    workspaces.find(
      (w: Workspace) =>
        w.url === rawWorkspaceId ||
        w.id === rawWorkspaceId ||
        (w as any).slug === rawWorkspaceId,
    ) ??
    workspaces[0] ??
    null;


  const workspaceId = rawWorkspaceId ?? currentWorkspace?.url ?? '';

  return (
    <nav
      aria-label='Workspace Header Navigation'
      className='flex h-12 w-full shrink-0 items-center justify-between gap-4 bg-transparent px-2 select-none'
    >
      {/* Left: Workspace & Project breadcrumb */}
      <div className='flex items-center gap-2 min-w-0 shrink-0'>
        <Switcher
          currentItem={currentWorkspace}
          items={workspaces}
          activeId={workspaceId}
        />
      </div>

      {/* Center: Search placeholder (clean without shortcut keys) */}
      <div className='flex flex-1 items-center justify-center max-w-sm px-2'>
        <button
          type='button'
          className='group flex h-8 w-full items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 text-[13px] text-muted-foreground shadow-none transition-colors hover:border-foreground/20 hover:bg-accent/50 hover:text-foreground cursor-pointer outline-none'
        >
          <Search className='size-3.5 text-foreground/80 group-hover:text-foreground transition-colors shrink-0' />
          <span className='text-[13px] text-muted-foreground group-hover:text-foreground transition-colors truncate'>Search...</span>
        </button>
      </div>

      {/* Right: Inbox + User menu */}
      <div className='flex items-center gap-2 shrink-0'>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                className='group flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent/60 cursor-pointer outline-none'
                aria-label='Inbox'
              >
                <Mail className='size-4 text-foreground' />
              </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' sideOffset={6}>
              Inbox
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <AccountDropdown workspaceId={workspaceId} />
      </div>
    </nav>
  );
}
