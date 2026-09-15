import { z } from 'zod';
import { itemSchema } from './item.schema';
import { pdfAnnotationSchema } from './annotation.schema';
import { relatedItemSchema } from './relation.schema';

export const cslStyleSchema = z.enum([
  'apa',
  'apa-7th',
  'ieee',
  'nature',
  'harvard',
  'chicago',
  'chicago-author-date',
  'mla',
  'mla-9th',
  'vancouver',
  'bibtex',
  'ris',
]);

export const formattedCitationSchema = z.object({
  style: cslStyleSchema.optional(),
  styleId: z.string().optional(),
  inText: z.string(),
  bibliography: z.string(),
  html: z.string().optional(),
  bibliographyHtml: z.string().optional(),
  source: z.enum(['publisher', 'csl-engine']).optional(),
});

export const formatCitationInputSchema = z.object({
  item: z.record(z.string(), z.unknown()),
  styleId: cslStyleSchema.optional().default('apa'),
});

export const formatBatchCitationInputSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  styleId: cslStyleSchema.optional().default('apa'),
});

export const resolveQueryInputSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  doi: z.string().optional(),
});

export const batchResolveQueryInputSchema = z.object({
  queries: z.array(z.string()).min(1, 'At least one query is required'),
});

export const itemBundleSchema = z.object({
  item: itemSchema.optional(),
  paper: itemSchema.optional(),
  citationApa: formattedCitationSchema,
  citationIeee: formattedCitationSchema,
  annotations: z.array(pdfAnnotationSchema).default([]),
  totalAnnotations: z.number().default(0),
  relatedPapers: z.array(relatedItemSchema).default([]),
  relatedItems: z.array(relatedItemSchema).optional().default([]),
  totalRelatedPapers: z.number().default(0),
  totalRelatedItems: z.number().optional().default(0),
});

export const paperAcademicBundleSchema = itemBundleSchema;
