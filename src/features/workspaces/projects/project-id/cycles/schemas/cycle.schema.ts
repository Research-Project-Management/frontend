import { z } from "zod";

export const cyclePhaseSchema = z.string();

export const cycleStatusSchema = z.enum(["planned", "active", "completed", "cancelled"]);

export const cycleMilestoneSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  dueDate: z.string().nullable().optional(),
  completed: z.boolean(),
});

export const cycleDeliverableSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  fileId: z
    .object({
      id: z.string(),
      filename: z.string(),
      url: z.string(),
    })
    .nullable()
    .optional(),
  completed: z.boolean(),
});

export const cycleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  projectId: z.string().optional(),
  project: z.union([z.string(), z.object({ id: z.string().optional(), name: z.string().optional() })]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: cycleStatusSchema.optional(),
  phase: cyclePhaseSchema.optional(),
  milestones: z.array(cycleMilestoneSchema).optional(),
  deliverables: z.array(cycleDeliverableSchema).optional(),
  labels: z.array(z.string()).optional(),
  tasks: z.array(z.any()).optional(),
  authorId: z.string().optional(),
  author: z
    .object({
      id: z.string(),
      name: z.string(),
      avatar: z.string().optional(),
    })
    .nullable()
    .optional(),
  statsAtCompletion: z.any().optional(),
  endedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});


export const createCycleInputSchema = cycleSchema.omit({
  id: true,
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
