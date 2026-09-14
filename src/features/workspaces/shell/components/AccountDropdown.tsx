'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, SlidersHorizontal, LogOut, UserStar } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/components/ui";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { resolveFileUrl } from "@/shared/lib/file-client";
interface AccountDropdownProps {
  className?: string;
}

export default function AccountDropdown({}: AccountDropdownProps = {}) {
  const { user, isLoading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading || !user) {
    return (
      <div className="size-8 flex items-center justify-center">
        <div className="size-7 rounded-full bg-muted" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='flex items-center justify-center size-8 rounded-md transition-colors hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary data-[state=open]:bg-muted cursor-pointer'>
        <Avatar className='size-7 rounded-full shrink-0'>
          {user.avatar ? <AvatarImage src={resolveFileUrl(user.avatar) || undefined} alt={String(user.name || '')} referrerPolicy="no-referrer" /> : null}
          <AvatarFallback>{String(user.name || '').substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align='end'
        onCloseAutoFocus={(e) => e.preventDefault()}
        className='w-64 p-0 overflow-hidden bg-popover rounded-md shadow-none border border-border'
        alignOffset={0}
      >
        <div className="flex flex-col items-center justify-center text-center px-4 py-4 border-b border-border bg-popover">
          <Avatar className="size-12 rounded-full border border-border shrink-0">
            {user.avatar ? (
              <AvatarImage
                src={resolveFileUrl(user.avatar) || undefined}
                alt={String(user.name || '')}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className="text-13 font-semibold">
              {String(user.name || '').substring(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <p className="text-13 font-semibold text-foreground mt-2.5 max-w-full truncate tracking-tight">{user?.name || 'User'}</p>
          <p className="text-11 text-muted-foreground mt-0.5 max-w-full truncate">{user?.email || ''}</p>
        </div>
        
        <div className="p-1.5 space-y-0.5">
          <DropdownMenuItem
            className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
            asChild
          >
            <Link href="/your-work">
              <UserStar className="size-4 text-foreground shrink-0" />
              <span>Your work</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-border" />

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
            asChild
          >
            <Link href="/settings">
              <Settings className="size-4 text-foreground shrink-0" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
            asChild
          >
            <Link href="/settings/preferences">
              <SlidersHorizontal className="size-4 text-foreground shrink-0" />
              <span>Preferences</span>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => logout()} 
            className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
          >
            <LogOut className="size-4 text-foreground shrink-0" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
