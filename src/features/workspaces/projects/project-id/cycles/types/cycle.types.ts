import { z } from "zod";
import {
  cyclePhaseSchema,
  cycleStatusSchema,
  cycleMilestoneSchema,
  cycleDeliverableSchema,
  cycleSchema,
  createCycleInputSchema,
  updateCycleInputSchema,
} from "../schemas/cycle.schema";


export type CyclePhase = z.infer<typeof cyclePhaseSchema>;
export type CycleStatus = z.infer<typeof cycleStatusSchema>;
export type CycleMilestone = z.infer<typeof cycleMilestoneSchema>;
export type CycleDeliverable = z.infer<typeof cycleDeliverableSchema>;
export type Cycle = z.infer<typeof cycleSchema>;
export type CreateCycleInput = z.infer<typeof createCycleInputSchema>;
export type UpdateCycleInput = z.infer<typeof updateCycleInputSchema>;

export type CycleFilter = "all" | "active" | "completed" | "planned" | "cancelled";
