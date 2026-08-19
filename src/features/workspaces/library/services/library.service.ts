import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type {
  Paper,
  PaperAcademicBundle,
  FormattedCitation,
  CslStyle,
  PdfAnnotation,
  RelatedPaperItem,
  WorkspaceKnowledgeGraph,
  DuplicateGroup,
  LibraryIntegrityReport,
  AsyncIngestionJob,
  PaperQueryParams,
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from '../types/library.types';

// ── 1. Unified Academic Facade ───────────────────────────────────────────────

export const getPaperAcademicBundle = async (
  workspaceId: string,
  paperId: string,
): Promise<PaperAcademicBundle> => {
  return apiGet<PaperAcademicBundle>(
    `/api/library/${encodeURIComponent(workspaceId)}/papers/${encodeURIComponent(paperId)}/bundle`,
  );
};

// ── 2. Master Papers & Smart Filters ─────────────────────────────────────────

export const getPapers = async (
  workspaceId: string,
  query?: PaperQueryParams,
): Promise<{ papers: Paper[]; total: number }> => {
  return apiGet<{ papers: Paper[]; total: number }>(
    `/api/library/papers/${encodeURIComponent(workspaceId)}`,
    { params: query as any },
  );
};

export const getPaperById = async (
  workspaceId: string,
  paperId: string,
): Promise<{ paper: Paper }> => {
  return apiGet<{ paper: Paper }>(
    `/api/library/papers/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
  );
};

export const updatePaper = async (
  workspaceId: string,
  paperId: string,
  data: Partial<Paper>,
): Promise<{ paper: Paper }> => {
  return apiPut<{ paper: Paper }>(
    `/api/library/papers/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
    data,
  );
};

export const deletePaper = async (
  workspaceId: string,
  paperId: string,
): Promise<{ message: string }> => {
  return apiDelete<{ message: string }>(
    `/api/library/papers/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
  );
};

// ── 3. Collections & Hierarchical Folders ────────────────────────────────────

export const getCollections = async (
  workspaceId: string,
): Promise<Collection[]> => {
  return apiGet<Collection[]>(
    `/api/library/collections/${encodeURIComponent(workspaceId)}`,
  );
};

export const createCollection = async (
  workspaceId: string,
  dto: CreateCollectionDTO,
): Promise<Collection> => {
  return apiPost<Collection>(
    `/api/library/collections/${encodeURIComponent(workspaceId)}`,
    dto,
  );
};

export const updateCollection = async (
  workspaceId: string,
  collectionId: string,
  dto: UpdateCollectionDTO,
): Promise<Collection> => {
  return apiPut<Collection>(
    `/api/library/collections/${encodeURIComponent(workspaceId)}/${encodeURIComponent(collectionId)}`,
    dto,
  );
};

export const deleteCollection = async (
  workspaceId: string,
  collectionId: string,
  strategy?: 'move-to-parent' | 'orphan' | 'cascade',
): Promise<{ message: string }> => {
  return apiDelete<{ message: string }>(
    `/api/library/collections/${encodeURIComponent(workspaceId)}/${encodeURIComponent(collectionId)}`,
    { params: { strategy } },
  );
};

export const exportCollectionBundle = async (
  workspaceId: string,
  collectionId: string,
): Promise<{
  collection: { id: string; name: string };
  totalPapers: number;
  totalFiles: number;
  bibtex: string;
  files: Array<{ paperId: string; title: string; filename: string; fileUrl: string }>;
}> => {
  return apiGet(
    `/api/library/collections/${encodeURIComponent(workspaceId)}/${encodeURIComponent(collectionId)}/export-bundle`,
  );
};

// ── 4. CSL Citation Formatter & Multi-Source Resolvers ───────────────────────

export const formatCslCitation = async (
  workspaceId: string,
  paperId: string,
  style: CslStyle = 'apa',
  index: number = 1,
): Promise<FormattedCitation> => {
  return apiGet<FormattedCitation>(
    `/api/library/references/${encodeURIComponent(workspaceId)}/papers/${encodeURIComponent(paperId)}/citation`,
    { params: { style, index } },
  );
};

export const batchFormatCslCitations = async (
  workspaceId: string,
  paperIds: string[],
  style: CslStyle = 'apa',
): Promise<{
  style: CslStyle;
  total: number;
  citations: Array<{ paperId: string; citation: FormattedCitation }>;
}> => {
  return apiPost(
    `/api/library/references/${encodeURIComponent(workspaceId)}/citations/batch`,
    { paperIds, style },
  );
};

export const resolveAcademicQuery = async (
  query: string,
): Promise<any> => {
  return apiGet('/api/library/references/resolve', { params: { query } });
};

// ── 5. PDF Annotations & Markdown Synthesis ─────────────────────────────────

export const getAnnotations = async (
  workspaceId: string,
  paperId: string,
): Promise<{ annotations: PdfAnnotation[]; total: number }> => {
  return apiGet(
    `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
  );
};

export const createAnnotation = async (
  workspaceId: string,
  paperId: string,
  dto: Partial<PdfAnnotation>,
): Promise<PdfAnnotation> => {
  return apiPost(
    `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
    dto,
  );
};

export const deleteAnnotation = async (
  workspaceId: string,
  paperId: string,
  annotationId: string,
): Promise<{ message: string }> => {
  return apiDelete(
    `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/${encodeURIComponent(annotationId)}`,
  );
};

export const extractNotesFromAnnotations = async (
  workspaceId: string,
  paperId: string,
): Promise<{ message: string; markdownNote: string; totalExtracted: number }> => {
  return apiPost(
    `/api/library/annotations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/extract-notes`,
  );
};

// ── 6. Related Items & Knowledge Graph ──────────────────────────────────────

export const getRelatedPapers = async (
  workspaceId: string,
  paperId: string,
): Promise<{ relatedPapers: RelatedPaperItem[]; total: number }> => {
  return apiGet(
    `/api/library/relations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}`,
  );
};

export const linkPapers = async (
  workspaceId: string,
  paperId: string,
  targetPaperId: string,
  relationType: string = 'related',
): Promise<{ message: string; relationType: string }> => {
  return apiPost(
    `/api/library/relations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/link`,
    { targetPaperId, relationType },
  );
};

export const unlinkPapers = async (
  workspaceId: string,
  paperId: string,
  targetPaperId: string,
): Promise<{ message: string }> => {
  return apiDelete(
    `/api/library/relations/${encodeURIComponent(workspaceId)}/${encodeURIComponent(paperId)}/link/${encodeURIComponent(targetPaperId)}`,
  );
};

export const getWorkspaceKnowledgeGraph = async (
  workspaceId: string,
): Promise<WorkspaceKnowledgeGraph> => {
  return apiGet<WorkspaceKnowledgeGraph>(
    `/api/library/relations/${encodeURIComponent(workspaceId)}/graph`,
  );
};

// ── 7. Quality, Duplicates & Safe Merge ─────────────────────────────────────

export const getDuplicateGroups = async (
  workspaceId: string,
): Promise<{ duplicateGroups: DuplicateGroup[]; totalDuplicates: number }> => {
  return apiGet(
    `/api/library/quality/${encodeURIComponent(workspaceId)}/duplicates`,
  );
};

export const mergePapers = async (
  workspaceId: string,
  masterPaperId: string,
  sourcePaperIds: string[],
): Promise<{
  message: string;
  masterPaper: Paper;
  mergedCount: number;
  softDeletedPaperIds: string[];
}> => {
  return apiPost(
    `/api/library/quality/${encodeURIComponent(workspaceId)}/merge`,
    { masterPaperId, sourcePaperIds },
  );
};

export const getLibraryIntegrityReport = async (
  workspaceId: string,
): Promise<LibraryIntegrityReport> => {
  return apiGet<LibraryIntegrityReport>(
    `/api/library/quality/${encodeURIComponent(workspaceId)}/integrity`,
  );
};

// ── 8. Batch Ingestion & Job Tracker ────────────────────────────────────────

export const createAsyncBatchJob = async (
  workspaceId: string,
  items: Array<{ sourceType: string; fileUrl?: string; doi?: string; bibtex?: string; title?: string }>,
): Promise<{ jobId: string; status: string; total: number }> => {
  return apiPost('/api/library/ingest/batch-async', {
    workspaceId,
    items: items.map((i) => ({ ...i, workspaceId })),
  });
};

export const getAsyncJobStatus = async (
  jobId: string,
): Promise<AsyncIngestionJob> => {
  return apiGet<AsyncIngestionJob>(
    `/api/library/ingest/jobs/${encodeURIComponent(jobId)}`,
  );
};
