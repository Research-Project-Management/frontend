/**
 * settings.schema.ts
 *
 * Zod Schemas for Editor Preferences & Compiler configuration.
 */

import { z } from 'zod';

export const editorSettingsSchema = z.object({
  fontSize: z.number().min(10).max(32),
  wordWrap: z.boolean(),
  lineNumbers: z.boolean(),
  minimap: z.boolean(),
  theme: z.string(),
  autoCompile: z.boolean(),
  compileMode: z.enum(['full', 'draft']),
  engine: z.enum(['pdflatex', 'xelatex', 'lualatex']),
  mainFile: z.string().min(1, 'Main file is required'),
});

export type EditorSettingsInput = z.infer<typeof editorSettingsSchema>;
