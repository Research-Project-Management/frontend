import { z } from 'zod';
import { userSchema } from './item.schema';

export const annotationTypeSchema = z.enum([
  'highlight',
  'underline',
  'note',
  'box',
]);

export const rectCoordsSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});

export const pdfAnnotationSchema = z.object({
  id: z.string().optional().default(''),
  attachmentId: z.string().optional(),
  itemId: z.string().optional(),
  paperId: z.string().optional(),
  userId: z.string().optional(),
  authorId: z.string().optional(),
  author: userSchema.optional(),
  type: annotationTypeSchema.optional().default('highlight'),
  color: z.string().default('#ffeb3b'),
  pageIndex: z.number().int().optional().default(0),
  pageNumber: z.number().int().optional().default(1),
  quote: z.string().nullable().optional(),
  quoteText: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  rectCoords: z.record(z.string(), z.unknown()).optional(),
  rect: rectCoordsSchema.optional(),
  version: z.number().optional().default(1),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export const createAnnotationSchema = z.object({
  attachmentId: z.string(),
  type: annotationTypeSchema.optional().default('highlight'),
  pageIndex: z.number().int().min(0),
  color: z.string().optional().default('#ffeb3b'),
  quoteText: z.string().optional(),
  comment: z.string().optional(),
  rectCoords: rectCoordsSchema.optional(),
});

export const updateAnnotationSchema = z.object({
  color: z.string().optional(),
  comment: z.string().optional(),
});

export const batchDeleteAnnotationsSchema = z.object({
  annotationIds: z.array(z.string()),
});
