import { z } from 'zod';
import { Provenance } from './items.types';

export const cslStyleSchema = z.string().min(1);

export const cslStyleMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  titleShort: z.string().optional(),
  category: z.string(),
  fields: z.array(z.string()).optional(),
  updated: z.string().optional(),
  isCustom: z.boolean().optional(),
});

export type CslStyleMetadata = z.infer<typeof cslStyleMetadataSchema>;

export interface StyleSummary {
  id: string;
  name: string;
  shortTitle?: string;
  category?: string;
  isPrimary?: boolean;
}

export const formattedCitationSchema = z.object({
  style: cslStyleSchema.optional(),
  styleId: z.string().optional(),
  inText: z.string(),
  bibliography: z.string(),
  citation: z.string().optional(),
  html: z.string().optional(),
  bibliographyHtml: z.string().optional(),
  source: z.enum(['publisher', 'csl-engine']).optional(),
});

export type CslStyle = z.infer<typeof cslStyleSchema>;
export type FormattedCitation = z.infer<typeof formattedCitationSchema>;

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
