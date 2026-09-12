'use client';

import React, { useState } from 'react';
import { Pencil, ChevronDown } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { ProjectWorkloadBreakdown, UserProfileData } from '../../schemas/your-work.schema';

export interface ProfileSidebarProps {
  userData?: UserProfileData;
  projects?: ProjectWorkloadBreakdown[];
  workspaceId?: string;
  className?: string;
  onEditProfile?: () => void;
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string | null) => void;
}

export function ProfileSidebar({
  userData,
  projects = [],
  className,
  onEditProfile,
}: ProfileSidebarProps) {
  // Default to first project open if available to match official screenshot
  const [openProjectIds, setOpenProjectIds] = useState<Set<string>>(() => {
    if (projects.length > 0) {
      return new Set([projects[0].projectId]);
    }
    return new Set();
  });

  const toggleProject = (id: string) => {
    setOpenProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayName = userData?.name || 'User';
  const username = userData?.email ? userData.email.split('@')[0] : 'user';

  // Format joined date: e.g. "Mar 04, 2026"
  const formattedJoinedDate = React.useMemo(() => {
    if (!userData?.createdAt) return 'Recently';
    try {
      const date = new Date(userData.createdAt);
      if (isNaN(date.getTime())) return 'Recently';
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }).format(date);
    } catch {
      return 'Recently';
    }
  }, [userData?.createdAt]);

  return (
    <aside
      className={cn(
        'w-full md:w-[280px] lg:w-[300px] shrink-0 border-l border-border bg-background flex flex-col select-none overflow-y-auto',
        className,
      )}
    >
      {/* 1. Cover Image Banner (Dark gritty gradient texture) */}
      <div className="relative h-36 w-full shrink-0">
        {/* Deep dark textured granite pattern */}
        <div className="absolute inset-0 bg-muted overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-95"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 50%, #27272a 0%, #121214 100%)',
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(#52525b_1px,transparent_1px)] [background-size:3px_3px] opacity-40" />
        </div>

        {/* Edit profile button */}
        <button
          type="button"
          onClick={onEditProfile}
          className="absolute top-3 right-3 size-7 rounded-md bg-background hover:bg-muted text-foreground border border-border flex items-center justify-center transition-colors z-10 cursor-pointer"
          title="Edit profile"
          aria-label="Edit profile"
        >
          <Pencil className="size-3.5 shrink-0" />
        </button>

        {/* Overlapping Avatar - Square with rounded-lg overlapping banner without being clipped */}
        <div className="absolute -bottom-7 left-5 size-14 rounded-lg border-2 border-background shadow-xs overflow-hidden bg-muted flex items-center justify-center text-foreground font-semibold text-lg z-20">
          {userData?.avatar ? (
            <img
              src={userData.avatar}
              alt={displayName}
              className="size-full object-cover"
            />
          ) : (
            <span>{displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* 2. User Identity Details (Clean layout, NO divider lines) */}
      <div className="px-5 pt-10 pb-2">
        <h4 className="text-base font-semibold text-foreground tracking-tight leading-tight">
          {displayName}
        </h4>
        <p className="text-xs text-muted-foreground font-normal mt-0.5">
          ({username})
        </p>

        <div className="mt-4 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Joined on</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formattedJoinedDate}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Projects List (Zero extra headers, Zero horizontal lines) */}
      <div className="px-5 pt-4 flex-1 space-y-4">
        {projects.map((project) => {
          const isOpen = openProjectIds.has(project.projectId);
          const pendingCount =
            (project.stateGroupBreakdown?.unstarted || 0) +
            (project.stateGroupBreakdown?.started || 0);
          const completedCount = project.stateGroupBreakdown?.completed || 0;

          return (
            <div key={project.projectId} className="space-y-3">
              {/* Project Header Row: icon/emoji + name + chevron */}
              <button
                type="button"
                onClick={() => toggleProject(project.projectId)}
                className="w-full flex items-center justify-between text-left group cursor-pointer p-1.5 -mx-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none shrink-0">
                    {project.projectAvatar || '📁'}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground transition-colors">
                    {project.projectName}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'size-4 text-foreground shrink-0 transition-transform duration-150',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* Project Breakdown Items (Exact 4 Work items categories from screenshot) */}
              {isOpen && (
                <div className="space-y-3.5 pl-6 pt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-xs bg-blue-900 shrink-0" />
                      <span className="text-foreground font-normal">Created</span>
                    </div>
                    <span className="font-normal text-foreground tabular-nums">
                      {project.createdCount || 0} Work items
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-xs bg-blue-600 shrink-0" />
                      <span className="text-foreground font-normal">Assigned</span>
                    </div>
                    <span className="font-normal text-foreground tabular-nums">
                      {project.assignedCount || 0} Work items
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-xs bg-amber-500 shrink-0" />
                      <span className="text-foreground font-normal">Due</span>
                    </div>
                    <span className="font-normal text-foreground tabular-nums">
                      {pendingCount} Work items
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2.5 rounded-xs bg-emerald-600 shrink-0" />
                      <span className="text-foreground font-normal">Completed</span>
                    </div>
                    <span className="font-normal text-foreground tabular-nums">
                      {completedCount} Work items
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default ProfileSidebar;
