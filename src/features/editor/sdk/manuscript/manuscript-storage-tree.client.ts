/**
 * manuscript-storage-tree.client.ts
 *
 * Project Hierarchy, Storage, Filestore, Linked Files, Citations, Templates,
 * Spelling, and Git Sub-APIs (Part of manuscriptService SDK).
 */

import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  rawFetch,
} from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE, getManuscriptsBaseUrl } from './base';
import type {
  StructureNodeDto,
  FileMetadataDto,
  BibEntryDto,
  CitationValidationDto,
  LinkedFileDto,
  CreateLinkedFilePayload,
  ProjectTemplateItem,
} from './types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';

export type { EditorStorageItem };

/** Result of POST citations/sync-library. `conflicts` lists citekeys that already existed and were overwritten. */
export interface SyncLibraryResult {
  collectionId: string;
  syncedCount: number;
  filePath: string;
  conflicts?: string[];
}

// ── Sub-domain: structure.api.ts ──────────────────────────────────────
/**
 * structure.api.ts
 *
 * Project hierarchy, folder tree nodes, root document management sub-API.
 */

export const structure = {
  getTree: async (pageId: string) => {
    return await apiGet(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/tree`);
  },

  getAllNodes: async (pageId: string): Promise<StructureNodeDto[]> => {
    if (!pageId) return [];
    try {
      return await apiGet<StructureNodeDto[]>(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes`, { silent: true });
    } catch {
      return [];
    }
  },

  getNodeById: async (pageId: string, nodeId: string): Promise<StructureNodeDto | null> => {
    if (!pageId || !nodeId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}`, { silent: true });
    } catch {
      return null;
    }
  },

  createNode: async (pageId: string, dto: Partial<StructureNodeDto> & { name: string; content?: string }) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes`, {
      ...dto,
      type: typeof dto?.type === 'string' ? dto.type.toUpperCase() : (dto?.type || 'DOC'),
    });
  },

  moveNode: async (pageId: string, nodeId: string, dto: { parentId?: string | null; destParentId?: string | null; destPath?: string; sortOrder?: number; [key: string]: unknown }) => {
    const payload = {
      ...dto,
      ...(dto.destParentId === undefined && dto.parentId !== undefined
        ? { destParentId: dto.parentId }
        : {}),
    };
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}/move`, payload);
  },

  renameNode: async (pageId: string, nodeId: string, dto: { name: string; [key: string]: unknown }) => {
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}/rename`, dto);
  },

  deleteNode: async (pageId: string, nodeId: string) => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}`);
  },

  getRootDoc: async (pageId: string): Promise<StructureNodeDto | null> => {
    if (!pageId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/root-doc`, { silent: true });
    } catch {
      return null;
    }
  },

  setRootDoc: async (pageId: string, nodeId: string): Promise<StructureNodeDto> => {
    return await apiPost<StructureNodeDto>(
      `${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/root-doc/${nodeId}`,
      {},
    );
  },

  reorderNode: async (pageId: string, nodeId: string, sortOrder: number): Promise<void> => {
    await apiPost(
      `${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}/reorder`,
      { sortOrder },
    );
  },

  getProjectFiles: async (pageId: string, parentId?: string | null): Promise<EditorStorageItem[]> => {
    if (!pageId) return [];
    try {
      const endpoint = parentId
        ? `${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes?parentId=${parentId}`
        : `${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes`;
      const nodes = await apiGet<StructureNodeDto[]>(endpoint, { silent: true });
      if (Array.isArray(nodes)) {
        return nodes.map((n) => {
          const upperType = (n.type?.toUpperCase() || 'FILE') as 'FOLDER' | 'DOC' | 'FILE';
          const isFolder = upperType === 'FOLDER';
          const isFileAsset = upperType === 'FILE';
          return {
            id: n.id,
            filename: n.name,
            path: n.path,
            isFolder,
            nodeType: upperType,
            docId: n.docId ?? null,
            fileId: n.fileId ?? null,
            isRootDoc: Boolean(n.isRootDoc),
            parentId: n.parentId,
            size: n.sizeBytes,
            ...(isFileAsset ? { url: filestore.getStreamUrl(pageId, n.fileId || n.id) } : {}),
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          };
        });
      }
    } catch {
      return [];
    }
    return [];
  },

  getPageFiles: async (pageId: string, parentId?: string | null): Promise<EditorStorageItem[]> => {
    return structure.getProjectFiles(pageId, parentId);
  },

  createFolder: async (pageId: string, name: string, parentId?: string | null) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/nodes`, {
      name,
      type: 'FOLDER',
      parentId: parentId ?? null,
    });
  },
};

// ── Sub-domain: filestore.api.ts ──────────────────────────────────────
/**
 * filestore.api.ts
 *
 * Filestore binary assets sub-API: Stream URLs, multipart uploads, signed URLs, deletion.
 */

export const filestore = {
  getStreamUrl: (projectIdOrPageId: string, fileId: string): string => {
    return `${MANUSCRIPTS_API_BASE}/projects/${projectIdOrPageId}/files/${fileId}`;
  },

  upload: async (projectIdOrPageId: string, file: File | Blob, filename?: string): Promise<FileMetadataDto> => {
    const name = filename || (file instanceof File ? file.name : 'unnamed.bin');
    const formData = new FormData();
    formData.append('file', file, name);
    const res = await rawFetch(
      `${getManuscriptsBaseUrl()}/projects/${projectIdOrPageId}/files?name=${encodeURIComponent(name)}`,
      'POST',
      formData,
    );
    if (!res.ok) throw new Error(`File upload failed: ${res.statusText}`);
    return (await res.json()) as FileMetadataDto;
  },

  getSignedUrl: async (projectIdOrPageId: string, fileId: string, expiresIn = 3600): Promise<{ signedUrl: string | null }> => {
    try {
      return await apiGet<{ signedUrl: string | null }>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectIdOrPageId}/files/${fileId}/signed-url?expiresIn=${expiresIn}`,
      );
    } catch {
      return { signedUrl: null };
    }
  },

  delete: async (projectIdOrPageId: string, fileId: string): Promise<void> => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectIdOrPageId}/files/${fileId}`);
  },

  uploadPageFile: async (
    pageId: string,
    file: File,
    parentId?: string | null,
    onProgress?: (progress: number) => void,
    projectId?: string,
  ): Promise<EditorStorageItem> => {
    const targetPageId = projectId || pageId || '';
    const uploaded = await filestore.upload(targetPageId, file, file.name);
    onProgress?.(100);
    const id = uploaded.id || '';
    return {
      id,
      filename: uploaded.name || file.name,
      size: uploaded.sizeBytes ?? file.size,
      mimeType: uploaded.mimeType || file.type,
      isFolder: false,
      parentId: parentId || null,
      url: filestore.getStreamUrl(targetPageId, id),
    };
  },
};

// ── Sub-domain: citations.api.ts ──────────────────────────────────────
/**
 * citations.api.ts
 *
 * Citations and bibliography sub-API: Search, resolve, validation, library sync, raw parsing.
 */

export const citations = {
  search: async (projectId: string, query = '', limit = 20): Promise<BibEntryDto[]> => {
    return await apiGet<BibEntryDto[]>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  resolve: async (projectId: string, identifier: string): Promise<{ success: boolean; entry: BibEntryDto }> => {
    return await apiPost<{ success: boolean; entry: BibEntryDto }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/resolve`,
      { identifier },
    );
  },

  validate: async (projectId: string): Promise<CitationValidationDto> => {
    return await apiGet<CitationValidationDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/validate`);
  },

  syncLibrary: async (
    projectId: string,
    dto: { provider?: string; collectionId: string; collectionName?: string; targetBibFile?: string; targetFilename?: string },
  ): Promise<SyncLibraryResult> => {
    const payload = {
      ...dto,
      ...(dto.targetBibFile && !dto.targetFilename ? { targetFilename: dto.targetBibFile } : {}),
    };
    return await apiPost<SyncLibraryResult>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/sync-library`, payload);
  },

  listLibraryCollections: async (): Promise<Array<Record<string, unknown>>> => {
    try {
      return await apiGet<Array<Record<string, unknown>>>(`${MANUSCRIPTS_API_BASE}/citations/library-collections`);
    } catch {
      return [];
    }
  },

  parseRaw: async (rawBibtex: string): Promise<BibEntryDto[]> => {
    try {
      return await apiPost<BibEntryDto[]>(`${MANUSCRIPTS_API_BASE}/citations/parse-raw`, { rawBibtex });
    } catch {
      return [];
    }
  },
};

