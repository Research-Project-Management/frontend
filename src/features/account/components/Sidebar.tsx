'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { User, SlidersHorizontal, Bell, Lock } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user } = useAuth();
  
  const setTab = (tab: string) => {
    onTabChange(tab);
  };

  if (!user) return null;

  return (
    <aside className='w-60 shrink-0 border-r border-border bg-background flex flex-col'>
      {/* Header Profile Info */}
      <div className='flex items-center gap-3 p-4'>
        <Avatar className='size-8'>
      {user.avatar ? <AvatarImage src={user.avatar} alt={String(user.name || '')} referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{String(user.name || '').substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
    </Avatar>
        <div className='flex min-w-0 flex-col'>
          <p className='truncate text-sm font-medium leading-tight text-foreground'>
            {user.name}
          </p>
          <p className='truncate text-xs leading-tight text-muted-foreground'>
            {user.email}
          </p>
        </div>
      </div>

      <div className='flex flex-col gap-3 px-3 py-2'>
        {/* Your Profile Section */}
        <div>
          <div className='px-2 pb-1.5 pt-1 text-13 font-medium text-muted-foreground select-none'>
            Your profile
          </div>
          <nav className='flex flex-col gap-1'>
            <SidebarItem
              icon={<User className='size-4 text-foreground shrink-0' />}
              label='Profile'
              active={activeTab === 'profile'}
              onClick={() => setTab('profile')}
            />
            <SidebarItem
              icon={<SlidersHorizontal className='size-4 text-foreground shrink-0' />}
              label='Preferences'
              active={activeTab === 'preferences'}
              onClick={() => setTab('preferences')}
            />
            <SidebarItem
              icon={<Bell className='size-4 text-foreground shrink-0' />}
              label='Notifications'
              active={activeTab === 'notifications'}
              onClick={() => setTab('notifications')}
            />
            <SidebarItem
              icon={<Lock className='size-4 text-foreground shrink-0' />}
              label='Security'
              active={activeTab === 'security'}
              onClick={() => setTab('security')}
            />
          </nav>
        </div>

      </div>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex h-8 w-full items-center gap-1.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer text-foreground',
        active
          ? 'bg-muted font-medium'
          : 'font-normal hover:bg-muted'
      )}
    >
      {icon}
      <span className='truncate tracking-tight'>{label}</span>
    </button>
  );
}
