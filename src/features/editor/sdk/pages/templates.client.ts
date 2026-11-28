/**
 * templates.client.ts
 *
 * GoF Facade + Virtual Single-Flight Proxy (`coalesce`) for Backend `TemplatesController`.
 */

import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';

export type TemplateCategory =
  | 'journal'
  | 'conference'
  | 'book'
  | 'letter'
  | 'assignment'
  | 'poster'
  | 'presentation'
  | 'report'
  | 'cv'
  | 'thesis'
  | 'other';

export type TemplateVisibility = 'official' | 'workspace' | 'private';

export type TemplateCompiler = 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';

export interface TemplateSummary {
  id: string;
  slug: string | null;
  versionId: string;
  name: string;
  category: TemplateCategory;
  visibility: TemplateVisibility;
  description: string | null;
  compiler: TemplateCompiler;
  texLiveVersion: string;
  mainFile: string;
  badge: string;
  author: string;
  license: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  downloadCount: number;
  fileCount: number;
  tags: string[];
  spaceId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFileItem {
  path: string;
  kind: 'doc' | 'file';
  mimeType: string;
  sizeBytes: number;
  content?: string;
  base64?: string;
}

export interface TemplateDetail extends TemplateSummary {
  files: TemplateFileItem[];
}

export interface QueryTemplatesParams {
  category?: string;
  visibility?: string;
  tag?: string;
  search?: string;
  spaceId?: string;
  limit?: number;
  offset?: number;
}

export interface PublishTemplateInput {
  name: string;
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
  description?: string;
  compiler?: TemplateCompiler;
  mainFile?: string;
  license?: string;
  sourceUrl?: string;
  tags?: string[];
  files?: Record<string, string>;
  spaceId?: string;
  pageId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  category?: TemplateCategory;
  visibility?: TemplateVisibility;
  description?: string;
  compiler?: TemplateCompiler;
  mainFile?: string;
  license?: string;
  sourceUrl?: string;
  tags?: string[];
  spaceId?: string;
  pageId?: string;
}

export interface ScaffoldTemplateResult {
  pageId: string;
  rootDocId: string | null;
  compiler: string;
  mainFile: string;
  importedDocs: number;
  importedFiles: number;
  totalEntries: number;
}

const inFlight = new Map<string, Promise<unknown>>();

function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const active = inFlight.get(key) as Promise<T> | undefined;
  if (active) return active;

  const task = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
}

export const templatesApi = {
  list: (query?: QueryTemplatesParams): Promise<TemplateSummary[]> => {
    const params: Record<string, string> = {};
    if (query?.category && query.category !== 'all') {
      params.category = query.category;
    }
    if (query?.visibility && query.visibility !== 'all') {
      params.visibility = query.visibility;
    }
    if (query?.tag) params.tag = query.tag;
    if (query?.search) params.search = query.search;
    if (query?.spaceId && query.spaceId !== 'personal') {
      params.spaceId = query.spaceId;
    }
    if (query?.limit !== undefined) params.limit = String(query.limit);
    if (query?.offset !== undefined) params.offset = String(query.offset);

    const key = `list:${JSON.stringify(params)}`;
    return coalesce(key, async () => {
      const res = await apiGet<{
        templates: TemplateSummary[];
        total: number;
      }>(`${PAGES_API_BASE}/templates`, { params });
      return Array.isArray(res?.templates) ? res.templates : [];
    });
  },

  getById: (id: string): Promise<TemplateDetail> => {
    const clean = id.trim();
    return coalesce(`detail:${clean}`, () =>
      apiGet<TemplateDetail>(
        `${PAGES_API_BASE}/templates/${encodeURIComponent(clean)}`,
      ),
    );
  },

  publish: (dto: PublishTemplateInput): Promise<TemplateDetail> =>
    apiPost<TemplateDetail>(`${PAGES_API_BASE}/templates`, dto),

  update: (id: string, dto: UpdateTemplateInput): Promise<TemplateDetail> =>
    apiPatch<TemplateDetail>(
      `${PAGES_API_BASE}/templates/${encodeURIComponent(id)}`,
      dto,
    ),

  remove: (id: string): Promise<{ success: boolean }> =>
    apiDelete<{ success: boolean }>(
      `${PAGES_API_BASE}/templates/${encodeURIComponent(id)}`,
    ),

  scaffold: (
    spaceId: string,
    templateId: string,
    opts?: { pageId?: string; title?: string },
  ): Promise<ScaffoldTemplateResult> => {
    const cleanPageId = opts?.pageId?.trim();
    const qs = cleanPageId ? `?pageId=${encodeURIComponent(cleanPageId)}` : '';
    return apiPost<ScaffoldTemplateResult>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(spaceId)}/templates/${encodeURIComponent(templateId)}/scaffold${qs}`,
      {
        ...(cleanPageId ? { pageId: cleanPageId } : {}),
        ...(opts?.title?.trim() ? { title: opts.title.trim() } : {}),
      },
    );
  },
};
