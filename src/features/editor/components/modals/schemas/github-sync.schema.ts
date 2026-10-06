import { z } from 'zod';

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
