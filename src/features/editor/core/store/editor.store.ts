/**
 * editor.store.ts
 *
 * Store for current active document, active file, project context, and file hierarchy.
 * Zero mutable refs. Pure reactive state.
 */

import { create } from 'zustand';
import type { AssetInfo } from '@/features/editor/domain/types/asset.types';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';

export interface EditorGithubLinkInfo {
  id: string;
  repoFullName: string;
  branch: string;
  lastSyncedAt: string | null;
}

export interface DocumentEditorState {
  // ── Coordinate Model (spaceId -> pageId -> activeDocId) ──
  spaceId: string;
  spaceType: 'personal' | 'project';
  projectId: string;
  projectName: string | null;
  workspaceTitle: string;
  rootPageId: string | null;
  rootDocId: string | null;
  activeDocId: string | null;

  // Backward-compatible aliases
  parentPageId: string | null;
  activePageId: string | null;

  currentPage: Page | PageFile | null;
  activeFilePage: Page | PageFile | null;
  selectedAsset: AssetInfo | null;
  permissions: { role: string; canEdit: boolean; canCompile: boolean } | null;
  githubLink: EditorGithubLinkInfo | null;

  // ── Setters & Actions ───────────────────────────────────────────────────
  setCurrentPage: (page: Page | PageFile | null | ((prev: Page | PageFile | null) => Page | PageFile | null)) => void;
  setSpaceId: (id: string) => void;
  setProjectId: (id: string) => void;
  setWorkspaceTitle: (workspaceTitle: string) => void;
  setGithubLink: (githubLink: EditorGithubLinkInfo | null) => void;
  setRootPageId: (id: string | null) => void;
  setRootDocId: (id: string | null) => void;
  setParentPageId: (id: string | null) => void;
  setActiveDocId: (id: string | null) => void;
  setActivePageId: (id: string | null) => void;
  setHierarchy: (hierarchy: {
    spaceId?: string;
    projectId?: string;
    rootPageId?: string | null;
    pageId?: string | null;
    activeDocId?: string | null;
  }) => void;
  setActiveFilePage: (page: Page | PageFile | null) => void;
  setSelectedAsset: (asset: AssetInfo | null) => void;
  setWorkspaceContext: (ctx: {
    spaceId: string;
    spaceType?: 'personal' | 'project';
    projectId?: string | null;
    projectName?: string | null;
    workspaceTitle?: string;
    permissions?: { role: string; canEdit: boolean; canCompile: boolean } | null;
    githubLink?: EditorGithubLinkInfo | null;
  }) => void;
  resetPageState: () => void;

  // ── Canonical Manuscript & LaTeX Accessors (Overleaf Parity) ────────────
  getActiveDocument: () => Page | PageFile | null;
  getActiveDocumentId: () => string | null;
  getActiveDocumentTitle: () => string;
  setActiveDocument: (doc: Page | PageFile | null) => void;
  getSpaceId: () => string;
  getProjectId: () => string;
  getRootPageId: () => string | null;
  getActiveDocId: () => string | null;
}

