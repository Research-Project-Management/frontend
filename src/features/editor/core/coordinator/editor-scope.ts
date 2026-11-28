/**
 * editor-scope.ts
 *
 * Single authoritative deep module for resolving the active editor workspace scope
 * (spaceId, rootPageId, activeFileId) from store state and optional route/override inputs.
 */

import { extractProjectId, type Page } from '@/features/editor/domain/types/core.types';
import { usePageStore } from '../store/editor.store';

export interface EditorScopeOverrides {
  spaceId?: string | null;
  projectId?: string | null;
  pageId?: string | null;
  fileId?: string | null;
}

export interface ResolvedEditorScope {
  /** Authoritative space/project ID (empty string if personal page without space). */
  spaceId: string;
  /** Root Page Aggregate ID. */
  rootPageId: string;
  /** Currently active file ID (URL ?file= > activeFilePage > activeDocId > currentPage). */
  activeFileId: string | null;
  /** Guaranteed non-empty scope key (spaceId || rootPageId) for cache/API keys. */
  effectiveScopeId: string;
}

export interface EditorScopeStoreSlice {
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

  const spaceId =
    overrides?.spaceId?.trim() ||
    overrides?.projectId?.trim() ||
    state.spaceId?.trim() ||
    state.projectId?.trim() ||
    extractProjectId(state.currentPage) ||
    '';

  const activeFileId =
    overrides?.fileId?.trim() ||
    state.activeFilePage?.id ||
    state.activeDocId ||
    state.currentPage?.id ||
    null;

  return {
    spaceId,
    rootPageId,
    activeFileId,
    effectiveScopeId: spaceId || rootPageId,
  };
}

export function resolveEditorScope(overrides?: EditorScopeOverrides): ResolvedEditorScope {
  const state = usePageStore.getState();
  return resolveEditorScopeFromState(state, overrides);
}
