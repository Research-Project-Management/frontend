'use client';

import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { TopBar } from '../components/layout/TopBar';
import PreferencesTab from '@/features/account/components/PreferencesTab';

export default function PreferencesPage() {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopBar
        title="Preferences"
        description="Customize interface appearance, localization, and editing controls."
        Icon={SlidersHorizontal}
      />
      <div className="flex-1 overflow-y-auto">
        <PreferencesTab />
      </div>
    </div>
  );
}
