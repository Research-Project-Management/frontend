import { z } from 'zod';

export const noteSchema = z.object({
  id: z.string().optional().default(''),
  scopeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  title: z.string().optional().default('Untitled Note'),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  contentMd: z.string().optional().default(''),
  content: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  version: z.number().optional().default(1),
  createdById: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const noteResponseSchema = z.object({
  success: z.boolean().default(true),
  data: noteSchema,
});

export const noteListResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(noteSchema),
});

export const createNoteSchema = z.object({
  projectId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
  title: z.string().optional().default('Untitled Note'),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  contentMd: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
});

export const updateNoteSchema = z.object({
  title: z.string().optional(),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  contentMd: z.string().optional(),
  tags: z.array(z.string()).optional(),
  version: z.number().int().optional(),
  expectedVersion: z.number().int().optional(),
});

export type Note = z.input<typeof noteSchema> & {
  id: string;
};
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteResponse = z.infer<typeof noteResponseSchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
