/**
 * citation-scope.ts
 * Single source of truth for resolving Editor -> Library & Citations scope.
 */

import { resolvePageScope } from '@/features/editor/core/coordinator/editor-scope';

export const PERSONAL_LIBRARY_SCOPE = 'user' as const;

export interface CitationScopeInput {
  spaceType?: 'personal' | 'project' | null;
  propProjectId?: string;
  routeProjectId?: string;
  storeProjectId?: string;
  pageProjectId?: string;
  storeSpaceId?: string;
  pageId?: string;
}

export interface CitationScope {
  /** Project/Space ID for `/api/v1/pages/spaces/:spaceId/citations` (never falls back to pageId). */
  spaceId: string;
  /** Scope for Library SDK (`projectId` for Project Library, or `'user'` for My Library). */
  libraryScope: string;
  /** Active page ID (for page-scoped files/documents). */
  pageId: string;
}

export function resolveCitationScope(input: CitationScopeInput): CitationScope {
  const isExplicitPersonal = input.spaceType === 'personal';
  const rawProjectId = isExplicitPersonal
    ? input.routeProjectId || ''
    : input.propProjectId ||
      input.routeProjectId ||
      input.storeProjectId ||
      input.pageProjectId ||
      '';

  const pageScope = resolvePageScope({
    spaceType: input.spaceType,
    projectId: rawProjectId,
    spaceId: input.storeSpaceId || input.propProjectId || rawProjectId,
    pageId: input.pageId,
  });

  const spaceId =
    (pageScope.spaceKind === 'project'
      ? pageScope.projectId
      : input.storeSpaceId ||
        input.propProjectId ||
        (pageScope.pageId ? pageScope.spaceId : '')) || '';
  const libraryScope =
    pageScope.spaceKind === 'personal' ? PERSONAL_LIBRARY_SCOPE : pageScope.libraryScope;
  const pageId = pageScope.pageId;

  return { spaceId, libraryScope, pageId };
}
