/**
 * structure.client.ts
 *
 * Project hierarchy, folder tree nodes, root document management, and node mappers.
 */

import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from '@/shared/lib/api';
import { PAGES_API_BASE, buildFilestoreStreamUrl } from './base';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import type {
  StructureNodeDto,
  ProjectOutlineResponseDto,
  ProjectSymbolsResponseDto,
} from './types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import type { PageFile } from '@/features/editor/domain/types/core.types';

export type {
  EditorStorageItem,
  StructureNodeDto,
  ProjectOutlineResponseDto,
  ProjectSymbolsResponseDto,
};

export function mapStructureNodesToStorageItems(
  nodes: StructureNodeDto[],
  targetId: string,
): EditorStorageItem[] {
  if (!Array.isArray(nodes)) return [];
  const pageState = typeof usePageStore?.getState === 'function' ? usePageStore.getState() : undefined;
  const storeContext = {
    spaceId: pageState?.spaceId,
    rootPageId: pageState?.rootPageId || pageState?.parentPageId || undefined,
  };
  return nodes.map((n) => {
    const upperType = (n.type?.toUpperCase() || 'FILE') as 'FOLDER' | 'DOC' | 'FILE';
    const isFolder = upperType === 'FOLDER';
    const isFileAsset = upperType === 'FILE';
    const normalizedPath = normalizeVirtualPath(n.path || n.name) || n.name;
    const resolvedSpaceId = n.spaceId ?? n.projectId ?? null;
    const resolvedPageId = n.pageId ?? n.projectId ?? targetId ?? null;
    return {
      id: n.id,
      nodeId: n.id,
      spaceId: resolvedSpaceId ?? targetId ?? null,
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
            url: buildFilestoreStreamUrl(
              resolvedSpaceId || targetId,
              n.fileId || n.id,
              n.pageId || undefined,
              storeContext,
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
    return await apiGet(`${PAGES_API_BASE}/pages/${pageId}/structure/tree`);
  },

  getSymbols: async (pageId: string): Promise<ProjectSymbolsResponseDto | null> => {
    if (!pageId) return null;
    try {
      return await apiGet<ProjectSymbolsResponseDto>(
        `${PAGES_API_BASE}/pages/${encodeURIComponent(pageId)}/structure/symbols`,
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
    const targetId = params?.pageId || projectId;
    if (!targetId) {
      return { rootDocPath: null, entries: [], tree: [] };
    }
    try {
      if (params?.content !== undefined) {
        return await apiPost<ProjectOutlineResponseDto>(
          `${PAGES_API_BASE}/pages/${targetId}/structure/outline`,
          params,
          { silent: true },
        );
      }
      const query: Record<string, string> = {};
      if (params?.filePath) query.filePath = params.filePath;
      if (params?.docId) query.docId = params.docId;
      if (params?.pageId) query.pageId = params.pageId;
      return await apiGet<ProjectOutlineResponseDto>(
        `${PAGES_API_BASE}/pages/${targetId}/structure/outline`,
        { params: query, silent: true },
      );
    } catch {
      return { rootDocPath: null, entries: [], tree: [] };
    }
  },

  getAllNodes: async (pageId: string): Promise<StructureNodeDto[]> => {
    if (!pageId) return [];
    try {
      return await apiGet<StructureNodeDto[]>(`${PAGES_API_BASE}/pages/${pageId}/structure/nodes`, { silent: true });
    } catch {
      return [];
    }
  },

  getNodeById: async (pageId: string, nodeId: string): Promise<StructureNodeDto | null> => {
    if (!pageId || !nodeId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${PAGES_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}`, { silent: true });
    } catch {
      return null;
    }
  },

  createNode: async (pageId: string, dto: Partial<StructureNodeDto> & { name: string; content?: string }) => {
    return await apiPost(`${PAGES_API_BASE}/pages/${pageId}/structure/nodes`, {
      ...dto,
      type: typeof dto?.type === 'string' ? dto.type.toUpperCase() : (dto?.type || 'DOC'),
    });
  },

  moveNode: async (
    pageId: string,
    nodeId: string,
    dto: { parentId?: string | null; destParentId?: string | null; destPath?: string; sortOrder?: number; [key: string]: unknown },
  ) => {
    const payload = {
      ...dto,
      ...(dto.destParentId === undefined && dto.parentId !== undefined
        ? { destParentId: dto.parentId }
        : {}),
    };
    return await apiPatch(`${PAGES_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}/move`, payload);
  },

  renameNode: async (pageId: string, nodeId: string, dto: { name: string; [key: string]: unknown }) => {
    return await apiPatch(`${PAGES_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}/rename`, dto);
  },

  deleteNode: async (pageId: string, nodeId: string) => {
    return await apiDelete(`${PAGES_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}`);
  },

  getRootDoc: async (pageId: string): Promise<StructureNodeDto | null> => {
    if (!pageId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${PAGES_API_BASE}/pages/${pageId}/structure/root-doc`, { silent: true });
    } catch {
      return null;
    }
  },

  setRootDoc: async (pageId: string, nodeId: string): Promise<StructureNodeDto> => {
    return await apiPost<StructureNodeDto>(
      `${PAGES_API_BASE}/pages/${pageId}/structure/root-doc/${nodeId}`,
      {},
    );
  },

  reorderNode: async (pageId: string, nodeId: string, sortOrder: number): Promise<void> => {
    await apiPost(
      `${PAGES_API_BASE}/pages/${pageId}/structure/nodes/${nodeId}/reorder`,
      { sortOrder },
    );
  },

  getProjectFiles: async (pageId: string, parentId?: string | null): Promise<EditorStorageItem[]> => {
    if (!pageId) return [];
    try {
      const endpoint = parentId
        ? `${PAGES_API_BASE}/pages/${pageId}/structure/nodes?parentId=${parentId}`
        : `${PAGES_API_BASE}/pages/${pageId}/structure/nodes`;
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
    return await apiPost(`${PAGES_API_BASE}/pages/${pageId}/structure/nodes`, {
      name,
      type: 'FOLDER',
      parentId: parentId ?? null,
    });
  },
};
