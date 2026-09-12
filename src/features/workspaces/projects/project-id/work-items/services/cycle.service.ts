import { apiGet } from "@/shared/lib/api";
import type { Cycle } from "../types/work-item.types";

export const CycleService = {
  getCycles: (projectId: string) =>
    apiGet<{ cycles: Cycle[] } | Cycle[]>(`/api/projects/${projectId}/cycles`),
};
