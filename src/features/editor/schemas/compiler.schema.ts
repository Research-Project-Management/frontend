/**
 * compiler.schema.ts
 *
 * Zod schemas for compiler requests, incremental sync, and diagnostics.
 * Matches backend document/compiler module DTOs.
 */

import { z } from 'zod';

export const compilerEngineSchema = z.enum(['pdflatex', 'xelatex', 'lualatex', 'typst']);

export const compileLatexSchema = z.object({
  projectId: z.string().optional(),
  pageId: z.string().optional(),
  mainFile: z.string().optional(),
  source: z.string().optional(),
  engine: compilerEngineSchema.optional(),
  draft: z.boolean().optional(),
  useCache: z.boolean().optional(),
  files: z.record(z.string(), z.string()).optional(),
});

export type CompileLatexInput = z.infer<typeof compileLatexSchema>;

export const wordCountSchema = z.object({
  source: z.string().min(1, 'Source content is required for word count'),
  pageId: z.string().optional(),
  projectId: z.string().optional(),
});

export type WordCountInput = z.infer<typeof wordCountSchema>;

export const syncIncrementalSchema = z.object({
  dirtyFileIds: z.array(z.string()).optional(),
  forceAll: z.boolean().optional(),
  projectId: z.string().optional(),
});

export type SyncIncrementalInput = z.infer<typeof syncIncrementalSchema>;

export const saveAndSyncSchema = z.object({
  title: z.string().optional(),
  content: z.any().optional(),
  createSnapshot: z.boolean().optional(),
  versionDescription: z.string().optional(),
});

export type SaveAndSyncInput = z.infer<typeof saveAndSyncSchema>;

export const compileDocumentSchema = z.object({
  engine: compilerEngineSchema.optional(),
  source: z.string().optional(),
  documentClass: z.string().optional(),
});

export type CompileDocumentInput = z.infer<typeof compileDocumentSchema>;
