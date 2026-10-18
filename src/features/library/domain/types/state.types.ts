import { z } from 'zod';

export const readStatusSchema = z.enum(['unread', 'reading', 'completed']);

export const itemStateSchema = z.object({
  isStarred: z.boolean().optional().default(false),
  readStatus: readStatusSchema.default('unread'),
  rating: z.number().min(0).max(5).default(0),
  lastOpenedAt: z.string().nullable().optional(),
  lastReadAt: z.string().nullable().optional(),
  currentPage: z.number().optional(),
  scrollPosition: z.unknown().optional(),
});

export type ReadStatus = z.infer<typeof readStatusSchema>;
export type ItemStateData = z.infer<typeof itemStateSchema>;

