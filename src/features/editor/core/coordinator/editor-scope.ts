/**
 * editor-scope.ts
 *
 * Single authoritative deep module for resolving the active editor workspace scope
 * (spaceId, rootPageId, activeFileId) from store state and optional route/override inputs.
 */

import { extractProjectId, type Page } from '@/features/editor/domain/types/core.types';
import { usePageStore } from '../store/editor.store';

export type PageSpaceKind = 'personal' | 'project';
export type PageEditorSubpath = 'history' | 'preview';

export const PERSONAL_SPACE_PARAM = 'personal' as const;
export const PERSONAL_LIBRARY_SCOPE_KEY = 'user' as const;

const PERSONAL_ALIASES = new Set(['personal', 'user', 'me', 'default']);

function isPersonalAlias(value?: string | null): boolean {
  if (!value) return true;
  return PERSONAL_ALIASES.has(value.trim().toLowerCase());
}

export interface PageScopeInput {
  spaceKind?: PageSpaceKind | null;
  spaceType?: PageSpaceKind | null;
  isPersonal?: boolean;
  spaceId?: string | null;
  projectId?: string | null;
  pageId?: string | null;
}

export interface PageScope {
  /** Whether the space is Personal Space ('personal') or a Project Space ('project'). */
  spaceKind: PageSpaceKind;
  /** Authoritative backend spaceId (projectId for project, userId or 'personal' for personal). */
  spaceId: string;
  /** Project ID when spaceKind === 'project', else empty string. */
  projectId: string;
  /** URL/API route space parameter ('personal' vs projectId). */
  routeSpaceParam: string;
  /** Library SDK scope ('user' iff personal, else projectId). */
  libraryScope: string;
  /** Active Page ID if present, else empty string. */
  pageId: string;
}

export interface BuildPageEditorHrefOptions {
  spaceKind?: PageSpaceKind | null;
  isPersonal?: boolean;
  projectId?: string | null;
  subpath?: PageEditorSubpath;
  fileId?: string | null;
}

/**
 * Resolves a canonical `PageScope` guaranteeing Personal Space never leaks a user UUID
 * into `/projects/:projectId` URLs or Library scope queries.
 */
export function resolvePageScope(input: PageScopeInput = {}): PageScope {
  const pageId = input.pageId?.trim() || '';
  const rawProjectId = input.projectId?.trim() || '';
  const rawSpaceId = input.spaceId?.trim() || '';

  const explicitKind = input.spaceKind ?? input.spaceType ?? null;
  const candidateProjectId =
    !isPersonalAlias(rawProjectId) && rawProjectId !== pageId
      ? rawProjectId
      : explicitKind === 'project' && !isPersonalAlias(rawSpaceId) && rawSpaceId !== pageId
        ? rawSpaceId
        : '';

  const isPersonal =
    input.isPersonal === true ||
    explicitKind === 'personal' ||
    !candidateProjectId;

  if (isPersonal) {
    return {
      spaceKind: 'personal',
      spaceId: rawSpaceId && !isPersonalAlias(rawSpaceId) ? rawSpaceId : PERSONAL_SPACE_PARAM,
      projectId: '',
      routeSpaceParam: PERSONAL_SPACE_PARAM,
      libraryScope: PERSONAL_LIBRARY_SCOPE_KEY,
      pageId,
    };
  }

  return {
    spaceKind: 'project',
    spaceId: candidateProjectId,
    projectId: candidateProjectId,
    routeSpaceParam: candidateProjectId,
    libraryScope: candidateProjectId,
    pageId,
  };
}

/**
 * Builds the canonical URL for a Page in Personal Space (`/pages/:pageId`) or
 * Project Space (`/projects/:projectId/pages/:pageId`), supporting `history` & `preview` subpaths.
 */
