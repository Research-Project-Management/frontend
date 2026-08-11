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
import { logoutUser, useAuth } from '@/features/auth';
import Avatar from '@/shared/components/Avatar';
import AccountModal from '@/features/account/pages/AccountModal';

interface AccountDropdownProps {
  workspaceId: string;
}

export default function AccountDropdown({ workspaceId }: AccountDropdownProps) {
  const { user, isLoading } = useAuth();
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
        <DropdownMenuTrigger asChild>
          <button className='flex items-center justify-center size-8 rounded-md transition-colors hover:bg-accent/50 outline-none data-[state=open]:bg-accent/50'>
            <Avatar
              src={user.avatar}
              name={user.name || ''}
              className='size-7 rounded-full'
              fallbackType='user'
            />
          </button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align='end' className='w-[260px] p-2' alignOffset={0}>
          {/* Profile Card Header with Noise Background */}
          <div className='relative mb-2 flex flex-col items-center justify-center overflow-hidden rounded-md bg-muted p-4 pb-3'>
            {/* Noise texture overlay */}
            <div 
              className='absolute inset-0 z-0 opacity-50'
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundBlendMode: 'multiply',
              }}
            />
            {/* Content */}
            <div className='relative z-10 flex flex-col items-center gap-2'>
              <Avatar
                src={user.avatar}
                name={user.name || ''}
                className='size-12 rounded-full border border-background shadow-sm'
                fallbackType='user'
              />
              <div className='flex flex-col items-center text-center'>
                <p className='text-sm font-medium text-foreground'>{user.name}</p>
                <p className='text-xs text-muted-foreground'>{user.email}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <DropdownMenuItem
            className='cursor-pointer text-muted-foreground focus:text-foreground'
            onClick={() => openModal('profile')}
          >
            <Settings className='mr-2 size-4' />
            <span>Settings</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            className='cursor-pointer text-muted-foreground focus:text-foreground mb-1'
            onClick={() => openModal('preferences')}
          >
            <SlidersHorizontal className='mr-2 size-4' />
            <span>Preferences</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={logoutUser} 
            className='cursor-pointer text-muted-foreground focus:text-foreground'
          >
            <LogOut className='mr-2 size-4' />
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
