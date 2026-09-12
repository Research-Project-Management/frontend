import { z } from "zod";

// ── Prisma & Backend DTO Enums ───────────────────────────────────────────────
export const cycleStatusSchema = z.enum([
  "planned",
  "active",
  "completed",
  "cancelled",
]);
export type CycleStatus = z.infer<typeof cycleStatusSchema>;

export const cyclePhaseSchema = z.enum([
  "custom",
  "discovery",
  "sprint",
  "hardening",
]).or(z.string());
export type CyclePhase = z.infer<typeof cyclePhaseSchema>;

export const incompleteTaskActionSchema = z.enum([
  "transfer",
  "backlog",
  "leave",
]);
export type IncompleteTaskAction = z.infer<typeof incompleteTaskActionSchema>;

// ── Create Cycle DTO Schema (Matches CreateCycleDto) ─────────────────────────
export const createCycleDtoSchema = z.object({
  name: z.string().trim().min(1, "Cycle name is required").max(255, "Name is too long"),
  description: z.string().max(2000, "Description is too long").optional(),
  startDate: z.union([z.string(), z.date()]).nullable().optional(),
  endDate: z.union([z.string(), z.date()]).nullable().optional(),
  status: cycleStatusSchema.optional().default("planned"),
  phase: cyclePhaseSchema.optional().default("custom"),
  projectId: z.string().optional(),
});
export type CreateCycleDtoInput = z.infer<typeof createCycleDtoSchema>;

// ── Update Cycle DTO Schema (Matches UpdateCycleDto) ─────────────────────────
export const updateCycleDtoSchema = createCycleDtoSchema.partial();
export type UpdateCycleDtoInput = z.infer<typeof updateCycleDtoSchema>;

// ── Complete Cycle DTO Schema (Matches CompleteCycleDto) ─────────────────────
export const completeCycleDtoSchema = z.object({
  action: incompleteTaskActionSchema,
  targetCycleId: z.string().optional(),
  projectId: z.string().optional(),
});
export type CompleteCycleDtoInput = z.infer<typeof completeCycleDtoSchema>;

// ── Add Cycle Tasks Batch DTO Schema (Matches AddCycleTasksBatchDto) ─────────
export const addCycleTasksBatchDtoSchema = z.object({
  taskIds: z.array(z.string()).min(1, "WorkItem IDs array is required"),
});
export type AddCycleTasksBatchDtoInput = z.infer<typeof addCycleTasksBatchDtoSchema>;

// ── Deliverables & Milestones Schemas (Feature compatibility) ───────────────
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

// ── Full Cycle Entity Schema ────────────────────────────────────────────────
export const cycleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  projectId: z.string().optional(),
  project: z
    .union([z.string(), z.object({ id: z.string().optional(), name: z.string().optional() })])
    .optional(),
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

// Backward compatibility schema aliases
export const createCycleInputSchema = cycleSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial({
    description: true,
    startDate: true,
    endDate: true,
    milestones: true,
    deliverables: true,
    labels: true,
    author: true,
  });

export const updateCycleInputSchema = createCycleInputSchema.partial();

// ── UI Form Schema ──────────────────────────────────────────────────────────
export const cycleFormSchema = z.object({
  name: z.string().trim().min(1, "Cycle name is required"),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  phase: z.string(),
  status: cycleStatusSchema,
  labels: z.array(z.string()),
});
export type CycleFormData = z.infer<typeof cycleFormSchema>;
