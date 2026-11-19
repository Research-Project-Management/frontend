/**
 * structure.client.ts
 *
 * Project Hierarchy, Storage, Filestore, Citations, Templates,
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
import { normalizeVirtualPath, parseVirtualFolderId } from '@/features/editor/domain/document/document-naming';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import type {
  StructureNodeDto,
  ManuscriptNodeDto,
  FileMetadataDto,
  StorageFileDto,
  BibEntryDto,
  CitationValidationDto,
  ProjectTemplateItem,
  ProjectOutlineResponseDto,
  ProjectSymbolsResponseDto,
  ImportFromProjectPayload,
} from './types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import type { PageFile } from '@/features/editor/domain/types/core.types';

export type {
  EditorStorageItem,
  StructureNodeDto,
  ManuscriptNodeDto,
  FileMetadataDto,
  StorageFileDto,
  ProjectSymbolsResponseDto,
  ImportFromProjectPayload,
};

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

export function mapStructureNodesToStorageItems(
  nodes: StructureNodeDto[],
  scopeId: string,
): EditorStorageItem[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n) => {
    const upperType = (n.type?.toUpperCase() || 'FILE') as 'FOLDER' | 'DOC' | 'FILE';
    const isFolder = upperType === 'FOLDER';
    const isFileAsset = upperType === 'FILE';
    const normalizedPath = normalizeVirtualPath(n.path || n.name) || n.name;
    const resolvedSpaceId = n.spaceId ?? n.projectId ?? null;
    const resolvedPageId = n.pageId ?? n.projectId ?? scopeId ?? null;
    return {
      id: n.id,
      nodeId: n.id,
      spaceId: resolvedSpaceId ?? scopeId ?? null,
      pageId: resolvedPageId,
      projectId: n.projectId ?? null,
      filename: n.name,
      path: normalizedPath,
      isFolder,
      nodeType: upperType,
      docId: n.docId ?? null,
      fileId: n.fileId ?? null,
      isRootDoc: Boolean(n.isRootDoc),
      parentId: n.parentId ?? null,
      sortOrder: n.sortOrder,
      size: n.sizeBytes,
      ...(isFileAsset
        ? {
            url: filestore.getStreamUrl(
              resolvedSpaceId || scopeId,
              n.fileId || n.id,
              n.pageId || undefined,
            ),
          }
        : {}),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    };
  });
}

export function mapStructureNodesToPageFiles(
  nodes: StructureNodeDto[],
  pageId: string,
): PageFile[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n) => n.type?.toUpperCase() === 'DOC')
    .map((n) => {
      const cleanName =
        (n.path ? n.path.replace(/^\/+/, '') : '') || n.name || 'main.tex';
      return {
        id: n.docId || n.id,
        title: cleanName,
        path: n.path,
        content: '',
        pageId,
        projectId: n.projectId,
        ...(typeof n.rev === 'number' ? { rev: n.rev } : {}),
        ...(n.hash !== undefined ? { hash: n.hash } : {}),
        ...(typeof n.sizeBytes === 'number' ? { sizeBytes: n.sizeBytes } : {}),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      };
    });
}

export const structure = {
  getTree: async (pageId: string) => {
    return await apiGet(`${MANUSCRIPTS_API_BASE}/pages/${pageId}/structure/tree`);
  },

  getSymbols: async (pageId: string): Promise<ProjectSymbolsResponseDto | null> => {
    if (!pageId) return null;
    try {
      return await apiGet<ProjectSymbolsResponseDto>(
        `${MANUSCRIPTS_API_BASE}/pages/${encodeURIComponent(pageId)}/structure/symbols`,
        { silent: true },
      );
    } catch {
      return null;
    }
  },

  getOutline: async (
    projectId: string,
    params?: { filePath?: string; docId?: string; pageId?: string; content?: string },
  ): Promise<ProjectOutlineResponseDto> => {
    const scopeId = params?.pageId || projectId;
    if (!scopeId) {
      return { rootDocPath: null, entries: [], tree: [] };
    }
    try {
      if (params?.content !== undefined) {
        return await apiPost<ProjectOutlineResponseDto>(
          `${MANUSCRIPTS_API_BASE}/pages/${scopeId}/structure/outline`,
          params,
          { silent: true },
        );
      }
      const query: Record<string, string> = {};
      if (params?.filePath) query.filePath = params.filePath;
      if (params?.docId) query.docId = params.docId;
      if (params?.pageId) query.pageId = params.pageId;
      return await apiGet<ProjectOutlineResponseDto>(
        `${MANUSCRIPTS_API_BASE}/pages/${scopeId}/structure/outline`,
        { params: query, silent: true },
      );
    } catch {
      return { rootDocPath: null, entries: [], tree: [] };
    }
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
        return mapStructureNodesToStorageItems(nodes, pageId);
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

function resolveFilestoreCollectionRoute(
  apiBase: string,
  spaceIdOrPageId: string,
  explicitPageId?: string,
): { basePath: string; pageQuery?: string } {
  const trimmedScope = spaceIdOrPageId?.trim() || '';
  const trimmedPage = explicitPageId?.trim() || undefined;
  if (trimmedPage && trimmedScope && trimmedScope !== trimmedPage) {
    return {
      basePath: `${apiBase}/spaces/${encodeURIComponent(trimmedScope)}/files`,
      pageQuery: `pageId=${encodeURIComponent(trimmedPage)}`,
    };
  }
  const pageState = typeof usePageStore?.getState === 'function' ? usePageStore.getState() : undefined;
  const storeSpaceId = pageState?.spaceId?.trim() || '';
  const storePageId = pageState?.rootPageId?.trim() || pageState?.parentPageId?.trim() || '';
  if (trimmedPage && (!trimmedScope || (storeSpaceId && storeSpaceId !== trimmedPage))) {
    return {
      basePath: `${apiBase}/pages/${encodeURIComponent(trimmedPage)}/files`,
    };
  }
  if (!trimmedPage && trimmedScope && storePageId && trimmedScope === storePageId && storeSpaceId !== trimmedScope) {
    return {
      basePath: `${apiBase}/pages/${encodeURIComponent(trimmedScope)}/files`,
    };
  }
  return {
    basePath: `${apiBase}/spaces/${encodeURIComponent(trimmedScope || trimmedPage || '')}/files`,
    pageQuery: trimmedPage ? `pageId=${encodeURIComponent(trimmedPage)}` : undefined,
  };
}

export const filestore = {
  getStreamUrl: (projectIdOrPageId: string, fileId: string, pageId?: string): string => {
    const { basePath, pageQuery } = resolveFilestoreCollectionRoute(
      MANUSCRIPTS_API_BASE,
      projectIdOrPageId,
      pageId,
    );
    return `${basePath}/${encodeURIComponent(fileId)}${pageQuery ? `?${pageQuery}` : ''}`;
  },

  upload: async (
    projectIdOrPageId: string,
    file: File | Blob,
    filename?: string,
    pageId?: string,
  ): Promise<FileMetadataDto> => {
    const name = filename || (file instanceof File ? file.name : 'unnamed.bin');
    const formData = new FormData();
    formData.append('file', file, name);
    const { basePath, pageQuery } = resolveFilestoreCollectionRoute(
      getManuscriptsBaseUrl(),
      projectIdOrPageId,
      pageId,
    );
    const res = await rawFetch(
      `${basePath}?name=${encodeURIComponent(name)}${pageQuery ? `&${pageQuery}` : ''}`,
      'POST',
      formData,
    );
    if (!res.ok) {
      let message = res.statusText || `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as {
          message?: string;
          error?: { message?: string };
        };
        message = errBody?.error?.message || errBody?.message || message;
      } catch {
        // Non-JSON response fallback
      }
      throw new Error(`File upload failed: ${message}`);
    }
    return (await res.json()) as FileMetadataDto;
  },

  getSignedUrl: async (
    projectIdOrPageId: string,
    fileId: string,
    expiresIn = 3600,
    pageId?: string,
  ): Promise<{ signedUrl: string | null }> => {
    try {
      const { basePath } = resolveFilestoreCollectionRoute(
        MANUSCRIPTS_API_BASE,
        projectIdOrPageId,
        pageId,
      );
      return await apiGet<{ signedUrl: string | null }>(
        `${basePath}/${encodeURIComponent(fileId)}/signed-url?expiresIn=${expiresIn}`,
      );
    } catch {
      return { signedUrl: null };
    }
  },

  delete: async (projectIdOrPageId: string, fileId: string, pageId?: string): Promise<void> => {
    const { basePath } = resolveFilestoreCollectionRoute(
      MANUSCRIPTS_API_BASE,
      projectIdOrPageId,
      pageId,
    );
    return await apiDelete(`${basePath}/${encodeURIComponent(fileId)}`);
  },

  importFromProject: async (
    projectIdOrPageId: string,
    payload: ImportFromProjectPayload,
  ): Promise<{ file: Record<string, unknown> }> => {
    return await apiPost<{ file: Record<string, unknown> }>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectIdOrPageId}/files/import-from-project`,
      payload,
    );
  },

  uploadPageFile: async (
    pageId: string,
    file: File,
    parentId?: string | null,
    onProgress?: (progress: number) => void,
    projectId?: string,
  ): Promise<EditorStorageItem> => {
    const targetPageId = pageId || projectId || '';
    const storeSpaceId =
      typeof usePageStore?.getState === 'function' ? usePageStore.getState().spaceId?.trim() : '';
    const resolvedSpaceId = projectId?.trim() || storeSpaceId || '';
    let effectiveName = file.name;
    if (parentId && !file.name.includes('/')) {
      const virtualFolder = parseVirtualFolderId(parentId);
      if (virtualFolder) {
        effectiveName = `${virtualFolder}/${file.name}`;
      } else if (targetPageId) {
        const folderNode = await structure.getNodeById(targetPageId, parentId).catch(() => null);
        const folderPath = normalizeVirtualPath(folderNode?.path || folderNode?.name || '');
        if (folderPath) {
          effectiveName = `${folderPath}/${file.name}`;
        }
      }
    }
    const uploaded = await filestore.upload(
      resolvedSpaceId || targetPageId,
      file,
      effectiveName,
      pageId || undefined,
    );
    onProgress?.(100);
    const id = uploaded.id || '';
    const filename = uploaded.name || uploaded.filename || effectiveName;
    const normalizedPath = normalizeVirtualPath(uploaded.path || filename) || filename;
    const itemSpaceId = uploaded.spaceId ?? resolvedSpaceId ?? uploaded.projectId ?? null;
    const itemPageId = uploaded.pageId ?? pageId ?? projectId ?? null;
    return {
      id,
      nodeId: uploaded.nodeId ?? id,
      spaceId: itemSpaceId,
      pageId: itemPageId,
      projectId: uploaded.projectId ?? resolvedSpaceId ?? pageId ?? null,
      filename,
      path: normalizedPath,
      size: uploaded.sizeBytes ?? file.size,
      mimeType: uploaded.mimeType || file.type,
      isFolder: false,
      nodeType: 'FILE',
      docId: uploaded.docId ?? null,
      fileId: uploaded.fileId ?? id,
      isRootDoc: false,
      parentId: parentId || null,
      url: filestore.getStreamUrl(
        itemSpaceId || targetPageId,
        id,
        itemPageId || undefined,
      ),
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
  list: async (projectId: string, limit = 500): Promise<BibEntryDto[]> => {
    if (!projectId) return [];
    try {
      return await apiGet<BibEntryDto[]>(
        `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations?limit=${limit}`,
        { silent: true },
      );
    } catch {
      return [];
    }
  },

  search: async (projectId: string, query = '', limit = 20): Promise<BibEntryDto[]> => {
    return await apiGet<BibEntryDto[]>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  resolve: async (projectId: string, identifier: string): Promise<{ success: boolean; entry: BibEntryDto }> => {
    return await apiPost<{ success: boolean; entry: BibEntryDto }>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations/resolve`,
      { identifier },
    );
  },

  validate: async (projectId: string): Promise<CitationValidationDto> => {
    return await apiGet<CitationValidationDto>(`${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations/validate`);
  },

  refactorKey: async (
    projectId: string,
    dto: { oldKey: string; newKey: string },
  ): Promise<{
    oldKey: string;
    newKey: string;
    totalReplacements: number;
    affectedFiles: Array<{
      docId: string;
      path: string;
      count: number;
      newContent: string;
    }>;
  }> => {
    return await apiPost(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations/refactor`,
      dto,
    );
  },

  upsertEntries: async (
    projectId: string,
    dto: {
      entry?: Record<string, unknown>;
      entries?: Array<Record<string, unknown>>;
      rawBibtex?: string;
      targetBibFile?: string;
      targetFilename?: string;
    },
  ): Promise<{
    filePath: string;
    docId?: string;
    syncedCount: number;
    entries: BibEntryDto[];
    formattedBibtex: string;
    conflicts?: string[];
  }> => {
    return await apiPost(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations/entries`,
      dto,
    );
  },

  injectBibliography: async (
    projectId: string | undefined,
    dto: {
      docId?: string;
      content?: string;
      filePath?: string;
      format?: 'latex' | 'markdown';
      styleId?: string;
      headingTitle?: string;
      bibliographyText?: string;
      citations?: Array<{
        key?: string;
        inText?: string;
        bibliography?: string;
      }>;
    },
  ): Promise<{
    nextContent: string;
    action: 'replaced' | 'appended';
    section: string;
    format: 'latex' | 'markdown';
  }> => {
    if (projectId) {
      return await apiPost(
        `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations/inject-bibliography`,
        dto,
      );
    }
    return await apiPost(`${MANUSCRIPTS_API_BASE}/citations/format-bibitem`, dto);
  },

  syncLibrary: async (
    projectId: string,
    dto: { provider?: string; collectionId: string; collectionName?: string; targetBibFile?: string; targetFilename?: string },
  ): Promise<SyncLibraryResult> => {
    const payload = {
      ...dto,
      ...(dto.targetBibFile && !dto.targetFilename ? { targetFilename: dto.targetBibFile } : {}),
    };
    return await apiPost<SyncLibraryResult>(`${MANUSCRIPTS_API_BASE}/spaces/${projectId}/citations/sync-library`, payload);
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
    return await apiPost<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/spaces/${projectId}/templates/${templateId}/scaffold`, {});
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
        `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/spelling/check`,
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
        `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/spelling/dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  learnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/spelling/dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  unlearnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/spelling/dictionary/${encodeURIComponent(word)}`,
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
    return apiGet<GitRepoInfo>(`${MANUSCRIPTS_API_BASE}/spaces/${projectId}/git`);
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

export interface LinkedFileDto {
  id: string;
  name: string;
  provider: string;
  sourceProjectId?: string;
  sourceFileId?: string;
  sourceUrl?: string;
  lastSyncedAt?: string;
  [key: string]: unknown;
}

export interface CreateLinkedFilePayload {
  name: string;
  provider: string;
  sourceProjectId?: string;
  sourceFileId?: string;
  sourceUrl?: string;
  [key: string]: unknown;
}

export const linkedFiles = {
  list: async (projectId: string): Promise<LinkedFileDto[]> => {
    const res = await apiGet<LinkedFileDto[] | { linkedFiles?: LinkedFileDto[] }>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/linked-files`,
    );
    return Array.isArray(res) ? res : res?.linkedFiles || [];
  },

  create: async (projectId: string, payload: CreateLinkedFilePayload): Promise<LinkedFileDto> => {
    return apiPost<LinkedFileDto>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/linked-files`,
      payload,
    );
  },

  refresh: async (projectId: string, linkId: string): Promise<LinkedFileDto> => {
    return apiPost<LinkedFileDto>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/linked-files/${linkId}/refresh`,
      {},
    );
  },

  refreshAll: async (projectId: string): Promise<{ refreshedCount: number; [key: string]: unknown }> => {
    return apiPost<{ refreshedCount: number; [key: string]: unknown }>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/linked-files/refresh-all`,
      {},
    );
  },

  delete: async (projectId: string, linkId: string): Promise<void> => {
    await apiDelete<void>(
      `${MANUSCRIPTS_API_BASE}/spaces/${projectId}/linked-files/${linkId}`,
    );
  },
};
