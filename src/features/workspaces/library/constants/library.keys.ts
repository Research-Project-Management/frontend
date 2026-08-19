import type { PaperQueryParams, CslStyle } from '../types/library.types';

export const libraryKeys = {
  all: ['library'] as const,

  // Papers
  papers: (wsId: string) => [...libraryKeys.all, 'papers', wsId] as const,
  paperList: (wsId: string, filter?: PaperQueryParams) =>
    [...libraryKeys.papers(wsId), 'list', filter] as const,
  paperDetail: (wsId: string, paperId: string) =>
    [...libraryKeys.papers(wsId), 'detail', paperId] as const,
  paperBundle: (wsId: string, paperId: string) =>
    [...libraryKeys.papers(wsId), 'bundle', paperId] as const,

  // Collections
  collections: (wsId: string) =>
    [...libraryKeys.all, 'collections', wsId] as const,

  // Citations & Formats
  citations: (wsId: string) =>
    [...libraryKeys.all, 'citations', wsId] as const,
  citationItem: (wsId: string, paperId: string, style: CslStyle) =>
    [...libraryKeys.citations(wsId), paperId, style] as const,

  // Annotations
  annotations: (wsId: string, paperId: string) =>
    [...libraryKeys.all, 'annotations', wsId, paperId] as const,

  // Relations & Graph
  relations: (wsId: string, paperId: string) =>
    [...libraryKeys.all, 'relations', wsId, paperId] as const,
  graph: (wsId: string) => [...libraryKeys.all, 'graph', wsId] as const,

  // Quality & Diagnostics
  duplicates: (wsId: string) =>
    [...libraryKeys.all, 'duplicates', wsId] as const,
  integrity: (wsId: string) =>
    [...libraryKeys.all, 'integrity', wsId] as const,

  // Ingestion Jobs
  job: (jobId: string) => [...libraryKeys.all, 'job', jobId] as const,
};
