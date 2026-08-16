import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Collection, Paper, PaperAttachment } from "@/features/workspaces/library/types/library.types";

export const paperKeys = {
  all: (workspaceId: string) => ["papers", workspaceId] as const,
  byId: (workspaceId: string, paperId: string) => ["papers", workspaceId, paperId] as const,
  byCollection: (workspaceId: string, collectionId: string) => [
    "papers",
    workspaceId,
    collectionId,
  ] as const,
};

// ── Unified Academic Ingestion Seam ─────────────────────────────────────────

export const ingestPaper = (
  workspaceId: string,
  data: {
    source?: "upload" | "storage" | "identifier";
    fileId?: string | null;
    collectionId?: string | null;
    title?: string;
    filename?: string;
    fileUrl?: string;
    size?: number;
    mimeType?: string;
    authors?: string[];
    year?: number | null;
    doi?: string;
    citationKey?: string;
  }
) => apiPost<{ paper: Paper }>(`/api/library/papers/${workspaceId}/ingest`, data);

// ── Standard Paper Operations ───────────────────────────────────────────────

export const getAllPapers = (workspaceId: string) =>
  apiGet<{ papers: Paper[] }>(`/api/library/papers/${workspaceId}`);

export const getPaperById = (workspaceId: string, paperId: string) =>
  apiGet<{ paper: Paper }>(`/api/library/papers/${workspaceId}/${paperId}`);

export const getCollectionPapers = (workspaceId: string, collectionId: string) =>
  apiGet<{ collection: Collection; papers: Paper[] }>(
    `/api/library/${workspaceId}/collections/${collectionId}/papers`
  );

export const createPaper = (workspaceId: string, collectionId: string, data: Partial<Paper>) =>
  apiPost<{ paper: Paper }>(`/api/library/${workspaceId}/collections/${collectionId}/papers`, data);

export const updatePaper = (workspaceId: string, paperId: string, data: Partial<Paper>) =>
  apiPut<{ paper: Paper }>(`/api/library/papers/${workspaceId}/${paperId}`, data);

export const deletePaper = (workspaceId: string, paperId: string) =>
  apiDelete(`/api/library/papers/${workspaceId}/${paperId}`);

export const addPaperAttachment = (
  workspaceId: string,
  paperId: string,
  data: Partial<PaperAttachment>
) =>
  apiPost<{ paper: Paper }>(
    `/api/library/papers/${workspaceId}/${paperId}/attachments`,
    data
  );

export const deletePaperAttachment = (
  workspaceId: string,
  paperId: string,
  attachmentId: string
) =>
  apiDelete<{ paper: Paper }>(
    `/api/library/papers/${workspaceId}/${paperId}/attachments/${attachmentId}`
  );

export const importPaperFromStorage = (
  workspaceId: string,
  data: { fileId: string; collectionId?: string | null; title?: string; authors?: string[] }
) =>
  apiPost<{ paper: Paper }>(
    `/api/library/papers/${workspaceId}/import-storage`,
    data
  );

export const reindexPaper = (workspaceId: string, paperId: string) =>
  apiPost<{ message: string; paperId: string }>(
    `/api/library/papers/${workspaceId}/${paperId}/reindex`,
  );

export const fetchPdfBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      throw new Error(parsed.message || "Failed to load PDF (Server returned JSON)");
    } catch {
      throw new Error(`Server returned JSON instead of PDF: ${text.substring(0, 50)}...`);
    }
  }

  return response.blob();
};
