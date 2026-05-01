import { useMemo } from "react";
import { 
  useProjectCycles, 
  useCreateCycle, 
  useUpdateCycle, 
  useDeleteCycle 
} from "~/query/cycle";
import { useLabelsQuery } from "~/query/label";
import { useWorkspaceProjects } from "~/query/workspace";
import type { Cycle } from "~/types/task";

export type DerivedStatus = "active" | "upcoming" | "completed";

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const parseDateOnly = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const deriveStatus = (cycle: Cycle): DerivedStatus => {
  if (cycle.status === "completed" || cycle.status === "cancelled") {
    return "completed";
  }

  const today = startOfToday();
  const start = parseDateOnly(cycle.startDate);
  const end = parseDateOnly(cycle.endDate);

  if (end && end < today) return "completed";
  if (start && start > today) return "upcoming";

  return "active";
};

const rangesOverlap = (
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
) => startA <= endB && startB <= endA;

/**
 * Hook useCycle: Quản lý logic Cycle (Active, Upcoming, Completed)
 */
export function useCycle(projectId: string, workspaceId?: string) {
  const { data: cyclesData, isLoading: isCyclesLoading } = useProjectCycles(projectId);
  const cycles = useMemo(() => cyclesData?.cycles || [], [cyclesData]);

  const { projects } = useWorkspaceProjects(workspaceId || "");
  const projectData = useMemo(() => projects?.find((p: any) => p._id === projectId), [projects, projectId]);

  const createMutation = useCreateCycle();
  const updateMutation = useUpdateCycle();
  const deleteMutation = useDeleteCycle();

  const isLoading = isCyclesLoading;

  const getGroupedCycles = (searchTerm: string) => {
    const filtered = cycles.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped: Record<DerivedStatus, Cycle[]> = {
      active: [],
      upcoming: [],
      completed: [],
    };

    filtered.forEach((cycle) => {
      grouped[deriveStatus(cycle)].push(cycle);
    });

    return grouped;
  };

  const checkParallelConflict = (start: string, end: string, excludeId?: string) => {
    if (projectData?.parallel_cycles_enabled) return false;
    if (!start || !end) return false;

    const proposedStart = parseDateOnly(start);
    const proposedEnd = parseDateOnly(end);
    if (!proposedStart || !proposedEnd) return false;

    return cycles.some((cycle) => {
      if (cycle._id === excludeId) return false;
      if (cycle.status === "completed" || cycle.status === "cancelled") return false;

      const cycleStart = parseDateOnly(cycle.startDate);
      const cycleEnd = parseDateOnly(cycle.endDate);
      if (!cycleStart || !cycleEnd) return false;

      return rangesOverlap(proposedStart, proposedEnd, cycleStart, cycleEnd);
    });
  };

  const isCycleReadOnly = (cycle: Cycle | null) => {
    if (!cycle) return false;
    return deriveStatus(cycle) === "completed";
  };

  return {
    cycles,
    projectData,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    getGroupedCycles,
    checkParallelConflict,
    isCycleReadOnly,
  };
}
