import { paperKeys, getAllPapers as getPapers, getPaperById, getPaperAcademicBundle, updatePaper, deletePaper } from './paper.service';
import { collectionKeys, getCollections, createCollection, updateCollection, deleteCollection } from './collection.service';
import { formatCslCitation, batchFormatCslCitations, resolveAcademicQuery } from './reference.service';
import { getAnnotations, createAnnotation, deleteAnnotation, extractNotesFromAnnotations } from './annotation.service';
import { getRelatedPapers, linkPapers, unlinkPapers, getWorkspaceKnowledgeGraph } from './relation.service';
import { getDuplicateGroups, mergePapers, getLibraryIntegrityReport } from './quality.service';
import { createAsyncBatchJob, getAsyncJobStatus } from './ingestion.service';
import type { CslStyle, PaperQueryParams } from '../types/library.types';

// ── 0. Canonical API Base & Route Builders ───────────────────────────────────

export const getCanonicalLibraryBasePath = (workspaceId: string) =>
  `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library`;

// ── 1. TanStack Query Cache Keys ─────────────────────────────────────────────

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
  citationItem: (wsId: string, paperId: string, style: CslStyle, index: number = 1) =>
    [...libraryKeys.citations(wsId), paperId, style, index] as const,

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

export {
  paperKeys,
  collectionKeys,
  getPapers,
  getPaperById,
  getPaperAcademicBundle,
  updatePaper,
  deletePaper,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  formatCslCitation,
  batchFormatCslCitations,
  resolveAcademicQuery,
  getAnnotations,
  createAnnotation,
  deleteAnnotation,
  extractNotesFromAnnotations,
  getRelatedPapers,
  linkPapers,
  unlinkPapers,
  getWorkspaceKnowledgeGraph,
  getDuplicateGroups,
  mergePapers,
  getLibraryIntegrityReport,
  createAsyncBatchJob,
  getAsyncJobStatus,
};
