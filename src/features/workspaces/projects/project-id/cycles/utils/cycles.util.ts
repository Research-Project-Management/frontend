import type { Cycle } from '../types/cycle.types';

export type DerivedStatus = "active" | "planned" | "completed";

/**
 * Derives the effective status of a cycle for grouping.
 * Strictly Manual based on the 'status' field, with fallback to date calculation.
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
 * Groups cycles into Active, Planned, and Completed sections with optional search filter.
 */
export const groupCyclesByStatus = (
  cycles: Cycle[],
  searchTerm: string = ''
): { active: Cycle[]; upcoming: Cycle[]; completed: Cycle[] } => {
  const term = searchTerm.toLowerCase().trim();
  const filtered = term
    ? cycles.filter((c) => c.name.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term))
    : cycles;

  const active: Cycle[] = [];
  const upcoming: Cycle[] = [];
  const completed: Cycle[] = [];

  filtered.forEach((cycle) => {
    const status = deriveStatus(cycle);
    if (status === 'active') active.push(cycle);
    else if (status === 'completed') completed.push(cycle);
    else upcoming.push(cycle);
  });

  return { active, upcoming, completed };
};
