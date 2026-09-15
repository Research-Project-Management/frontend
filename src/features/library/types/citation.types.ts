import { z } from 'zod';
import {
  cslStyleSchema,
  formattedCitationSchema,
  formatCitationInputSchema,
  formatBatchCitationInputSchema,
  resolveQueryInputSchema,
  batchResolveQueryInputSchema,
  itemBundleSchema,
} from '../schemas/citation.schema';
import { Provenance } from './items.types';

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
