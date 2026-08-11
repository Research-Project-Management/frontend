import { z } from "zod";

export const storageActionSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  parentId: z.string().optional().nullable(),
});
