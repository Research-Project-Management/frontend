'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, PlusCircle, LogOut, Check, Settings, UserPlus, Mails } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { resolveFileUrl } from '@/shared/utils/url';

import type { Workspace } from '@/features/setup/types/workspace.types';

interface SwitcherProps {
  currentItem: Workspace | null;
  items: Workspace[];
  activeId: string;
}

export default function Switcher({
  currentItem,
  items,
  activeId,
}: SwitcherProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentItem) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        aria-label={`Current Item: ${currentItem.name}`}
        className='group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 outline-none transition-colors hover:bg-accent/60 data-[state=open]:bg-accent/80'
      >
        <Avatar className='size-5.5 rounded-md font-semibold'>
          {currentItem.avatar ? (
            <AvatarImage
              src={resolveFileUrl(currentItem.avatar) || undefined}
              alt={String(currentItem.name)}
              referrerPolicy="no-referrer"
            />
          ) : null}
          <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-[11px] font-semibold">
            {String(currentItem.name).substring(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className='max-w-[140px] truncate text-[13px] font-semibold tracking-tight text-foreground sm:max-w-[180px]'>
          {currentItem.name}
        </span>
        {isOpen ? (
          <ChevronUp className='size-3.5 text-foreground transition-colors' strokeWidth={2} />
        ) : (
          <ChevronDown className='size-3.5 text-foreground transition-colors' strokeWidth={2} />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align='start'
        onCloseAutoFocus={(e) => e.preventDefault()}
        className='w-[300px] p-0 rounded-lg overflow-hidden bg-popover border border-border shadow-none'
        sideOffset={8}
      >
        {/* User email header */}
        <div className='px-4 pt-3.5 pb-2.5 text-xs font-medium text-muted-foreground bg-background select-none truncate'>
          {user?.email || 'user@example.com'}
        </div>

        {/* Current active workspace */}
        <div className='bg-muted/70 px-4 py-3.5 border-b border-border/50'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3 min-w-0'>
              <Avatar className='size-9 rounded-md font-medium shrink-0'>
                {currentItem.avatar ? (
                  <AvatarImage
                    src={resolveFileUrl(currentItem.avatar) || undefined}
                    alt={String(currentItem.name)}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs font-medium">
                  {String(currentItem.name).substring(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col min-w-0'>
                <span className='text-sm font-semibold text-foreground tracking-tight truncate'>{currentItem.name}</span>
                <span className='text-xs text-muted-foreground mt-0.5 truncate'>
                  Owner • {currentItem.members?.length || 1} Members
                </span>
              </div>
            </div>
            <Check className='size-4 text-foreground shrink-0' />
          </div>

          <div className='flex items-center gap-3 mt-3.5'>
            <Button
              variant='outline'
              size='sm'
              className='h-8 flex-1 px-3 bg-background font-medium shadow-none text-xs rounded-md border border-border/60 hover:bg-background hover:border-foreground/30 text-foreground transition-colors cursor-pointer'
              onClick={() => {
                setIsOpen(false);
                router.push(`/${activeId}/settings`);
              }}
            >
              <Settings className='mr-2 size-3.5 text-foreground' /> Settings
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='h-8 flex-1 px-3 bg-background font-medium shadow-none text-xs rounded-md border border-border/60 hover:bg-background hover:border-foreground/30 text-foreground transition-colors cursor-pointer'
              onClick={() => {
                setIsOpen(false);
                router.push(`/${activeId}/settings/members`);
              }}
            >
              <UserPlus className='mr-2 size-3.5 text-foreground' /> Invite members
            </Button>
          </div>
        </div>

        {/* Other workspaces */}
        {items.filter((item: Workspace) => item.id !== currentItem.id).length > 0 && (
          <div className='p-2 max-h-[200px] overflow-y-auto bg-background flex flex-col gap-1 border-b border-border/50'>
            {items
              .filter((item: Workspace) => item.id !== currentItem.id)
              .map((item: Workspace) => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(`/${item.url}`);
                  }}
                  className='px-3 py-2 justify-between cursor-pointer rounded-md'
                >
                  <div className='flex items-center gap-3 min-w-0'>
                    <Avatar className='size-7 rounded-md font-medium shrink-0'>
                      {item.avatar ? (
                        <AvatarImage
                          src={resolveFileUrl(item.avatar) || undefined}
                          alt={String(item.name)}
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs font-medium">
                        {String(item.name).substring(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex flex-col min-w-0'>
                      <span className='text-sm text-foreground font-medium truncate'>{item.name}</span>
                      <span className='text-xs text-muted-foreground truncate'>
                        {item.members?.length || 1} Member
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
          </div>
        )}

        <div className="p-2 bg-background space-y-1">
          <DropdownMenuItem
            onClick={() => {
              setIsOpen(false);
              router.push('/create-workspace');
            }}
            className='px-3 py-2 cursor-pointer rounded-md gap-3'
          >
            <PlusCircle />
            <span>Create workspace</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              setIsOpen(false);
              router.push('/workspace-invites');
            }}
            className='px-3 py-2 cursor-pointer rounded-md gap-3'
          >
            <Mails />
            <span>Workspace invites</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className='px-3 py-2 cursor-pointer rounded-md gap-3'
          >
            <LogOut />
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
