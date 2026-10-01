import { z } from 'zod';

export const annotationRectSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  width: z.number(),
  height: z.number(),
});

export const annotationTypeSchema = z.enum([
  'highlight',
  'underline',
  'note',
  'rect',
  'box',
  'area',
  'image',
  'text',
]);

export const libraryAnnotationSchema = z.object({
  id: z.string(),
  paperId: z.string().optional(),
  attachmentId: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  pageIndex: z.number().int().nonnegative().optional(),
  annotationSortIndex: z.string().nullable().optional(),
  color: z.string().default('yellow'),
  type: annotationTypeSchema.default('highlight'),
  text: z.string().optional(),
  quoteText: z.string().optional(),
  comment: z.string().optional(),
  rects: z.array(annotationRectSchema).optional(),
  boundingRect: annotationRectSchema.optional(),
  rectCoords: z.unknown().optional(),
  tags: z.array(z.string()).default([]),
  version: z.number().optional(),
  authorId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type AnnotationRect = z.infer<typeof annotationRectSchema>;
export type AnnotationType = z.infer<typeof annotationTypeSchema>;
export type LibraryAnnotation = z.infer<typeof libraryAnnotationSchema>;
export type ReaderAnnotation = LibraryAnnotation;

export interface CreateAnnotationDTO {
  type?: AnnotationType;
  pageIndex: number;
  y?: number;
  x?: number;
  color?: string;
  quoteText?: string;
  comment?: string;
  tags?: string[];
  rectCoords?: unknown;
  rects?: unknown;
  boundingRect?: unknown;
}

export interface UpdateAnnotationDTO {
  color?: string;
  quoteText?: string;
  comment?: string;
  tags?: string[];
  rectCoords?: unknown;
  rects?: unknown;
  boundingRect?: unknown;
  expectedVersion?: number;
}

export interface UpsertBatchItem {
  id?: string;
  type?: AnnotationType;
  pageIndex: number;
  y?: number;
  x?: number;
  color?: string;
  quoteText?: string;
  comment?: string;
  tags?: string[];
  rectCoords?: unknown;
  rects?: unknown;
  boundingRect?: unknown;
  expectedVersion?: number;
}

export interface BatchAnnotationsDTO {
  upserts: UpsertBatchItem[];
  deletes: string[];
}

export interface BatchAnnotationsResponse {
  created: LibraryAnnotation[];
  updated: LibraryAnnotation[];
  deleted: string[];
}
