'use client';

import React from 'react';
import { UserStar } from 'lucide-react';
import YourWorkNavigationBar from '@/features/projects/your-work/components/layout/NavigationBar';
import ProfileSidebar from '@/features/projects/your-work/components/profile/ProfileSidebar';
import { YourWorkProvider, useYourWorkContext } from '@/features/projects/your-work/context/your-work.context';
import { WorkItemDialogModal } from '@/features/projects/your-work/components/shared/WorkItemDialogModal';
import ProjectLayout from '@/features/projects/shell/components/ProjectLayout';

function YourWorkLayoutContent({ children }: { children: React.ReactNode }) {
  const {
    assigned,
    created,
    subscribed,
    activities,
    projectBreakdown,
    userData,
    selectedProjectId,
    setSelectedProjectId,
    totalCounts,
    selectedWorkItem,
    closeWorkItem,
  } = useYourWorkContext();

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
          <h1 className="text-13 font-semibold text-foreground tracking-tight">
            Your work
          </h1>
        </div>

        {/* Tabs Bar */}
        <YourWorkNavigationBar
          counts={{
            assigned: selectedProjectId ? assigned.length : totalCounts.assigned,
            created: selectedProjectId ? created.length : totalCounts.created,
            subscribed: selectedProjectId ? subscribed.length : totalCounts.subscribed,
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
        onSelectProject={setSelectedProjectId}
      />

      {/* Shared Work Item Detail Dialog */}
      {selectedWorkItem && (
        <WorkItemDialogModal
          workItemId={selectedWorkItem.workItemId || ''}
          projectId={selectedWorkItem.projectId}
          initialWorkItem={selectedWorkItem.workItem}
          open={Boolean(selectedWorkItem)}
          onOpenChange={(open) => {
            if (!open) closeWorkItem();
          }}
        />
      )}
    </div>
  );
}

export default function YourWorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectLayout>
      <YourWorkProvider>
        <YourWorkLayoutContent>{children}</YourWorkLayoutContent>
      </YourWorkProvider>
    </ProjectLayout>
  );
}

