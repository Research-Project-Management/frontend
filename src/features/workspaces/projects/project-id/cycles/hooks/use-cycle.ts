'use client';

import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { CycleService } from "../services/cycle.service";
import { useProjectDetails } from "@/features/workspaces/projects/shell";
import type { Cycle, CreateCycleInput, UpdateCycleInput } from "../types/cycle.types";

export type DerivedStatus = "active" | "planned" | "completed";

// ── Query Keys ───────────────────────────────────────────────────────────────

export const cycleKeys = {
  all: ["cycles"] as const,
  project: (projectId: string) => ["cycles", projectId] as const,
};

// ── Query Options ────────────────────────────────────────────────────────────

export const projectCyclesQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: cycleKeys.project(projectId),
    queryFn: () => CycleService.getProjectCycles(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

// ── Query Hooks ───────────────────────────────────────────────────────────────

export const useProjectCycles = (projectId: string) =>
  useQuery(projectCyclesQueryOptions(projectId));

// ── Mutation Hooks ───────────────────────────────────────────────────────────

export const useCreateCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string } & Partial<CreateCycleInput>) =>
      CycleService.create({ projectId, ...data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: cycleKeys.project(variables.projectId) });
    },
  });
};

export const useUpdateCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, projectId, ...data }: { cycleId: string; projectId: string } & Partial<UpdateCycleInput>) =>
      CycleService.update({ cycleId, projectId, ...data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: cycleKeys.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
  });
};

export const useDeleteCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cycleId, projectId }: { cycleId: string; projectId: string }) =>
      CycleService.delete({ cycleId, projectId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: cycleKeys.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
  });
};

export const useCompleteCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cycleId,
      projectId,
      action,
      targetCycleId,
    }: {
      cycleId: string;
      projectId: string;
      action: 'transfer' | 'backlog' | 'leave';
      targetCycleId?: string;
    }) =>
      CycleService.complete({ cycleId, action, targetCycleId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: cycleKeys.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
  });
};

// ── Helpers & Business Logic ──────────────────────────────────────────────────

/**
 * Derives the effective status of a cycle for grouping.
 * Strictly Manual based on the 'status' field.
 */
export const deriveStatus = (cycle: {
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
}): DerivedStatus => {
  // 1. Priority: Explicit Manual Status
  if (cycle.status === "completed") return "completed";
  if (cycle.status === "active") return "active";

  // 2. Fallback: Automatic Date-based Status
  if (!cycle.startDate || !cycle.endDate) return "planned";

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = new Date(cycle.startDate);
  const end = new Date(cycle.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (now > end) return "completed";
  if (now >= start) return "active";

  return "planned";
};

/**
 * Hook useCycle: Unified Management for Cycles.
 */
export function useCycle(projectId: string, _workspaceId?: string, options?: { skipProjectDetails?: boolean }) {
  const { data: cyclesData, isLoading: isCyclesLoading } = useProjectCycles(projectId);
  const cycles = useMemo(() => {
    const list = cyclesData?.cycles || [];
    return list.map((c: any) => ({
      ...c,
      _id: c._id || c.id,
      id: c.id || c._id,
    }));
  }, [cyclesData]);

  const { data: projectDetails } = useProjectDetails(projectId, {
    enabled: !options?.skipProjectDetails,
  });

  const pDetails = projectDetails as any;
  const projectData = pDetails?.project || pDetails;

  const createMutation = useCreateCycle();
  const updateMutation = useUpdateCycle();
  const deleteMutation = useDeleteCycle();

  /**
   * Group cycles into Active, Upcoming, and Completed sections.
   */
  const getGroupedCycles = useCallback(
    (searchTerm: string, customCycles?: Cycle[]) => {
      const term = searchTerm.toLowerCase().trim();
      const source = customCycles || cycles;
      const filtered = term
        ? source.filter((c) => c.name.toLowerCase().includes(term))
        : source;

      const grouped: Record<DerivedStatus, Cycle[]> = {
        active: [],
        planned: [],
        completed: [],
      };

      filtered.forEach((cycle) => {
        const status = deriveStatus(cycle);
        grouped[status].push(cycle);
      });

      return grouped;
    },
    [cycles],
  );

  /**
   * Checks for overlapping date ranges.
   * Business Logic: Overlaps are forbidden if Parallel Cycles = OFF.
   */
  const checkParallelConflict = useCallback(
    (start: string, end: string, excludeId?: string) => {
      if (!start || !end) return false;

      const s = new Date(start);
      s.setHours(0, 0, 0, 0);
      const e = new Date(end);
      e.setHours(0, 0, 0, 0);

      return cycles.some((c) => {
        if (c._id === excludeId) return false;
        if (deriveStatus(c) === "completed") return false; // Ignore completed cycles
        if (!c.startDate || !c.endDate) return false;

        const cs = new Date(c.startDate);
        cs.setHours(0, 0, 0, 0);
        const ce = new Date(c.endDate);
        ce.setHours(0, 0, 0, 0);

        // Standard overlap check: (s <= ce) && (e >= cs)
        return s <= ce && e >= cs;
      });
    },
    [cycles],
  );

  /**
   * Helper to check if a cycle is read-only.
   */
  const isCycleReadOnly = useCallback(
    (cycle?: { status?: string; startDate?: string | null; endDate?: string | null }) => {
      if (!cycle) return false;
      return deriveStatus(cycle) === "completed";
    },
    [],
  );

  return {
    cycles,
    projectData,
    isLoading: isCyclesLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    getGroupedCycles,
    checkParallelConflict,
    deriveStatus,
    isCycleReadOnly,
  };
}
