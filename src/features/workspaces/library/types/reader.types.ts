import { z } from 'zod';
import {
  readerAnnotationSchema,
  annotationRectSchema,
  readerPanelSchema,
  readerNavPanelSchema,
  readerSettingsSchema,
  selectionContextSchema,
} from '../schemas/reader.schema';
import type { Paper, Collection } from './library.types';
import type { ChatMessage, ChatSession, SourceItem } from './ai.types';

// ── Inferred Types ────────────────────────────────────────────────────────────

export type ReaderAnnotation = z.infer<typeof readerAnnotationSchema>;
export type AnnotationRect = z.infer<typeof annotationRectSchema>;
export type ReaderPanel = z.infer<typeof readerPanelSchema>;
export type ReaderNavPanel = z.infer<typeof readerNavPanelSchema>;
export type ReaderSettings = z.infer<typeof readerSettingsSchema>;
export type SelectionContext = z.infer<typeof selectionContextSchema>;

// ── PDF Outline & Navigation Types ────────────────────────────────────────────

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
  paper: Paper | null;
  collection: Collection | null;
  pdfBlobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  fitMode: 'fit-width' | 'fit-page' | 'auto' | 'custom';
  activePanel: ReaderPanel | null;
  panelWidth: number;
  annotations: ReaderAnnotation[];
  selectionContext: string | null;
}