export const usePageStore = create<DocumentEditorState>((set, get) => ({
  currentPage: null,
  spaceId: '',
  spaceType: 'personal',
  projectId: '',
  projectName: null,
  workspaceTitle: '',
  rootPageId: null,
  rootDocId: null,
  parentPageId: null,
  activeDocId: null,
  activePageId: null,
  activeFilePage: null,
  selectedAsset: null,
  permissions: null,
  githubLink: null,

  setCurrentPage: (pageOrUpdater) =>
    set((state) => {
      const next =
        typeof pageOrUpdater === 'function'
          ? pageOrUpdater(state.currentPage)
          : pageOrUpdater;
      const hasDistinctActiveFile =
        state.activeFilePage &&
        next &&
        state.activeFilePage.id !== state.currentPage?.id &&
        state.activeFilePage.id !== next.id;
      const nextParentPageId = state.parentPageId || state.rootPageId || next?.id || null;
      const nextActiveFilePage = hasDistinctActiveFile ? state.activeFilePage : next;
      const nextActivePageId = hasDistinctActiveFile ? state.activeFilePage?.id || null : next?.id || null;
      if (
        state.currentPage === next &&
        state.parentPageId === nextParentPageId &&
        state.rootPageId === nextParentPageId &&
        state.activeFilePage === nextActiveFilePage &&
        state.activePageId === nextActivePageId &&
        state.activeDocId === nextActivePageId
      ) {
        return state;
      }
      return {
        currentPage: next,
        rootPageId: nextParentPageId,
        parentPageId: nextParentPageId,
        activeFilePage: nextActiveFilePage,
        activeDocId: nextActivePageId,
        activePageId: nextActivePageId,
      };
    }),
  setSpaceId: (spaceId) =>
    set((state) => (state.spaceId === spaceId ? state : { spaceId })),
  setProjectId: (projectId) =>
    set((state) => {
      const nextSpaceId = state.spaceId || projectId;
      const nextSpaceType = projectId ? 'project' : state.spaceType;
      if (
        state.projectId === projectId &&
        state.spaceId === nextSpaceId &&
        state.spaceType === nextSpaceType
      ) {
        return state;
      }
      return {
        projectId,
        spaceId: nextSpaceId,
        spaceType: nextSpaceType,
      };
    }),
  setWorkspaceTitle: (workspaceTitle) =>
    set((state) => (state.workspaceTitle === workspaceTitle ? state : { workspaceTitle })),
  setGithubLink: (githubLink) =>
    set((state) => (state.githubLink === githubLink ? state : { githubLink })),
  setRootPageId: (rootPageId) =>
    set((state) =>
      state.rootPageId === rootPageId && state.parentPageId === rootPageId
        ? state
        : { rootPageId, parentPageId: rootPageId },
    ),
  setRootDocId: (rootDocId) =>
    set((state) => (state.rootDocId === rootDocId ? state : { rootDocId })),
  setParentPageId: (parentPageId) =>
    set((state) =>
      state.rootPageId === parentPageId && state.parentPageId === parentPageId
        ? state
        : { rootPageId: parentPageId, parentPageId },
    ),
  setActiveDocId: (activeDocId) =>
    set((state) =>
      state.activeDocId === activeDocId && state.activePageId === activeDocId
        ? state
        : { activeDocId, activePageId: activeDocId },
    ),
  setActivePageId: (activePageId) =>
    set((state) =>
      state.activeDocId === activePageId && state.activePageId === activePageId
        ? state
        : { activeDocId: activePageId, activePageId },
    ),
  setHierarchy: ({ spaceId, projectId, rootPageId, pageId, activeDocId }) =>
    set((state) => {
      const resolvedSpaceId = spaceId !== undefined ? spaceId : state.spaceId;
      const resolvedProjectId = projectId !== undefined ? projectId : state.projectId;
      const resolvedRoot =
        rootPageId !== undefined ? rootPageId : pageId !== undefined ? pageId : state.rootPageId;
      const resolvedActive = activeDocId !== undefined ? activeDocId : state.activeDocId;
      return {
        spaceId: resolvedSpaceId,
        projectId: resolvedProjectId,
        rootPageId: resolvedRoot,
        parentPageId: resolvedRoot,
        activeDocId: resolvedActive,
        activePageId: resolvedActive,
      };
    }),
  setActiveFilePage: (activeFilePage) =>
    set((state) => {
      const nextActivePageId = (activeFilePage ?? state.currentPage)?.id || null;
      if (
        state.activeFilePage === activeFilePage &&
        state.activePageId === nextActivePageId &&
        state.activeDocId === nextActivePageId
      ) {
        return state;
      }
      return {
        activeFilePage,
        activeDocId: nextActivePageId,
        activePageId: nextActivePageId,
      };
    }),
  setSelectedAsset: (selectedAsset) =>
    set((state) => (state.selectedAsset === selectedAsset ? state : { selectedAsset })),
  setWorkspaceContext: ({
    spaceId,
    spaceType,
    projectId,
    projectName,
    workspaceTitle,
    permissions,
    githubLink,
  }) =>
    set((state) => {
      const resolvedProjectId =
        projectId !== undefined ? (projectId ?? '') : state.projectId;
      return {
        spaceId,
        spaceType:
          spaceType ?? (resolvedProjectId ? 'project' : 'personal'),
        projectId: resolvedProjectId,
        projectName: projectName !== undefined ? (projectName ?? null) : state.projectName,
        workspaceTitle: workspaceTitle !== undefined ? workspaceTitle : state.workspaceTitle,
        permissions: permissions !== undefined ? permissions : state.permissions,
        githubLink: githubLink !== undefined ? githubLink : state.githubLink,
      };
    }),
  resetPageState: () =>
    set({
      currentPage: null,
      spaceId: '',
      spaceType: 'personal',
      projectId: '',
      projectName: null,
      workspaceTitle: '',
      rootPageId: null,
      rootDocId: null,
      parentPageId: null,
      activeDocId: null,
      activePageId: null,
      activeFilePage: null,
      selectedAsset: null,
      permissions: null,
      githubLink: null,
    }),

  // ── Canonical Manuscript Accessor Implementations ───────────────────────
  getActiveDocument: () => get().activeFilePage || get().currentPage,
  getActiveDocumentId: () => get().activeDocId || get().activePageId || (get().activeFilePage || get().currentPage)?.id || null,
  getActiveDocumentTitle: () => (get().activeFilePage || get().currentPage)?.title || 'main.tex',
  setActiveDocument: (doc) =>
    set((state) => {
      const nextDocId = (doc ?? state.currentPage)?.id || null;
      return {
        activeFilePage: doc,
        activeDocId: nextDocId,
        activePageId: nextDocId,
        currentPage: state.currentPage ?? doc,
      };
    }),
  getSpaceId: () => get().spaceId || get().projectId,
  getProjectId: () => get().projectId || get().spaceId,
  getRootPageId: () => get().rootPageId || get().parentPageId,
  getActiveDocId: () => get().activeDocId || get().activePageId,
}));

export type { AssetInfo };
