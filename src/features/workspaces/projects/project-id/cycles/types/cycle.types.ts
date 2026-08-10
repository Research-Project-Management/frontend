import { z } from "zod";
import {
  CyclePhaseSchema,
  CycleStatusSchema,
  CycleMilestoneSchema,
  CycleDeliverableSchema,
  CycleSchema,
} from "../schemas/cycle.schema";

export type CyclePhase = z.infer<typeof CyclePhaseSchema>;
export type CycleStatus = z.infer<typeof CycleStatusSchema>;
export type CycleMilestone = z.infer<typeof CycleMilestoneSchema>;
export type CycleDeliverable = z.infer<typeof CycleDeliverableSchema>;
export type Cycle = z.infer<typeof CycleSchema>;
