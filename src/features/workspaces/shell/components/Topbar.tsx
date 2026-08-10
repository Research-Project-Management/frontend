'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, PlusCircle, LayoutGrid, User, LogOut, Mail, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { logoutUser, useAuth } from '@/features/auth';
import { useWorkspaces } from '../hooks/use-workspace';
import { useParams } from 'next/navigation';
import Avatar from './Avatar';

export default function Topbar() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
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
        {currentWorkspace && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Current Workspace: ${currentWorkspace.name}`}
                className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors hover:bg-accent'
              >
                <Avatar
                  src={currentWorkspace.avatar}
                  name={currentWorkspace.name}
                  className='size-6 rounded-md font-bold'
                  fallbackType='workspace'
                />
                <span className='max-w-[140px] truncate text-sm font-medium text-foreground sm:max-w-[180px]'>
                  {currentWorkspace.name}
                </span>
                <ChevronDown className='size-3.5 text-muted-foreground/70' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-56'>
              <DropdownMenuLabel className='text-xs text-muted-foreground'>
                Actions
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push('/create-workspace')}>
                <PlusCircle className='mr-2 size-4' /> Create Workspace
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/manage-workspace')}>
                <LayoutGrid className='mr-2 size-4' /> Manage Workspaces
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className='text-xs text-muted-foreground'>
                Switch
              </DropdownMenuLabel>
              {workspaces.map((ws: any) => (
                <DropdownMenuItem
                  key={ws._id}
                  onClick={() => router.push(`/${ws.url}`)}
                  className={ws.url === workspaceId ? 'bg-muted' : ''}
                >
                  <Avatar
                    src={ws.avatar}
                    name={ws.name}
                    className='mr-2 size-5 rounded-sm'
                    fallbackType='workspace'
                  />
                  <span className='truncate'>{ws.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}


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

        {!isLoading && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='relative size-7 overflow-hidden rounded-full cursor-pointer ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/20 outline-none'>
                <Avatar
                  src={user.avatar}
                  name={user.name!}
                  className='size-full rounded-full'
                  fallbackType='user'
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuLabel>
                <div className='flex flex-col space-y-1'>
                  <p className='text-sm font-medium leading-none'>{user.name}</p>
                  <p className='text-xs leading-none text-muted-foreground'>{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  workspaceId && router.push(`/${workspaceId}/settings/profile`)
                }
              >
                <User className='mr-2 h-4 w-4' />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logoutUser} variant='destructive'>
                <LogOut className='mr-2 h-4 w-4' />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
