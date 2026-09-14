'use client';

import React from 'react';
import { User } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import ProfileTab from '@/features/account/components/ProfileTab';

export default function ProfilePage() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar
        title="Profile"
        description="Manage your public identity, display name, and account details."
        Icon={User}
      />
      <div className="flex-1 overflow-y-auto">
        <ProfileTab />
      </div>
    </div>
  );
}
