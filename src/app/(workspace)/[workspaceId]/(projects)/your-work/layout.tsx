'use client';

import React from 'react';
import { UserStar } from 'lucide-react';
import YourWorkTopbar from '@/features/workspaces/projects/your-work/components/layout/Topbar';
import YourWorkNavigationBar from '@/features/workspaces/projects/your-work/components/layout/NavigationBar';
import { useSummaryWork } from '@/features/workspaces/projects/your-work/hooks/use-summary-work';

export default function YourWorkLayout({ children }: { children: React.ReactNode }) {
  const { state } = useSummaryWork();
  const { categorizedTasks } = state;

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
