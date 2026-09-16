/**
 * asset.schema.ts
 *
 * Zod validation schemas for Document Asset and file uploads.
 * Matches backend document/asset module DTOs.
 */

import { z } from 'zod';

export const uploadAssetSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentBase64: z.string().min(1, 'Base64 content is required'),
  mimeType: z.string().optional(),
  path: z.string().optional(),
  parentPageId: z.string().uuid().optional(),
});

export type UploadAssetInput = z.infer<typeof uploadAssetSchema>;
