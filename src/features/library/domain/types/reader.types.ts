import { z } from 'zod';
import {
  annotationRectSchema,
  annotationTypeSchema,
  readerAnnotationSchema,
  createAnnotationSchema,
  updateAnnotationSchema,
  readerPanelSchema,
  readerFitModeSchema,
  readerThemeSchema,
  creatorTypeSchema,
  documentCreatorSchema,
  documentAttachmentSchema,
  primaryFileSchema,
  documentReadingStateSchema,
  documentTagSchema,
  readerNoteSchema,
  createNoteSchema,
  updateNoteSchema,
  readerCollectionSchema,
  readerDocumentSchema,
  updateDocumentSchema,
  annotationFormSchema,
  documentBoundingBoxSchema,
  documentSectionSchema,
  documentFigureSchema,
  documentTableSchema,
  documentFormulaSchema,
  documentReferenceSchema,
  documentFulltextSchema,
} from './reader.schema';

export type AnnotationRect = z.infer<typeof annotationRectSchema>;
export type AnnotationType = z.infer<typeof annotationTypeSchema>;
export type ReaderAnnotation = z.infer<typeof readerAnnotationSchema>;
export type CreateAnnotationDto = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationDto = z.infer<typeof updateAnnotationSchema>;

export type ReaderPanel = z.infer<typeof readerPanelSchema>;
export type ReaderFitMode = z.infer<typeof readerFitModeSchema>;
export type ReaderTheme = z.infer<typeof readerThemeSchema>;

export type CreatorType = z.infer<typeof creatorTypeSchema>;
export type DocumentCreator = z.infer<typeof documentCreatorSchema>;
export type DocumentAttachment = z.infer<typeof documentAttachmentSchema>;
export type PrimaryDocumentFile = z.infer<typeof primaryFileSchema>;

export type ReaderNote = z.infer<typeof readerNoteSchema>;
export type CreateNoteDto = z.infer<typeof createNoteSchema>;
export type UpdateNoteDto = z.infer<typeof updateNoteSchema>;
export type ReaderCollection = z.infer<typeof readerCollectionSchema>;

export type DocumentReadingState = z.infer<typeof documentReadingStateSchema>;
export type DocumentTag = z.infer<typeof documentTagSchema>;
export type ReaderDocument = z.infer<typeof readerDocumentSchema>;
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;

export type AnnotationFormData = z.infer<typeof annotationFormSchema>;

export type DocumentBoundingBox = z.infer<typeof documentBoundingBoxSchema>;
export type DocumentSection = z.infer<typeof documentSectionSchema>;
export type DocumentFigure = z.infer<typeof documentFigureSchema>;
export type DocumentTable = z.infer<typeof documentTableSchema>;
export type DocumentFormula = z.infer<typeof documentFormulaSchema>;
export type DocumentReference = z.infer<typeof documentReferenceSchema>;
export type DocumentFulltext = z.infer<typeof documentFulltextSchema>;

export interface PdfOutlineItem {
  title: string;
  pageNumber: number;
  dest?: unknown;
  items?: PdfOutlineItem[];
}

export interface ReaderNavigationTarget {
  pageNumber: number;
  annotationId?: string;
  coords?: AnnotationRect;
  timestamp: number;
}

export type {
  ItemFieldDefinition,
  SchemaFieldDefinition,
  SchemaItemTypeDefinition,
} from './item-types.types';

export interface DroppedField {
  field: string;
  label: string;
  value: unknown;
}

export interface FieldMappingChange {
  fromField: string;
  toField: string;
  value: unknown;
  rule: 'direct' | 'base-semantic' | 'special-rule';
}

export interface CreatorRoleChange {
  creator: Record<string, unknown>;
  fromRole: string;
  toRole: string;
  reason: 'preserved' | 'primary-fallback' | 'secondary-fallback';
}

export interface TypeConversionPreview {
  sourceType: string;
  targetType: string;
  preservedFields: string[];
  mappedFields?: FieldMappingChange[];
  remappedFields?: unknown[];
  droppedFields: DroppedField[];
  creatorChanges?: CreatorRoleChange[];
  preservedCreators?: unknown[];
  remappedCreators?: unknown[];
  newAvailableFields?: Array<
    | string
    | {
        field: string;
        label: string;
        category?: string;
        type?: string;
      }
  >;
  schemaUnsupportedFields?: string[];
  schemaUnsupportedFieldLabels?: string[];
  projectedItem?: Record<string, unknown>;
  unmappedRetained?: Record<string, unknown>;
  hasLoss?: boolean;
}

export interface ItemMetadataSourceItem {
  id: string;
  sourceProvider: string;
  sourceUri?: string | null;
  format?: string | null;
  fetchedAt: string;
  createdAt?: string;
  doi?: string;
  rawPayload?: Record<string, unknown> | unknown;
}

export interface ItemMetadataSourcesResponse {
  itemId?: string;
  count?: number;
  sources: ItemMetadataSourceItem[];
}
