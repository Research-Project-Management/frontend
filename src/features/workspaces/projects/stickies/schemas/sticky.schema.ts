import { z } from "zod";

export const StickyColorSchema = z.enum([
  "cyan-1", "cyan-2", "mint-1", "mint-2", 
  "yellow-1", "lavender-1", "pink-1", "purple-1"
]);

export const StickySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  content: z.string(),
  color: StickyColorSchema,
  projectId: z.string().optional(),
  scope: z.literal("workspace").optional(),
  workspaceId: z.union([z.string(), z.object({ id: z.string(), name: z.string().optional() })]).optional(),
  userId: z.union([z.string(), z.object({ id: z.string().optional(), name: z.string().optional(), avatar: z.string().optional() })]).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  order: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Request/Response Schemas
export const StickyListResponseSchema = z.object({
  stickies: z.array(StickySchema),
});

export const CreateStickyPayloadSchema = StickySchema.omit({ id: true, createdAt: true, updatedAt: true }).partial({ color: true, content: true });
export const UpdateStickyPayloadSchema = StickySchema.partial();
