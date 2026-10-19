/**
 * Master Library Types Registry (Frontend)
 *
 * Domain-Driven Modular architecture re-exporting canonical types
 * aligned 100% with Backend Prisma models and NestJS DTOs.
 */

// Matt Pocock Branded Types
declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type ItemId = Brand<string, 'ItemId'>;
export type CollectionId = Brand<string, 'CollectionId'>;
export type NoteId = Brand<string, 'NoteId'>;
export type ScopeId = Brand<string, 'ScopeId'>;
export type UserId = Brand<string, 'UserId'>;
export type ProjectId = Brand<string, 'ProjectId'>;

// Domain Type Re-Exports
export * from './core.types';
export * from './items.types';
export * from './collections.types';
export * from './tags.types';
export * from './attachments.types';
export * from './notes.types';
export * from './state.types';
export * from './citation.types';
export * from './curation.types';
export * from './search.types';
export * from './saved-searches.types';
export * from './retraction.types';
export * from './ingestion.types';
export * from './item-types.types';
export * from './relations.types';
export * from './forms.types';
export * from './feeds.types';
export type {
  ReaderDocument,
  ReaderAnnotation,
  ReaderNote,
  AnnotationFormData,
  TypeConversionPreview,
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
} from './reader.types';
export {
  annotationRectSchema,
  annotationTypeSchema,
  readerAnnotationSchema,
  createAnnotationSchema,
  updateAnnotationSchema,
  readerNoteSchema,
  readerDocumentSchema,
  documentReadingStateSchema,
  documentSectionSchema,
  documentFigureSchema,
  documentTableSchema,
  documentFormulaSchema,
  documentReferenceSchema,
  documentFulltextSchema,
  annotationFormSchema,
} from './reader.schema';

// Utility Generic Result
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

