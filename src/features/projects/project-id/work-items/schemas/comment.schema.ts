import { z } from "zod";

// ── Create Comment DTO Schema (Matches CreateCommentDto) ─────────────────────
export const createCommentDtoSchema = z.object({
  content: z.string().trim().min(1, "Comment content is required"),
  projectId: z.string().optional(),
  attachments: z.array(z.any()).optional(),
});
export type CreateCommentDtoInput = z.infer<typeof createCommentDtoSchema>;

// ── Update Comment DTO Schema (Matches UpdateCommentDto) ─────────────────────
export const updateCommentDtoSchema = z.object({
  content: z.string().trim().min(1, "Comment content is required").optional(),
  projectId: z.string().optional(),
  attachments: z.array(z.any()).optional(),
});
export type UpdateCommentDtoInput = z.infer<typeof updateCommentDtoSchema>;

// ── Add Reply DTO Schema (Matches AddReplyDto) ───────────────────────────────
export const addReplyDtoSchema = z.object({
  content: z.string().trim().min(1, "Reply content is required"),
  projectId: z.string().optional(),
});
export type AddReplyDtoInput = z.infer<typeof addReplyDtoSchema>;

// ── React Comment DTO Schema (Matches ReactCommentDto) ───────────────────────
export const reactCommentDtoSchema = z.object({
  emoji: z.string().min(1, "Emoji is required"),
  projectId: z.string().optional(),
});
export type ReactCommentDtoInput = z.infer<typeof reactCommentDtoSchema>;
