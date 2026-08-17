/**
 * chat.schema.ts
 *
 * Zod Schemas and inferred TypeScript types for Editor AI assistant interactions.
 */

import { z } from 'zod';

export const promptInputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt cannot be empty')
    .max(10000, 'Prompt is too long'),
});

export type PromptInput = z.infer<typeof promptInputSchema>;

export const chatSessionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Session title is required')
    .max(150, 'Title is too long'),
});

export type ChatSessionInput = z.infer<typeof chatSessionSchema>;
