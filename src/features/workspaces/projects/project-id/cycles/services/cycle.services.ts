import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Cycle, CreateCycleInput, UpdateCycleInput } from "../types/cycle.types";

export const CycleService = {
  getProjectCycles: (projectId: string) =>
    apiGet<{ cycles: Cycle[] }>(`/api/project/${projectId}/cycles`),

  create: ({ projectId, ...data }: { projectId: string } & Partial<CreateCycleInput>) =>
    apiPost<{ cycle?: Cycle }>(`/api/project/${projectId}/cycles`, data),

  update: ({ cycleId, ...data }: { cycleId: string; projectId?: string } & Partial<UpdateCycleInput>) =>
    apiPut<{ cycle?: Cycle }>(`/api/cycles/${cycleId}`, data),

  delete: ({ cycleId }: { cycleId: string; projectId?: string }) =>
    apiDelete<void>(`/api/cycles/${cycleId}`),
};
