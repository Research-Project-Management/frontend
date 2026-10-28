/**
 * page-file-mapper.ts
 *
 * Pure Data Mapper / Assembler for `RawPageFileRecord -> PageFile`.
 * Eliminates repeated normalization and fallback timestamp boilerplate.
 */

import type { PageFile } from '@/features/editor/domain/types/core.types';

export interface RawPageFileRecord {
  id: string;
  _id?: string;
  pageId?: string;
  title?: string;
  name?: string;
  path?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const PageFileMapper = {
  toDomain(
    raw: Partial<RawPageFileRecord>,
    options: {
      defaultPageId: string;
      defaultTitle: string;
      includePath?: boolean;
      fallbackContent?: string;
    },
  ): PageFile {
    const now = new Date().toISOString();
    const rawCandidate =
      raw.title ||
      raw.name ||
      (options.includePath ? undefined : raw.path?.replace(/^\//, '')) ||
      options.defaultTitle;
    const resolvedTitle =
      rawCandidate.trim().toLowerCase() === 'flux'
        ? options.defaultTitle || 'main.tex'
        : rawCandidate;
    const base: PageFile = {
      id: raw.id || raw._id || `file-${Date.now()}`,
      pageId: raw.pageId || options.defaultPageId,
      title: resolvedTitle,
      content: raw.content ?? options.fallbackContent ?? '',
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
    };
    if (options.includePath) {
      base.path = raw.path || raw.title || raw.name || options.defaultTitle;
    }
    return base;
  },

  toDomainList(
    files: RawPageFileRecord[] | undefined | null,
    options: {
      defaultPageId: string;
      defaultTitle: string;
      includePath?: boolean;
    },
  ): PageFile[] {
    if (!Array.isArray(files)) return [];
    return files.map((f) => PageFileMapper.toDomain(f, options));
  },
} as const;