export function buildPageScopeHref(
  pageId: string,
  options: BuildPageEditorHrefOptions = {},
): string {
  const cleanPageId = pageId.trim();
  const scope = resolvePageScope({
    spaceKind: options.spaceKind,
    isPersonal: options.isPersonal,
    projectId: options.projectId,
    pageId: cleanPageId,
  });

  if (options.subpath === 'preview') {
    if (scope.spaceKind === 'personal') {
      return `/pages/${encodeURIComponent(cleanPageId)}/preview`;
    }
    return cleanPageId && cleanPageId !== scope.projectId
      ? `/projects/${encodeURIComponent(scope.projectId)}/preview?pageId=${encodeURIComponent(cleanPageId)}`
      : `/projects/${encodeURIComponent(scope.projectId)}/preview`;
  }

  const basePath =
    scope.spaceKind === 'personal'
      ? `/pages/${encodeURIComponent(cleanPageId)}`
      : `/projects/${encodeURIComponent(scope.projectId)}/pages/${encodeURIComponent(cleanPageId)}`;

  if (options.subpath === 'history') {
    return `${basePath}/history`;
  }

  const cleanFileId = options.fileId?.trim();
  return cleanFileId ? `${basePath}?file=${encodeURIComponent(cleanFileId)}` : basePath;
}

export interface EditorScopeOverrides {
  spaceKind?: PageSpaceKind | null;
  spaceId?: string | null;
  projectId?: string | null;
  pageId?: string | null;
  fileId?: string | null;
}

export interface ResolvedEditorScope {
  /** Whether the active workspace is Personal Space or Project Space. */
  spaceKind: PageSpaceKind;
  /** Authoritative space/project ID (empty string if personal page without space). */
  spaceId: string;
  /** Canonical Project ID (empty string when in Personal Space). */
  projectId: string;
  /** URL/API route space parameter ('personal' vs projectId). */
  routeSpaceParam: string;
  /** Library SDK scope ('user' iff personal, else projectId). */
  libraryScope: string;
  /** Root Page Aggregate ID. */
  rootPageId: string;
  /** Currently active file ID (URL ?file= > activeFilePage > activeDocId > currentPage). */
  activeFileId: string | null;
  /** Guaranteed non-empty scope key (spaceId || rootPageId) for cache/API keys. */
  effectiveScopeId: string;
}

export interface EditorScopeStoreSlice {
  spaceType?: PageSpaceKind | null;
  spaceId?: string | null;
  projectId?: string | null;
  rootPageId?: string | null;
  parentPageId?: string | null;
  activeDocId?: string | null;
  currentPage?: Page | null;
  activeFilePage?: Page | null;
}

export function resolveEditorScopeFromState(
  state: EditorScopeStoreSlice,
  overrides?: EditorScopeOverrides,
): ResolvedEditorScope {
  const explicitPageId =
    overrides?.pageId?.trim() ||
    state.rootPageId?.trim() ||
    state.parentPageId?.trim() ||
    '';

  const rootPageId =
    explicitPageId ||
    overrides?.projectId?.trim() ||
    state.currentPage?.id ||
    '';

  const rawSpaceId =
    overrides?.spaceId?.trim() ||
    overrides?.projectId?.trim() ||
    state.spaceId?.trim() ||
    state.projectId?.trim() ||
    extractProjectId(state.currentPage) ||
    '';

  const pageProjectId = extractProjectId(state.currentPage);
  const candidateProjectId =
    overrides?.projectId?.trim() ||
    (state.spaceType === 'personal' ? '' : state.projectId?.trim() || pageProjectId || '');

  const pageScope = resolvePageScope({
    spaceKind: overrides?.spaceKind ?? state.spaceType ?? null,
    spaceId: rawSpaceId,
    projectId: candidateProjectId,
    pageId: rootPageId,
  });

  const activeFileId =
    overrides?.fileId?.trim() ||
    state.activeFilePage?.id ||
    state.activeDocId ||
    state.currentPage?.id ||
    null;

  return {
    spaceKind: pageScope.spaceKind,
    spaceId: rawSpaceId,
    projectId: pageScope.projectId,
    routeSpaceParam: pageScope.routeSpaceParam,
    libraryScope: pageScope.libraryScope,
    rootPageId,
    activeFileId,
    effectiveScopeId: rawSpaceId || rootPageId,
  };
}

export function resolveEditorScope(overrides?: EditorScopeOverrides): ResolvedEditorScope {
  const state = usePageStore.getState();
  return resolveEditorScopeFromState(state, overrides);
}
