'use client';

import { useRouter, useParams } from 'next/navigation';
import { Mail, Search } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useWorkspaces } from '../hooks/use-workspace';
import AccountDropdown from './AccountDropdown';
import Switcher from './Switcher';

export default function Topbar() {
  const { user, isLoading } = useAuth();
  const params = useParams<{ workspaceId?: string }>();
  const rawWorkspaceId = params?.workspaceId && params.workspaceId !== 'undefined' ? params.workspaceId : null;

  const { workspaces } = useWorkspaces();
  const currentWorkspace = workspaces.find((w) => w.url === rawWorkspaceId) ?? workspaces[0] ?? null;
  const workspaceId = rawWorkspaceId ?? currentWorkspace?.url ?? '';

  return (
    <nav
      aria-label='Workspace Header Navigation'
      className='flex h-11 w-full shrink-0 items-center justify-between gap-4 bg-transparent px-4'
    >
      {/* Left: Workspace & Project breadcrumb */}
      <div className='flex items-center gap-2 min-w-0 shrink-0'>
        <Switcher
          currentItem={currentWorkspace}
          items={workspaces}
          activeId={workspaceId}
        />
      </div>

      {/* Center: Search placeholder */}
      <div className='flex flex-1 items-center justify-center max-w-sm px-2'>
        <button className='flex h-7 w-full items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent'>
          <Search className='size-3.5 text-muted-foreground/70' />
          <span className='text-xs text-muted-foreground/80'>Search...</span>
        </button>
      </div>

      {/* Right: Inbox + User menu */}
      <div className='flex items-center gap-2 shrink-0'>
        <button
          type='button'
          className='flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          title='Inbox'
        >
          <Mail className='size-4' />
        </button>

        {!isLoading && user && workspaceId && (
          <AccountDropdown workspaceId={workspaceId} />
        )}
      </div>
    </nav>
  );
}
