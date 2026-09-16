/**
 * template.schema.ts
 *
 * Zod validation schemas for Document Starters and LaTeX Templates.
 * Matches backend document/template module DTOs.
 */

import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  slug: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  thumbnail: z.string().optional(),
  content: z.any().optional(),
  files: z.record(z.string(), z.string()).optional(),
  isSystem: z.boolean().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const applyTemplateSchema = z.object({
  title: z.string().optional(),
});

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

export const saveAsTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.string().default('custom').optional(),
});

export type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>;
