import { z } from 'zod';
import {
  annotationRectSchema,
  annotationTypeSchema,
  readerAnnotationSchema,
  createAnnotationSchema,
  updateAnnotationSchema,
  readerPanelSchema,
  readerNavPanelSchema,
  readerFitModeSchema,
  readerViewModeSchema,
  readerRotationSchema,
  readerSettingsSchema,
  selectionContextSchema,
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
  readerAiCitationSchema,
  readerAiMessageRoleSchema,
  readerAiMessageSchema,
  readerQuickPromptSchema,
  readerPaperContextSchema,
  documentRenameFormSchema,
  noteFormSchema,
  annotationFormSchema,
  chatMessageFormSchema,
  pageNavFormSchema,
  documentBoundingBoxSchema,
  documentSectionSchema,
  documentFigureSchema,
  documentTableSchema,
  documentFormulaSchema,
  documentFulltextSchema,
} from '../schemas/reader.schema';

declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type DocumentId = Brand<string, 'DocumentId'>;
export type AnnotationId = Brand<string, 'AnnotationId'>;
export type NoteId = Brand<string, 'NoteId'>;
export type CollectionId = Brand<string, 'CollectionId'>;
export type AttachmentId = Brand<string, 'AttachmentId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;

export const toDocumentId = (id: string): DocumentId => id as DocumentId;
export const toAnnotationId = (id: string): AnnotationId => id as AnnotationId;
export const toNoteId = (id: string): NoteId => id as NoteId;
export const toCollectionId = (id: string): CollectionId => id as CollectionId;
export const toAttachmentId = (id: string): AttachmentId => id as AttachmentId;
export const toWorkspaceId = (id: string): WorkspaceId => id as WorkspaceId;

export type AnnotationRect = z.infer<typeof annotationRectSchema>;
export type AnnotationType = z.infer<typeof annotationTypeSchema>;
export type ReaderAnnotation = z.infer<typeof readerAnnotationSchema>;
export type CreateAnnotationDto = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationDto = z.infer<typeof updateAnnotationSchema>;

export type ReaderPanel = z.infer<typeof readerPanelSchema>;
export type ReaderNavPanel = z.infer<typeof readerNavPanelSchema>;
export type ReaderFitMode = z.infer<typeof readerFitModeSchema>;
export type ReaderViewMode = z.infer<typeof readerViewModeSchema>;
export type ReaderRotation = z.infer<typeof readerRotationSchema>;
export type ReaderSettings = z.infer<typeof readerSettingsSchema>;
export type SelectionContext = z.infer<typeof selectionContextSchema>;

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

export type ReaderAiCitation = z.infer<typeof readerAiCitationSchema>;
export type ReaderAiMessageRole = z.infer<typeof readerAiMessageRoleSchema>;
export type ReaderAiMessage = z.infer<typeof readerAiMessageSchema>;
export type ReaderQuickPrompt = z.infer<typeof readerQuickPromptSchema>;
export type ReaderPaperContext = z.infer<typeof readerPaperContextSchema>;

export type DocumentRenameFormData = z.infer<typeof documentRenameFormSchema>;
export type NoteFormData = z.infer<typeof noteFormSchema>;
export type AnnotationFormData = z.infer<typeof annotationFormSchema>;
export type ChatMessageFormData = z.infer<typeof chatMessageFormSchema>;
export type PageNavFormData = z.infer<typeof pageNavFormSchema>;

export type DocumentBoundingBox = z.infer<typeof documentBoundingBoxSchema>;
export type DocumentSection = z.infer<typeof documentSectionSchema>;
export type DocumentFigure = z.infer<typeof documentFigureSchema>;
export type DocumentTable = z.infer<typeof documentTableSchema>;
export type DocumentFormula = z.infer<typeof documentFormulaSchema>;
export type DocumentFulltext = z.infer<typeof documentFulltextSchema>;

export interface StreamPaperOptions {
  selection?: {
    text: string;
    pageNumber: number;
  };
  chatId?: string;
  onCitation?: (citations: ReaderAiCitation[]) => void;
  signal?: AbortSignal;
}

export interface PdfOutlineItem {
  title: string;
  pageNumber: number;
  dest?: unknown;
  items?: PdfOutlineItem[];
}

export interface PdfThumbnail {
  pageNumber: number;
  src?: string;
  aspectRatio: number;
}

export interface ReaderState {
  paper: ReaderDocument | null;
  collection?: ReaderCollection | null;
  pdfBlobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  fitMode: ReaderFitMode;
  activePanel: ReaderPanel | null;
  panelWidth: number;
  annotations: ReaderAnnotation[];
  selectionContext: string | null;
}

export type CatalogItem = ReaderDocument;
export type Collection = ReaderCollection;
export type Note = ReaderNote;
export type PdfAnnotation = ReaderAnnotation;
export type CopilotCitation = ReaderAiCitation;
export type CopilotMessage = ReaderAiMessage;
export type QuickPrompt = ReaderQuickPrompt;
export type CopilotPaperContext = ReaderPaperContext;
