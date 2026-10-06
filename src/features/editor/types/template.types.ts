/**
 * template.types.ts
 *
 * Types for document starters, academic paper templates, and custom presets.
 * Matches backend document/template module.
 */

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

// Derived directly from Zod schemas (Single Source of Truth)
export type {
  CreateTemplateInput,
  ApplyTemplateInput,
  SaveAsTemplateInput,
} from '../schemas/template.schema';
