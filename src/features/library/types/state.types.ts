import { z } from 'zod';

export const readStatusSchema = z.enum(['unread', 'reading', 'completed']);

export const itemStateSchema = z.object({
  readStatus: readStatusSchema.default('unread'),
  rating: z.number().min(0).max(5).default(0),
  lastReadAt: z.string().nullable().optional(),
});

export const itemStateResponseSchema = z.object({
  success: z.boolean().default(true),
  data: itemStateSchema,
});

export const batchItemStateResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.record(z.string(), itemStateSchema),
});

export const updateItemStateSchema = z.object({
  readStatus: readStatusSchema.optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const itemStateDataSchema = itemStateSchema;
export const userItemStateSchema = itemStateSchema;

export type ReadStatus = z.infer<typeof readStatusSchema>;
export type ItemStateData = z.infer<typeof itemStateSchema>;
export type UserItemStateData = ItemStateData;

export type UpdateItemStateInput = z.infer<typeof updateItemStateSchema>;
export type ItemStateResponse = z.infer<typeof itemStateResponseSchema>;
export type BatchItemStateResponse = z.infer<typeof batchItemStateResponseSchema>;
