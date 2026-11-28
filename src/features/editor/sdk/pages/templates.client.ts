/**
 * templates.client.ts
 *
 * GoF Facade + Virtual Single-Flight Proxy (`coalesce`) for Backend `TemplatesController`.
 * Zero magic filter strings, zero duplicate query/body params, zero legacy aliases.
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

export type TemplateScope = 'personal' | 'project';

export type TemplateCompiler = 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  category: TemplateCategory;
  scope: TemplateScope | null;
  isCustom: boolean;
  description: string | null;
  compiler: TemplateCompiler;
  texlive: string;
  mainFile: string;
  author: string | null;
  thumbnail: string | null;
  fileCount: number;
  tags: string[];
  spaceId: string | null;
  sourcePageId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFileItem {
  path: string;
  type: 'DOC' | 'FILE';
  mimeType: string;
  sizeBytes: number;
  content?: string;
}

export interface TemplateDetail extends TemplateSummary {
  files: TemplateFileItem[];
}

export interface QueryTemplatesParams {
  category?: TemplateCategory;
  scope?: TemplateScope;
  search?: string;
  spaceId?: string;
  limit?: number;
  offset?: number;
}

export interface PublishTemplateInput {
  pageId: string;
  name: string;
  category?: TemplateCategory;
  scope?: TemplateScope;
  description?: string;
  tags?: string[];
}

export interface UpdateTemplateInput {
  name?: string;
  category?: TemplateCategory;
  description?: string;
  tags?: string[];
}

export interface InstantiateTemplateResult {
  pageId: string;
  spaceId: string;
  isPersonal: boolean;
  rootDocId: string;
  title: string;
  compiler: string;
  texlive: string;
  mainFile: string;
  createdDocs: number;
  createdFiles: number;
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
    if (query?.category) params.category = query.category;
    if (query?.scope) params.scope = query.scope;
    if (query?.search) params.search = query.search;
    if (query?.spaceId) params.spaceId = query.spaceId;
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

  instantiate: (
    spaceId: string,
    templateId: string,
    opts?: { title?: string },
  ): Promise<InstantiateTemplateResult> => {
    const cleanTitle = opts?.title?.trim();
    return apiPost<InstantiateTemplateResult>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(spaceId)}/templates/${encodeURIComponent(templateId)}/instantiate`,
      cleanTitle ? { title: cleanTitle } : {},
    );
  },
};
