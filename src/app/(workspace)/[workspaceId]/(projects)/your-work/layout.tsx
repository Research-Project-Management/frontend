'use client';

import React from 'react';
import { UserStar } from 'lucide-react';
import {
  YourWorkTopbar,
  YourWorkNavigationBar,
  useSummaryWork,
} from '@/features/workspaces/projects/your-work';

export default function YourWorkLayout({ children }: { children: React.ReactNode }) {
  const { categorizedTasks } = useSummaryWork();

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-background">
      <YourWorkTopbar title="Your Work" icon={UserStar} />
      <YourWorkNavigationBar
        counts={{
          assigned: categorizedTasks.assigned.length,
          created: categorizedTasks.created.length,
          subscribed: categorizedTasks.subscribed.length,
        }}
      />
      <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {children}
      </main>
    </div>
  );
}
