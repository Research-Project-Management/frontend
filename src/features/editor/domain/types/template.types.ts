/**
 * template.types.ts
 *
 * Types and validation schemas for document starters, academic paper templates, and custom presets.
 * Matches backend document/template module.
 */

import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required'),
  description: z.string().trim().optional(),
  category: z.string().optional(),
  thumbnail: z.string().url().optional(),
  files: z.record(z.string(), z.string()).optional(),
  isSystem: z.boolean().default(false).optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const applyTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  targetPageId: z.string().optional(),
});

export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;

export const saveAsTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required'),
  description: z.string().trim().optional(),
  category: z.string().optional(),
});

export type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>;

export interface DocumentTemplate {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  content?: unknown;
  files?: Record<string, string>;
  isSystem?: boolean;
}