// ── Sub-domain: templates.api.ts ──────────────────────────────────────
/**
 * templates.api.ts
 *
 * Templates & gallery sub-API: List, search, retrieve, instantiate, custom templates, scaffolding.
 */

export const templates = {
  list: async (query?: { category?: string; search?: string; limit?: number; skip?: number; offset?: number }): Promise<ProjectTemplateItem[]> => {
    const params: Record<string, string> = {};
    if (query?.category) params.category = query.category;
    if (query?.search) params.search = query.search;
    if (query?.limit) params.limit = String(query.limit);
    if (query?.skip !== undefined) {
      params.skip = String(query.skip);
      params.offset = String(query.skip);
    } else if (query?.offset !== undefined) {
      params.offset = String(query.offset);
    }
    const res = await apiGet<ProjectTemplateItem[] | { templates?: ProjectTemplateItem[] }>(`${MANUSCRIPTS_API_BASE}/templates`, { params });
    return Array.isArray(res) ? res : res?.templates || [];
  },

  search: async (query: { q?: string; category?: string; tags?: string[] }): Promise<ProjectTemplateItem[]> => {
    const params: Record<string, string> = {};
    if (query.q) params.q = query.q;
    if (query.category) params.category = query.category;
    const res = await apiGet<ProjectTemplateItem[] | { templates?: ProjectTemplateItem[] }>(`${MANUSCRIPTS_API_BASE}/templates/search`, { params });
    return Array.isArray(res) ? res : res?.templates || [];
  },

  getById: async (id: string): Promise<ProjectTemplateItem | null> => {
    return await apiGet<ProjectTemplateItem>(`${MANUSCRIPTS_API_BASE}/templates/${id}`);
  },

  instantiate: async (templateId: string, projectName: string): Promise<{ projectId: string; [key: string]: unknown }> => {
    return await apiPost<{ projectId: string; [key: string]: unknown }>(`${MANUSCRIPTS_API_BASE}/templates/instantiate`, { templateId, projectName });
  },

  createCustom: async (dto: Record<string, unknown>): Promise<ProjectTemplateItem> => {
    return await apiPost<ProjectTemplateItem>(`${MANUSCRIPTS_API_BASE}/templates/custom`, dto);
  },

  scaffold: async (projectId: string, templateId: string): Promise<Record<string, unknown>> => {
    return await apiPost<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/templates/${templateId}/scaffold`, {});
  },
};

// ── Sub-domain: spelling.api.ts ──────────────────────────────────────
/**
 * spelling.api.ts
 *
 * Manuscripts Spelling & Custom Dictionaries Sub-API (Part of manuscriptService SDK).
 */

export interface CustomDictionaryResponse {
  words: string[];
}

export interface SpellingSuggestionResponse {
  word: string;
  suggestions: string[];
}

export interface MisspelledWord {
  word: string;
  line: number;
  col: number;
  length: number;
  suggestions: string[];
}

export interface SpellingReport {
  language: string;
  totalWordsChecked: number;
  misspelledCount: number;
  errors: MisspelledWord[];
}

export interface CheckSpellingPayload {
  text?: string;
  docId?: string;
  language?: string;
}

export const spelling = {
  checkSpelling: async (
    projectId: string,
    payload: CheckSpellingPayload,
  ): Promise<SpellingReport> => {
    try {
      const res = await apiPost<SpellingReport>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/check`,
        payload,
      );
      return res;
    } catch {
      return {
        language: payload.language || 'en-US',
        totalWordsChecked: 0,
        misspelledCount: 0,
        errors: [],
      };
    }
  },

  getProjectDictionary: async (projectId: string): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  learnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  unlearnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  getUserDictionary: async (): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `${MANUSCRIPTS_API_BASE}/spelling/user-dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  learnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/spelling/user-dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  unlearnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/spelling/user-dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  getSuggestions: async (word: string, language: string = 'en_US'): Promise<string[]> => {
    try {
      const res = await apiGet<SpellingSuggestionResponse>(
        `${MANUSCRIPTS_API_BASE}/spelling/suggestions?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`,
      );
      return res?.suggestions || [];
    } catch {
      return [];
    }
  },
};

export const spellingService = spelling;

// ── Sub-domain: git.api.ts ──────────────────────────────────────
/**
 * git.api.ts
 *
 * Git Smart-HTTP & Git Access Token sub-API for Manuscripts.
 */

export interface GitTokenInfo {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface GitRepoInfo {
  enabled: boolean;
  cloneUrl: string;
  branch: string;
  canPush: boolean;
  tokens: GitTokenInfo[];
}

export const gitApi = {
  getRepoInfo: async (projectId: string): Promise<GitRepoInfo> => {
    return apiGet<GitRepoInfo>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/git`);
  },

  listTokens: async (): Promise<{ tokens: GitTokenInfo[] }> => {
    return apiGet<{ tokens: GitTokenInfo[] }>(`${MANUSCRIPTS_API_BASE}/git/tokens`);
  },

  createToken: async (label?: string): Promise<{ token: string }> => {
    return apiPost<{ token: string }>(`${MANUSCRIPTS_API_BASE}/git/tokens`, { label });
  },

  revokeToken: async (tokenId: string): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(`${MANUSCRIPTS_API_BASE}/git/tokens/${tokenId}`);
  },
};

