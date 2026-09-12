import { z } from "zod";

export const taskLabelSchema = z.object({
  id: z.string(),
  color: z.string(),
  title: z.string(),
});

export const labelSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional(),
    description: z.string().nullable().optional(),
    type: z.string().optional(),
    parentId: z.string().nullable().optional(),
    sortOrder: z.number().optional(),
    projectId: z.string().optional(),
    workspaceId: z.string().optional(),
    parent: z.object({ id: z.string(), name: z.string(), color: z.string().optional() }).nullable().optional(),
    children: z.array(labelSchema).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
);

export const createLabelSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  type: z.string().optional(),
  projectId: z.string().optional(),
});

export const updateLabelSchema = z.object({
  labelId: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  projectId: z.string().optional(),
});

export const labelFormSchema = z.object({
  name: z.string().min(1, "Label title is required").max(60, "Label title must be less than 60 characters"),
  color: z.string(),
});
export type LabelFormSchema = z.infer<typeof labelFormSchema>;


// ── Backward-compatible Aliases ──────────────────────────────────────────────

export const TaskLabelSchema = taskLabelSchema;
export const LabelSchema = labelSchema;
