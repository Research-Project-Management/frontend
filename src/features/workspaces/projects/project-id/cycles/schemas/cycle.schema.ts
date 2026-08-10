import { z } from "zod";

export const CyclePhaseSchema = z.string();

export const CycleStatusSchema = z.enum(["planned", "active", "completed", "cancelled"]);

export const CycleMilestoneSchema = z.object({
  _id: z.string().optional(),
  title: z.string(),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean(),
});

export const CycleDeliverableSchema = z.object({
  _id: z.string().optional(),
  title: z.string(),
  fileId: z.object({
    _id: z.string(),
    filename: z.string(),
    url: z.string(),
  }).nullable().optional(),
  completed: z.boolean(),
});

export const CycleSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string(),
  project: z.string(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: CycleStatusSchema,
  phase: CyclePhaseSchema,
  milestones: z.array(CycleMilestoneSchema),
  deliverables: z.array(CycleDeliverableSchema),
  labels: z.array(z.string()).optional(),
  author: z.object({
    _id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
  }).nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
