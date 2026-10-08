/**
 * forms.types.ts
 *
 * Unified validation schemas and form value types for the Editor subsystem
 * (Modals, Wizards, Topbar menus, and Project settings).
 *
 * Location: `features/editor/domain/types/forms.types.ts`
 * Follows the single source of truth standard (Zod schema + z.infer types).
 */

import { z } from 'zod';

// ── File Management & Import Modals ──────────────────────────────────────────

export const newFileModalSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(128, 'File name is too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'File name cannot contain invalid characters (<>:"/\\|?*)'),
});

export type NewFileModalFormValues = z.infer<typeof newFileModalSchema>;

export const urlImportModalSchema = z.object({
  url: z.string().trim().url('Please enter a valid HTTP/HTTPS URL'),
  fileName: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(128, 'File name is too long'),
});

export type UrlImportModalFormValues = z.infer<typeof urlImportModalSchema>;

export const libraryBibtexModalSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'BibTeX file name is required')
    .max(128, 'File name is too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid file name'),
});

export type LibraryBibtexModalFormValues = z.infer<typeof libraryBibtexModalSchema>;

// ── Figure & Media Wizard ───────────────────────────────────────────────────

export const figureWizardSchema = z.object({
  selectedFilename: z.string().min(1, 'Please select or upload an image'),
  caption: z.string().default('Figure caption'),
  label: z.string().default('fig:my_figure'),
  width: z.string().default('0.8\\linewidth'),
  placement: z.string().default('htbp'),
  centering: z.boolean().default(true),
});

export type FigureWizardFormValues = z.infer<typeof figureWizardSchema>;

// ── Table Matrix Wizard ─────────────────────────────────────────────────────

export const tableWizardSchema = z.object({
  tableStyle: z.enum(['booktabs', 'bordered', 'minimal']).default('booktabs'),
  defaultAlign: z.enum(['l', 'c', 'r']).default('c'),
  caption: z.string().default('Summary of results'),
  label: z.string().default('tab:results'),
  placement: z.string().default('htbp'),
  centering: z.boolean().default(true),
  firstRowIsHeader: z.boolean().default(true),
});

export type TableWizardFormValues = z.infer<typeof tableWizardSchema>;

// ── GitHub & Git Sync ───────────────────────────────────────────────────────

export const pushChangesSchema = z.object({
  commitMessage: z.string().trim().min(1, 'Commit message is required'),
  targetBranch: z.string().trim().min(1, 'Branch is required'),
});

export type PushChangesFormValues = z.infer<typeof pushChangesSchema>;

export const linkRepoSchema = z.object({
  selectedRepo: z.string().min(1, 'Please select a repository'),
  targetBranch: z.string().trim().min(1, 'Branch is required'),
});

export type LinkRepoFormValues = z.infer<typeof linkRepoSchema>;

export const createRepoSchema = z.object({
  newRepoName: z
    .string()
    .trim()
    .min(1, 'Repository name is required')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, hyphens, and underscores are allowed'),
  newRepoPrivate: z.boolean(),
});

export type CreateRepoFormValues = z.infer<typeof createRepoSchema>;

// ── Project Settings & Spelling ─────────────────────────────────────────────

export const learnedWordSchema = z.object({
  word: z
    .string()
    .trim()
    .min(1, 'Word cannot be empty')
    .max(64, 'Word is too long')
    .regex(/^[\p{L}\p{N}_\-']+$/u, 'Invalid word characters'),
});

export type LearnedWordFormValues = z.infer<typeof learnedWordSchema>;

// ── Topbar / Project Identity ───────────────────────────────────────────────

export const projectRenameSchema = z.object({
  name: z.string().trim().min(1, 'Project name cannot be empty').max(150, 'Project name is too long'),
});

export type ProjectRenameInput = z.infer<typeof projectRenameSchema>;

export const projectCopySchema = z.object({
  name: z.string().trim().min(1, 'Copy name cannot be empty').max(150, 'Copy name is too long'),
});

export type ProjectCopyInput = z.infer<typeof projectCopySchema>;
