'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useYourWorkBase } from '../hooks/use-your-work-base';
import {
  calculateStatusBreakdown,
  calculatePriorityBreakdown,
  getTaskProjectId,
} from '../utils/your-work.util';
import type {
  YourWorkTask,
  YourWorkActivityEvent,
  ProjectWorkloadBreakdown,
  UserProfileData,
} from '../schemas/your-work.schema';
import type { ProjectMap } from '../utils/your-work.util';

export interface YourWorkContextType {
  workspaceId?: string;
  currentUserId?: string | null;
  // Selected project state
  selectedProjectId: string | null;
  selectedProject: ProjectWorkloadBreakdown | null;
  setSelectedProjectId: (projectId: string | null) => void;
  // Filtered tasks & metrics
  allTasks: YourWorkTask[];
  assigned: YourWorkTask[];
  created: YourWorkTask[];
  subscribed: YourWorkTask[];
  activities: YourWorkActivityEvent[];
  recent: any[];
  statusBreakdown: Record<string, number>;
  subscribedStatusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  projectBreakdown: ProjectWorkloadBreakdown[];
  taskProjectMap: ProjectMap;
  userData?: UserProfileData;
  // Raw / Unfiltered counts
  totalCounts: {
    assigned: number;
    created: number;
    subscribed: number;
    activity: number;
  };
  // Loading & query status
  isLoading: boolean;
  isLoadingYourWork: boolean;
  isLoadingTasks: boolean;
  isLoadingProjects: boolean;
  isRefetching: boolean;
  refetch: () => Promise<unknown>;
  invalidate: () => void;
}

const YourWorkContext = createContext<YourWorkContextType | null>(null);

export function YourWorkProvider({ children }: { children: React.ReactNode }) {
  const base = useYourWorkBase();
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);

  // Sync with URL query parameter on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const proj = urlParams.get('project');
      if (proj) {
        setSelectedProjectIdState(proj);
      }
    }
  }, []);

  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedProjectIdState(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set('project', id);
      } else {
        url.searchParams.delete('project');
      }
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Filter tasks if a project is selected
  const filteredAssigned = useMemo(() => {
    if (!selectedProjectId) return base.assigned;
    return base.assigned.filter((t) => getTaskProjectId(t) === selectedProjectId);
  }, [base.assigned, selectedProjectId]);

  const filteredCreated = useMemo(() => {
    if (!selectedProjectId) return base.created;
    return base.created.filter((t) => getTaskProjectId(t) === selectedProjectId);
  }, [base.created, selectedProjectId]);

  const filteredSubscribed = useMemo(() => {
    if (!selectedProjectId) return base.subscribed;
    return base.subscribed.filter((t) => getTaskProjectId(t) === selectedProjectId);
  }, [base.subscribed, selectedProjectId]);

  const filteredActivities = useMemo(() => {
    if (!selectedProjectId) return base.activities;
    return base.activities.filter((act) => {
      const actProjId = typeof act.project === 'object' ? act.project?.id : act.project;
      return actProjId === selectedProjectId;
    });
  }, [base.activities, selectedProjectId]);

  const filteredAllTasks = useMemo(() => {
    const map = new Map<string, YourWorkTask>();
    [...filteredAssigned, ...filteredCreated, ...filteredSubscribed].forEach((t) => {
      if (t.id && !map.has(t.id)) {
        map.set(t.id, t);
      }
    });
    return Array.from(map.values());
  }, [filteredAssigned, filteredCreated, filteredSubscribed]);

  // Selected project metadata
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return (
      base.projectBreakdown.find((p) => p.projectId === selectedProjectId) || null
    );
  }, [base.projectBreakdown, selectedProjectId]);

  // Recompute breakdowns for the filtered view
  const statusBreakdown = useMemo(() => {
    if (!selectedProjectId) return base.statusBreakdown;
    return calculateStatusBreakdown(filteredAssigned);
  }, [base.statusBreakdown, filteredAssigned, selectedProjectId]);

  const subscribedStatusBreakdown = useMemo(() => {
    if (!selectedProjectId) return base.subscribedStatusBreakdown;
    return calculateStatusBreakdown(filteredSubscribed);
  }, [base.subscribedStatusBreakdown, filteredSubscribed, selectedProjectId]);

  const priorityBreakdown = useMemo(() => {
    if (!selectedProjectId) return base.priorityBreakdown;
    return calculatePriorityBreakdown(filteredAssigned);
  }, [base.priorityBreakdown, filteredAssigned, selectedProjectId]);

  const totalCounts = useMemo(
    () => ({
      assigned: base.assigned.length,
      created: base.created.length,
      subscribed: base.subscribed.length,
      activity: base.activities.length,
    }),
    [base.assigned.length, base.created.length, base.subscribed.length, base.activities.length],
  );

  const contextValue: YourWorkContextType = useMemo(
    () => ({
      workspaceId: base.workspaceId,
      currentUserId: base.currentUserId,
      selectedProjectId,
      selectedProject,
      setSelectedProjectId,
      allTasks: filteredAllTasks,
      assigned: filteredAssigned,
      created: filteredCreated,
      subscribed: filteredSubscribed,
      activities: filteredActivities,
      recent: base.recent,
      statusBreakdown,
      subscribedStatusBreakdown,
      priorityBreakdown,
      projectBreakdown: base.projectBreakdown,
      taskProjectMap: base.taskProjectMap,
      userData: base.userData,
      totalCounts,
      isLoading: base.isLoading,
      isLoadingYourWork: base.isLoadingYourWork,
      isLoadingTasks: base.isLoadingTasks,
      isLoadingProjects: base.isLoadingProjects,
      isRefetching: base.isRefetching,
      refetch: base.refetch,
      invalidate: base.invalidate,
    }),
    [
      base.workspaceId,
      base.currentUserId,
      selectedProjectId,
      selectedProject,
      setSelectedProjectId,
      filteredAllTasks,
      filteredAssigned,
      filteredCreated,
      filteredSubscribed,
      filteredActivities,
      base.recent,
      statusBreakdown,
      subscribedStatusBreakdown,
      priorityBreakdown,
      base.projectBreakdown,
      base.taskProjectMap,
      base.userData,
      totalCounts,
      base.isLoading,
      base.isLoadingYourWork,
      base.isLoadingTasks,
      base.isLoadingProjects,
      base.isRefetching,
      base.refetch,
      base.invalidate,
    ],
  );

  return (
    <YourWorkContext.Provider value={contextValue}>
      {children}
    </YourWorkContext.Provider>
  );
}

export function useOptionalYourWorkContext(): YourWorkContextType | null {
  return useContext(YourWorkContext);
}

export function useYourWorkContext(): YourWorkContextType {
  const context = useContext(YourWorkContext);
  if (!context) {
    throw new Error('useYourWorkContext must be used within a YourWorkProvider');
  }
  return context;
}
