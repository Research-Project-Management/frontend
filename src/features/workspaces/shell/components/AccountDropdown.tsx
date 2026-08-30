'use client';

import { useState, useEffect } from 'react';
import { Settings, SlidersHorizontal, LogOut } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { resolveFileUrl } from '@/shared/utils/url';
import AccountModal from '@/features/account/pages/AccountModal';

interface AccountDropdownProps {
  workspaceId: string;
}

export default function AccountDropdown({ workspaceId }: AccountDropdownProps) {
  const { user, isLoading, logout } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState('profile');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const openModal = (tab: string) => {
    setInitialTab(tab);
    setIsModalOpen(true);
  };

  if (!mounted || isLoading || !user) {
    return (
      <div className="size-8 flex items-center justify-center">
        <div className="size-7 rounded-full bg-muted/60" />
      </div>
    );
  }

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
          className='w-[250px] p-0 overflow-hidden bg-popover rounded-lg shadow-none border border-border'
          alignOffset={0}
        >
          <div className="flex flex-col items-center justify-center text-center px-4 py-4 border-b border-border/50 bg-muted/20">
            <Avatar className="size-12 rounded-full border border-border/50">
              {user.avatar ? (
                <AvatarImage
                  src={resolveFileUrl(user.avatar) || undefined}
                  alt={String(user.name || '')}
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <AvatarFallback className="text-sm font-semibold">
                {String(user.name || '').substring(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-semibold text-foreground mt-2.5 max-w-full truncate tracking-tight">{user?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-full truncate">{user?.email || ''}</p>
          </div>
          
          <div className="p-1.5 space-y-0.5">
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
              onClick={() => openModal('profile')}
            >
              <Settings className="size-4 text-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
              onClick={() => openModal('preferences')}
            >
              <SlidersHorizontal className="size-4 text-foreground" />
              <span>Preferences</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => logout()} 
              className="cursor-pointer gap-2.5 px-3 py-2 text-foreground"
            >
              <LogOut className="size-4 text-foreground" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </div>
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
