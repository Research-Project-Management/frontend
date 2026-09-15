import { z } from 'zod';
import {
  annotationTypeSchema,
  rectCoordsSchema,
  pdfAnnotationSchema,
  createAnnotationSchema,
  updateAnnotationSchema,
  batchDeleteAnnotationsSchema,
} from '../schemas/annotation.schema';

export type AnnotationType = z.infer<typeof annotationTypeSchema>;
export type RectCoords = z.infer<typeof rectCoordsSchema>;
export type PdfAnnotation = z.infer<typeof pdfAnnotationSchema>;

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
export type BatchDeleteAnnotationsInput = z.infer<
  typeof batchDeleteAnnotationsSchema
>;
