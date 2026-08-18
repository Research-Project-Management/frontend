'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { User, SlidersHorizontal, Bell, Lock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
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
    <aside className='w-[240px] shrink-0 border-r border-border/50 bg-background flex flex-col'>
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

      <div className='flex flex-col gap-6 px-3 py-2'>
        {/* Your Profile Section */}
        <div>
          <h3 className='mb-1 px-2 text-xs font-semibold text-muted-foreground'>
            Your profile
          </h3>
          <nav className='flex flex-col space-y-0.5'>
            <SidebarItem
              icon={<User className='size-4' />}
              label='Profile'
              active={activeTab === 'profile'}
              onClick={() => setTab('profile')}
            />
            <SidebarItem
              icon={<SlidersHorizontal className='size-4' />}
              label='Preferences'
              active={activeTab === 'preferences'}
              onClick={() => setTab('preferences')}
            />
            <SidebarItem
              icon={<Bell className='size-4' />}
              label='Notifications'
              active={activeTab === 'notifications'}
              onClick={() => setTab('notifications')}
            />
            <SidebarItem
              icon={<Lock className='size-4' />}
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
        'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors outline-none cursor-pointer',
        active
          ? 'bg-muted font-medium text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
