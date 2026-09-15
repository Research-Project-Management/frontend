'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import SecurityTab from '@/features/account/components/SecurityTab';

export default function SecurityPage() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar
        title="Security"
        description="Manage account credentials, authentication methods, and security settings."
        Icon={Lock}
      />
      <div className="flex-1 overflow-y-auto">
        <SecurityTab />
      </div>
    </div>
  );
}
