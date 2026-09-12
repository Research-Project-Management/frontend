import { z } from 'zod';
import {
  UnifiedIngestionPayloadSchema,
  UnifiedIngestionDataSchema,
  UnifiedIngestionResponseSchema,
  IngestionRunSnapshotDataSchema,
  IngestionRunSnapshotResponseSchema,
  UrlCapturePreviewDataSchema,
  UrlCapturePreviewResponseSchema,
  DoiIngestionPayloadSchema,
  UrlIngestionPayloadSchema,
  BibtexIngestionPayloadSchema,
  PdfIngestionPayloadSchema,
  ArxivIngestionPayloadSchema,
  PmidIngestionPayloadSchema,
  IsbnIngestionPayloadSchema,
  RisIngestionPayloadSchema,
  ZoteroIngestionPayloadSchema,
} from '../schemas/ingestion.schema';

export type UnifiedIngestionPayload = z.infer<
  typeof UnifiedIngestionPayloadSchema
>;
export type UnifiedIngestionData = z.infer<typeof UnifiedIngestionDataSchema>;
export type UnifiedIngestionResponse = z.infer<
  typeof UnifiedIngestionResponseSchema
>;

export type IngestionRunSnapshotData = z.infer<
  typeof IngestionRunSnapshotDataSchema
>;
export type IngestionRunSnapshotResponse = z.infer<
  typeof IngestionRunSnapshotResponseSchema
>;

export type UrlCapturePreviewData = z.infer<typeof UrlCapturePreviewDataSchema>;
export type UrlCapturePreviewResponse = z.infer<
  typeof UrlCapturePreviewResponseSchema
>;

export type DoiIngestionPayload = z.infer<typeof DoiIngestionPayloadSchema>;
export type UrlIngestionPayload = z.infer<typeof UrlIngestionPayloadSchema>;
export type BibtexIngestionPayload = z.infer<typeof BibtexIngestionPayloadSchema>;
export type PdfIngestionPayload = z.infer<typeof PdfIngestionPayloadSchema>;
export type ArxivIngestionPayload = z.infer<typeof ArxivIngestionPayloadSchema>;
export type PmidIngestionPayload = z.infer<typeof PmidIngestionPayloadSchema>;
export type IsbnIngestionPayload = z.infer<typeof IsbnIngestionPayloadSchema>;
export type RisIngestionPayload = z.infer<typeof RisIngestionPayloadSchema>;
export type ZoteroIngestionPayload = z.infer<typeof ZoteroIngestionPayloadSchema>;

export interface IngestItemDTO {
  source?: 'upload' | 'storage' | 'identifier' | 'doi' | 'bibtex' | 'ris' | 'manual';
  sourceType?: 'DOI' | 'IDENTIFIER' | 'BIBTEX' | 'RIS' | 'PDF' | 'STORAGE' | 'MANUAL';
  workspaceId?: string;
  fileId?: string | null;
  storageFileId?: string | null;
  collectionId?: string | null;
  title?: string;
  filename?: string;
  fileUrl?: string;
  size?: number;
  mimeType?: string;
  authors?: string[];
  year?: number | null;
  doi?: string;
  query?: string;
  bibtex?: string;
  ris?: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
  isbn?: string;
  url?: string;
  abstract?: string;
  itemType?: string;
  tags?: string[];
  notes?: Record<string, unknown>[];
  citationKey?: string;
  primaryFile?: {
    fileId?: string | null;
    filename: string;
    url: string;
    size?: number;
    mimeType?: string;
  };
}
