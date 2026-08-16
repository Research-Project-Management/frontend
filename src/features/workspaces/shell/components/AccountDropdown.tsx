'use client';

import { useState } from 'react';
import { Settings, SlidersHorizontal, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { useLogout, useAuth } from '@/features/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { resolveFileUrl } from '@/shared/utils/url';
import AccountModal from '@/features/account/pages/AccountModal';

interface AccountDropdownProps {
  workspaceId: string;
}

export default function AccountDropdown({ workspaceId }: AccountDropdownProps) {
  const { user, isLoading } = useAuth();
  const { logout } = useLogout();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState('profile');

  const openModal = (tab: string) => {
    setInitialTab(tab);
    setIsModalOpen(true);
  };

  if (isLoading || !user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className='flex items-center justify-center size-8 rounded-md transition-colors hover:bg-accent/50 outline-none data-[state=open]:bg-accent/50 cursor-pointer'>
            <Avatar className='size-7 rounded-full'>
      {user.avatar ? <AvatarImage src={resolveFileUrl(user.avatar) || undefined} alt={String(user.name || '')} referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{String(user.name || '').substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
    </Avatar>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent
          align='end'
          onCloseAutoFocus={(e) => e.preventDefault()}
          className='w-[260px] p-2 bg-popover'
          alignOffset={0}
        >
          <div className="px-2.5 py-2 border-b border-border/60">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email || ''}</p>
          </div>
          
          <DropdownMenuItem
            className="cursor-pointer text-muted-foreground focus:text-foreground mt-1"
            onClick={() => openModal('profile')}
          >
            <Settings className="mr-2 size-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            className="cursor-pointer text-muted-foreground focus:text-foreground mb-1"
            onClick={() => openModal('preferences')}
          >
            <SlidersHorizontal className="mr-2 size-4" />
            <span>Preferences</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => logout()} 
            className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="mr-2 size-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialTab={initialTab}
      />
    </>
  );
}
