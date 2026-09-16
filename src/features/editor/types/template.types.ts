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

export interface CreateTemplateInput {
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  content?: unknown;
  files?: Record<string, string>;
  isSystem?: boolean;
}

export interface ApplyTemplateInput {
  title?: string;
}

export interface SaveAsTemplateInput {
  name: string;
  description?: string;
  category?: string;
}
