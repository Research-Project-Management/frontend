import { z } from "zod";

export const entityTypeSchema = z.enum([
  "work_item",
  "comment",
  "page",
  "sticky",
  "project",
]);
export type EntityType = z.infer<typeof entityTypeSchema>;

// ── Create Attachment DTO Schema (Matches CreateAttachmentDto) ───────────────
export const createAttachmentDtoSchema = z.object({
  filename: z.string().optional(),
  name: z.string().optional(),
  url: z.string().min(1, "URL is required"),
  storageKey: z.string().optional(),
  size: z.number().int().min(0).optional().default(0),
  mimeType: z.string().optional().default("application/octet-stream"),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type CreateAttachmentDtoInput = z.infer<typeof createAttachmentDtoSchema>;

// ── Presign Attachment DTO Schema (Matches PresignAttachmentDto) ─────────────
export const presignAttachmentDtoSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  entityType: entityTypeSchema.default("work_item"),
  entityId: z.string().min(1, "Entity ID is required"),
  contentType: z.string().optional(),
  size: z.number().int().min(1).optional(),
  projectId: z.string().optional(),
});
export type PresignAttachmentDtoInput = z.infer<typeof presignAttachmentDtoSchema>;
