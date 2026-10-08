/**
 * asset.types.ts
 *
 * Types and validation schemas for document attachments, figures, images, and binary assets.
 * Matches backend document/asset module.
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

export interface DocumentAssetItem {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64?: string;
  projectId: string;
  parentPageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetInfo {
  id?: string;
  url?: string;
  filename: string;
  size?: number;
  mimeType?: string;
}
