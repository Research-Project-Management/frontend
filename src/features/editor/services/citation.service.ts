/**
 * citation.service.ts
 *
 * Frontend service for DOI, CrossRef, and reference lookups.
 */

import { apiGet } from '@/shared/lib/api';

export type CrossrefWork = {
  title: string;
  authors: string[];
  editors?: string[];
  doi: string;
  journal: string;
  publicationTitle?: string;
  publicationDate?: string;
  publisher: string;
  place?: string;
  issn: string;
  isbn: string;
  volume: string;
  issue: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  pages: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  year: number | string;
  type: string;
  itemType?: string;
  abstract: string;
  url: string;
  score: number;
  language?: string;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  license?: string;
  libraryCatalog?: string;
  keywords?: string[];
  pmid?: string;
  pmcid?: string;
  extra?: string;
};

export async function fetchLookupDoi(doi: string) {
  const cleanDoi = encodeURIComponent(doi);
  return apiGet<{ work: CrossrefWork }>(`/api/v1/library/references/doi/${cleanDoi}`);
}

export async function fetchSearchCrossref(query: string, rows = 1) {
  const cleanQuery = encodeURIComponent(query);
  return apiGet<{ works: CrossrefWork[]; totalResults: number }>(
    `/api/v1/library/references/crossref/search?query=${cleanQuery}&rows=${rows}`,
  );
}

export const citationService = {
  fetchLookupDoi,
  fetchSearchCrossref,
};

export const DocumentCitationService = citationService;
