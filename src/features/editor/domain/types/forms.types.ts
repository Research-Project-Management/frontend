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
    .regex(/^[^<>:"\\|?*]+$/, 'File name cannot contain invalid characters (<>:"\\|?*)')
    .refine(
      (val) =>
        val.split('/').every((seg) => {
          const s = seg.trim();
          return s.length > 0 && s !== '.' && s !== '..';
        }),
      'File path cannot contain empty segments or relative traversal (.) / (..)',
    ),
});

export type NewFileModalFormValues = z.infer<typeof newFileModalSchema>;

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
  caption: z.string(),
  label: z.string(),
  width: z.string(),
  angle: z.string(),
  placement: z.string(),
  centering: z.boolean(),
});

export type FigureWizardFormValues = z.infer<typeof figureWizardSchema>;

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

// ── Topbar / Project Identity ───────────────────────────────────────────────

export const projectRenameSchema = z.object({
  name: z.string().trim().min(1, 'Project name cannot be empty').max(150, 'Project name is too long'),
});

export type ProjectRenameInput = z.infer<typeof projectRenameSchema>;
