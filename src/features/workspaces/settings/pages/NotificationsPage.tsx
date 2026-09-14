'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import NotificationsTab from '@/features/account/components/NotificationsTab';

export default function NotificationsPage() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar
        title="Notifications"
        description="Choose what activity alerts and updates you receive via email."
        Icon={Bell}
      />
      <div className="flex-1 overflow-y-auto">
        <NotificationsTab />
      </div>
    </div>
  );
}
