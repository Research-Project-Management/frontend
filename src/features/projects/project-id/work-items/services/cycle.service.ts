import { apiGet } from "@/shared/lib/api";
import type { Cycle } from "../types/work-item.types";

export const CycleService = {
  getCycles: async (_projectId: string): Promise<{ cycles: Cycle[] }> => ({ cycles: [] }),
};