// ── Sub-domain: linked-files.api.ts ──────────────────────────────────────
/**
 * linked-files.api.ts
 *
 * Linked external files sub-API: URL imports, Zotero, Mendeley, Dropbox, GitHub syncing.
 */

export const linkedFiles = {
  list: async (projectId: string): Promise<LinkedFileDto[]> => {
    return await apiGet<LinkedFileDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files`);
  },

  create: async (projectId: string, payload: CreateLinkedFilePayload): Promise<LinkedFileDto> => {
    const body = {
      ...payload,
      provider: payload.provider || (payload.providerType ? payload.providerType.toLowerCase() : 'url'),
    };
    return await apiPost<LinkedFileDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files`, body);
  },

  refresh: async (projectId: string, fileId: string): Promise<LinkedFileDto> => {
    return await apiPost<LinkedFileDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files/${fileId}/refresh`, {});
  },

  delete: async (projectId: string, fileId: string, deleteNode = false): Promise<void> => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files/${fileId}?deleteNode=${deleteNode}`);
  },

  refreshAll: async (projectId?: string): Promise<{ refreshedCount: number }> => {
    if (projectId) {
      return await apiPost<{ refreshedCount: number }>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files/refresh-all`, {});
    }
    return await apiPost<{ refreshedCount: number }>(`${MANUSCRIPTS_API_BASE}/linked-files/refresh-all`, { projectId });
  },
};
