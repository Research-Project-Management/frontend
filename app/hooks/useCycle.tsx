import { useMemo, useCallback } from "react";
import { 
  useProjectCycles, 
  useCreateCycle, 
  useUpdateCycle, 
  useDeleteCycle 
} from "~/query/cycle";
import { useLabelsQuery } from "~/query/label";
import { useProjectDetails } from "~/query/project";
import type { Cycle } from "~/types/task";

export type DerivedStatus = "active" | "planned" | "completed";

/**
 * Derives the effective status of a cycle for grouping.
 * Strictly Manual based on the 'status' field.
 */
export const deriveStatus = (cycle: { status?: string; startDate?: string | null; endDate?: string | null }): DerivedStatus => {
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
export function useCycle(projectId: string, workspaceId?: string, options?: { skipProjectDetails?: boolean }) {
  const { data: cyclesData, isLoading: isCyclesLoading } = useProjectCycles(projectId);
  const cycles = useMemo(() => cyclesData?.cycles || [], [cyclesData]);

  const { data: projectDetails } = useProjectDetails(projectId, { enabled: !options?.skipProjectDetails });
  const projectData = projectDetails?.project || projectDetails;

  const createMutation = useCreateCycle();
  const updateMutation = useUpdateCycle();
  const deleteMutation = useDeleteCycle();

  /**
   * Group cycles into Active, Upcoming, and Completed sections.
   */
  const getGroupedCycles = useCallback((searchTerm: string, customCycles?: Cycle[]) => {
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
  }, [cycles]);

  /**
   * Checks for overlapping date ranges.
   * Business Logic: Overlaps are forbidden if Parallel Cycles = OFF.
   */
  const checkParallelConflict = useCallback((start: string, end: string, excludeId?: string) => {
    if (!start || !end) return false;
    
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(0, 0, 0, 0);
    
    return cycles.some(c => {
      if (c._id === excludeId) return false;
      if (deriveStatus(c) === "completed") return false; // Ignore completed cycles
      if (!c.startDate || !c.endDate) return false;
      
      const cs = new Date(c.startDate); cs.setHours(0, 0, 0, 0);
      const ce = new Date(c.endDate); ce.setHours(0, 0, 0, 0);
      
      // Standard overlap check: (s <= ce) && (e >= cs)
      return s <= ce && e >= cs;
    });
  }, [cycles]);

  /**
   * Helper to check if a cycle is read-only.
   */
  const isCycleReadOnly = useCallback((cycle?: { status?: string; startDate?: string | null; endDate?: string | null }) => {
    if (!cycle) return false;
    return deriveStatus(cycle) === "completed";
  }, []);

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
