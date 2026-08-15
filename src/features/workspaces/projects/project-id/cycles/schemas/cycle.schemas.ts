import { z } from "zod";

export const cyclePhaseSchema = z.string();

export const cycleStatusSchema = z.enum(["planned", "active", "completed", "cancelled"]);

export const cycleMilestoneSchema = z.object({
  _id: z.string().optional(),
  title: z.string(),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean(),
});

export const cycleDeliverableSchema = z.object({
  _id: z.string().optional(),
  title: z.string(),
  fileId: z
    .object({
      _id: z.string(),
      filename: z.string(),
      url: z.string(),
    })
    .nullable()
    .optional(),
  completed: z.boolean(),
});

export const cycleSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string(),
  project: z.string(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: cycleStatusSchema,
  phase: cyclePhaseSchema,
  milestones: z.array(cycleMilestoneSchema),
  deliverables: z.array(cycleDeliverableSchema),
  labels: z.array(z.string()).optional(),
  author: z
    .object({
      _id: z.string(),
      name: z.string(),
      avatar: z.string().optional(),
    })
    .nullable()
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createCycleInputSchema = cycleSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  description: true,
  startDate: true,
  endDate: true,
  milestones: true,
  deliverables: true,
  labels: true,
  author: true,
});

export const updateCycleInputSchema = createCycleInputSchema.partial();
