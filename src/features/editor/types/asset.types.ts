/**
 * asset.types.ts
 *
 * Types for document attachments, figures, images, and binary assets.
 * Matches backend document/asset module.
 */

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

// Derived directly from Zod schemas (Single Source of Truth)
export type { UploadAssetInput } from '../schemas/asset.schema';

export interface AssetInfo {
  id?: string;
  url?: string;
  filename: string;
  size?: number;
  mimeType?: string;
}
