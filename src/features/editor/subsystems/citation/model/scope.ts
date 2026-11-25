/**
 * citation-scope.ts
 * Single source of truth for resolving Editor -> Library & Citations scope.
 */

export const PERSONAL_LIBRARY_SCOPE = 'user' as const;

export interface CitationScopeInput {
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
  const projectId =
    input.propProjectId ||
    input.routeProjectId ||
    input.storeProjectId ||
    input.pageProjectId ||
    '';

  const spaceId = projectId || input.storeSpaceId || '';
  const libraryScope = projectId || PERSONAL_LIBRARY_SCOPE;
  const pageId = input.pageId || '';

  return { spaceId, libraryScope, pageId };
}
