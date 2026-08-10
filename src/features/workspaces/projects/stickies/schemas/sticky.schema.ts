import { z } from "zod";

export const StickyLabelSchema = z.object({
  _id: z.string(),
  id: z.string(),
  name: z.string(),
  color: z.string(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  type: z.string().optional(),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
  }).optional(),
  updatedAt: z.string().optional(),
});

export const StickyColorSchema = z.enum([
  "cyan-1", "cyan-2", "mint-1", "mint-2", "yellow-1", 
  "lavender-1", "pink-1", "purple-1", "default", 
  "yellow", "green", "blue", "pink", "purple"
]);

export const StickySchema = z.object({
  _id: z.string(),
  id: z.string().optional(),
  title: z.string().optional(),
  content: z.string(),
  color: StickyColorSchema,
  labels: z.array(StickyLabelSchema).optional(),
  scope: z.enum(["workspace", "project"]).optional(),
  category: z.enum(["sticky", "note"]).optional(),
  workspaceId: z.union([z.string(), z.object({ _id: z.string(), name: z.string().optional() })]).optional(),
  projectId: z.union([z.string(), z.object({ _id: z.string(), name: z.string().optional() })]).optional(),
  authorId: z.union([z.string(), z.object({ id: z.string().optional(), _id: z.string().optional(), name: z.string().optional(), avatar: z.string().optional() })]).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const StickyChildLinkSchema = z.object({
  _id: z.string(),
  sticky: StickySchema,
  note: StickySchema.optional(),
  projectId: z.union([z.string(), z.object({ _id: z.string(), name: z.string() })]).optional(),
  authorId: z.union([z.string(), z.object({ _id: z.string(), name: z.string(), avatar: z.string().optional() })]).optional(),
});

// Request/Response Schemas
export const StickyListResponseSchema = z.object({
  stickies: z.array(StickySchema),
});

export const StickyChildrenResponseSchema = z.object({
  children: z.array(StickyChildLinkSchema),
});

export const CreateStickyPayloadSchema = StickySchema.omit({ _id: true, createdAt: true, updatedAt: true }).partial({ color: true, content: true });
export const UpdateStickyPayloadSchema = StickySchema.partial();
