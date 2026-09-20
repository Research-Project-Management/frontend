import { z } from 'zod';
import { itemSchema, Provenance } from './items.types';
import { relatedItemSchema } from './relations.types';

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
  citationApa: formattedCitationSchema.optional(),
  citationIeee: formattedCitationSchema.optional(),
  annotations: z.array(z.record(z.string(), z.unknown())).default([]),
  totalAnnotations: z.number().default(0),
  relatedPapers: z.array(relatedItemSchema).default([]),
  relatedItems: z.array(relatedItemSchema).optional().default([]),
  totalRelatedPapers: z.number().default(0),
  totalRelatedItems: z.number().optional().default(0),
});

export const paperAcademicBundleSchema = itemBundleSchema;

export type CslStyle = z.infer<typeof cslStyleSchema>;
export type FormattedCitation = z.infer<typeof formattedCitationSchema>;
export type FormatCitationInput = z.infer<typeof formatCitationInputSchema>;
export type FormatBatchCitationInput = z.infer<
  typeof formatBatchCitationInputSchema
>;
export type ResolveQueryInput = z.infer<typeof resolveQueryInputSchema>;
export type BatchResolveQueryInput = z.infer<typeof batchResolveQueryInputSchema>;

export type ItemBundle = z.infer<typeof itemBundleSchema>;
/** @deprecated Use ItemBundle */
export type PaperAcademicBundle = ItemBundle;

export interface ReferenceData {
  extraFields?: Record<string, unknown>;
  title: string;
  authors?: string[];
  creators?: Array<{
    creatorType?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  }>;
  editors?: string[];
  doi?: string;
  arxivId?: string;
  pmid?: string;
  pmcid?: string;
  journal?: string;
  publicationTitle?: string;
  publicationDate?: string;
  publisher?: string;
  place?: string;
  issn?: string;
  isbn?: string;
  volume?: string;
  issue?: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  pages?: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  year?: number | string;
  type?: string;
  itemType?: string;
  abstract?: string;
  url?: string;
  openAccessPdfUrl?: string;
  isOpenAccess?: boolean;
  citationCount?: number | string | null;
  score?: number;
  language?: string;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  license?: string;
  libraryCatalog?: string;
  keywords?: string[];
  tags?: string[];
  fieldsOfStudy?: string[];
  provenance?: Provenance | Record<string, unknown> | null;
  extra?: string;
  [key: string]: unknown;
}
