'use client';

import React from 'react';
import { UserStar } from 'lucide-react';
import YourWorkNavigationBar from '@/features/projects/your-work/components/layout/NavigationBar';
import ProfileSidebar from '@/features/projects/your-work/components/profile/ProfileSidebar';
import { YourWorkProvider } from '@/features/projects/your-work/context/your-work.context';
import { useSummaryWork } from '@/features/projects/your-work/hooks/use-summary-work';

function YourWorkLayoutContent({ children }: { children: React.ReactNode }) {
  const { state, actions } = useSummaryWork();
  const {
    categorizedWorkItems,
    activities,
    projectBreakdown,
    userData,
    selectedProjectId,
    totalCounts,
  } = state;

  const items = categorizedWorkItems || { assigned: [], created: [], subscribed: [] };

  return (
    <div className="h-full flex min-h-0 overflow-hidden bg-background">
      {/* Main Left Column: Header, Tabs, Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top Header */}
        <div
          className="flex items-center gap-2.5 px-6 h-11 border-b border-border bg-background shrink-0 select-none"
          style={{ paddingLeft: 'max(1.5rem, var(--header-offset, 0px))' }}
        >
          <UserStar className="size-4 text-foreground shrink-0" />
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            Your work
          </h1>
        </div>

        {/* Tabs Bar */}
        <YourWorkNavigationBar
          counts={{
            assigned: selectedProjectId ? items.assigned.length : totalCounts.assigned,
            created: selectedProjectId ? items.created.length : totalCounts.created,
            subscribed: selectedProjectId ? items.subscribed.length : totalCounts.subscribed,
            activity: selectedProjectId ? activities.length : totalCounts.activity,
          }}
        />

        {/* Tab Content Page */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Right Column: Profile Sidebar */}
      <ProfileSidebar
        userData={userData}
        projects={projectBreakdown}
        selectedProjectId={selectedProjectId}
        onSelectProject={actions.selectProject}
      />
    </div>
  );
}

import ProjectLayout from '@/features/projects/shell/components/ProjectLayout';

export default function YourWorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectLayout>
      <YourWorkProvider>
        <YourWorkLayoutContent>{children}</YourWorkLayoutContent>
      </YourWorkProvider>
    </ProjectLayout>
  );
}
