/**
 * history.schema.ts
 *
 * Zod validation schemas for Document Versioning, Snapshots, and History tracking.
 * Matches backend document/history module DTOs.
 */

import { z } from 'zod';

export const versionEventTypeSchema = z.enum([
  'manual_save',
  'auto_save',
  'file_created',
  'file_deleted',
  'asset_uploaded',
  'asset_deleted',
]);

export const createVersionSchema = z.object({
  title: z.string().trim().optional(),
  content: z.string().optional(),
  label: z.string().trim().max(100).optional(),
  eventType: versionEventTypeSchema.optional(),
  fileName: z.string().optional(),
  projectPageId: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const createSnapshotSchema = z.object({
  label: z.string().trim().max(100, 'Label too long').optional(),
});

export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;
