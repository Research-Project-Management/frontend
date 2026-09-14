import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Cycle, CreateCycleInput, UpdateCycleInput } from "../types/cycle.types";

export const CycleService = {
  getProjectCycles: (projectId: string) =>
    apiGet<{ cycles: Cycle[] }>(`/api/project/${projectId}/cycles`),

  getCycle: (cycleId: string) =>
    apiGet<{ cycle: Cycle }>(`/api/cycles/${cycleId}`),

  create: ({ projectId, ...data }: { projectId: string } & Partial<CreateCycleInput>) =>
    apiPost<{ cycle?: Cycle }>(`/api/project/${projectId}/cycles`, data),

  update: ({ cycleId, ...data }: { cycleId: string; projectId?: string } & Partial<UpdateCycleInput>) =>
    apiPut<{ cycle?: Cycle }>(`/api/cycles/${cycleId}`, data),

  delete: ({ cycleId }: { cycleId: string; projectId?: string }) =>
    apiDelete<void>(`/api/cycles/${cycleId}`),

  restore: (cycleId: string) =>
    apiPost<{ cycle?: Cycle }>(`/api/cycles/${cycleId}/restore`),

  complete: ({
    cycleId,
    action,
    targetCycleId,
  }: {
    cycleId: string;
    action: 'transfer' | 'backlog' | 'leave';
    targetCycleId?: string;
  }) =>
    apiPost<{ cycle: Cycle; transferredCount: number; message: string }>(
      `/api/cycles/${cycleId}/complete`,
      { action, targetCycleId },
    ),

  getBurndown: (cycleId: string) =>
    apiGet<unknown>(`/api/cycles/${cycleId}/burndown`),

  getVelocity: (cycleId: string) =>
    apiGet<unknown>(`/api/cycles/${cycleId}/velocity`),

  getProgress: (cycleId: string) =>
    apiGet<unknown>(`/api/cycles/${cycleId}/progress`),

  addWorkItemsBatch: (cycleId: string, itemIds: string[]) =>
    apiPost<{ message: string; count: number }>(`/api/cycles/${cycleId}/work-items/batch`, { itemIds, workItemIds: itemIds }),

  autoTransition: (projectId: string) =>
    apiPost<{ startedCycle: Cycle | null; completedCycle: Cycle | null }>(`/api/projects/${projectId}/cycles/auto-transition`),
};
