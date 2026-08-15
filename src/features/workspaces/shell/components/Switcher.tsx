'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, PlusCircle, LogOut, Check, Settings, UserPlus, Mails } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  Badge
} from '@/shared/components/ui';
import { logoutUser, useAuth } from '@/features/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { resolveFileUrl } from '@/shared/utils/url';

interface SwitcherProps {
  currentItem: any;
  items: any[];
  activeId: string;
}

export default function Switcher({
  currentItem,
  items,
  activeId,
}: SwitcherProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentItem) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        aria-label={`Current Item: ${currentItem.name}`}
        className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-accent data-[state=open]:bg-accent'
      >
        <Avatar className='size-7 rounded-md font-medium'>
          {currentItem.avatar ? (
            <AvatarImage
              src={resolveFileUrl(currentItem.avatar) || undefined}
              alt={String(currentItem.name)}
              referrerPolicy="no-referrer"
            />
          ) : null}
          <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-sm">
            {String(currentItem.name).substring(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className='max-w-[140px] truncate text-base font-medium tracking-tight text-foreground sm:max-w-[180px]'>
          {currentItem.name}
        </span>
        {isOpen ? (
          <ChevronUp className='size-5 text-muted-foreground' strokeWidth={2.5} />
        ) : (
          <ChevronDown className='size-5 text-muted-foreground' strokeWidth={2.5} />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align='start'
        onCloseAutoFocus={(e) => e.preventDefault()}
        className='w-[280px] p-0 rounded-xl overflow-hidden shadow-none border bg-popover'
        sideOffset={8}
      >
        {/* Header email */}
        <div className='px-3 py-2 text-[12px] font-medium text-muted-foreground bg-background'>
          {user?.email || 'user@example.com'}
        </div>

        {/* Current workspace area */}
        <div className='bg-muted p-2.5'>
          <div className='flex items-center justify-between p-1'>
            <div className='flex items-center gap-2.5'>
              <Avatar className='size-9 rounded-md font-bold'>
                {currentItem.avatar ? (
                  <AvatarImage
                    src={resolveFileUrl(currentItem.avatar) || undefined}
                    alt={String(currentItem.name)}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="rounded-md bg-primary text-primary-foreground">
                  {String(currentItem.name).substring(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='flex flex-col'>
                <span className='text-[14px] font-semibold text-foreground'>{currentItem.name}</span>
                <span className='text-[12px] text-muted-foreground'>
                  Owner • {currentItem.members?.length || 1} Members
                </span>
              </div>
            </div>
            <Check className='size-5 text-foreground' />
          </div>

          <div className='flex items-center gap-2 mt-3 px-1'>
            <Button
              variant='outline'
              size='sm'
              className='h-7 px-2 bg-background font-medium shadow-none text-xs cursor-pointer'
              onClick={() => router.push(`/${activeId}/settings`)}
            >
              <Settings className='mr-1.5 size-3.5 text-foreground' /> Settings
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='h-7 px-2 bg-background font-medium shadow-none text-xs cursor-pointer'
              onClick={() => router.push(`/${activeId}/members`)}
            >
              <UserPlus className='mr-1.5 size-3.5 text-foreground' /> Invite members
            </Button>
          </div>
        </div>

        {/* Other items */}
        <div className='p-1 max-h-[240px] overflow-y-auto bg-background flex flex-col gap-0.5'>
          {items
            .filter((item: any) => item._id !== currentItem._id)
            .map((item: any) => (
              <DropdownMenuItem
                key={item._id}
                onClick={() => router.push(`/${item.url}`)}
                className='px-2 py-1.5 cursor-pointer flex items-center justify-between rounded-md'
              >
                <div className='flex items-center gap-2.5'>
                  <Avatar className='size-8 rounded-md font-bold'>
                    {item.avatar ? (
                      <AvatarImage
                        src={resolveFileUrl(item.avatar) || undefined}
                        alt={String(item.name)}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs">
                      {String(item.name).substring(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col'>
                    <span className='text-[13px] text-foreground font-medium'>{item.name}</span>
                    <span className='text-[12px] text-muted-foreground'>
                      {item.members?.length || 1} Member
                    </span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
        </div>

        <DropdownMenuSeparator className="m-0 bg-border/50" />

        <div className="p-1.5 bg-background">
          <DropdownMenuItem
            onClick={() => router.push('/create-workspace')}
            className='px-2.5 py-2 cursor-pointer rounded-md'
          >
            <PlusCircle className='mr-2.5 size-4 text-foreground/80' />
            <span className="font-medium text-foreground text-[13px]">Create workspace</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => router.push('/workspace-invites')}
            className='px-2.5 py-2 cursor-pointer rounded-md'
          >
            <Mails className='mr-2.5 size-4 text-foreground/80' />
            <span className="font-medium text-foreground text-[13px]">Workspace invites</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={logoutUser}
            className='px-2.5 py-2 cursor-pointer rounded-md text-destructive focus:bg-accent focus:text-destructive mt-0.5'
          >
            <LogOut className='mr-2.5 size-4' />
            <span className="font-medium text-[13px]">Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
