'use client';

/**
 * useActiveDocument.ts
 *
 * Active Document Resolution & Multi-File Tab Synchronization Hook.
 * Resolves current route params (?file=...), active tabs, dirty document models,
 * and background symbol extraction.
 *
 * Layer 4: Presentation / UI Hooks.
 */

import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  workspaceCoordinator,
  usePageStore,
  useWorkspaceStore,
  DEFAULT_MAIN_FILE,
  syncShallowFileUrlParam,
} from '@/features/editor/core';
import { editorBootstrapQuery, pageQuery, filesQuery } from './document.queries';
import { extractProjectId, type Page } from '@/features/editor/domain/types/core.types';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { latexDependencyGraph } from '@/features/editor/domain/latex/dependency-graph';
import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';

import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';
import type { PageFile } from '@/features/editor/domain/types/core.types';

const EMPTY_PAGE_ARRAY: Page[] = [];
const EMPTY_FILE_ARRAY: PageFile[] = [];

/**
 * Canonical helper to synchronize a tab across both pageId and projectId scopes
 * without duplicate inline fallback chains.
 */
function syncWorkspaceTabs(
  scopes: Array<string | null | undefined>,
  tab: { id: string; title: string; path?: string; isDirty?: boolean; isPinned?: boolean },
  options: {
    onlyIfUninitialized?: boolean;
    openTab: (pid: string, t: Omit<WorkspaceTab, 'lastAccessedAt'>) => void;
    setActive: (pid: string, id: string) => void;
  },
): void {
  const seen = new Set<string>();
  const wsState = useWorkspaceStore.getState();
  const tabsByProject = wsState.tabsByProject;
  const activeByProject = wsState.activeByProject;

  for (const rawScope of scopes) {
    if (!rawScope || seen.has(rawScope)) continue;
    seen.add(rawScope);

    if (options.onlyIfUninitialized && tabsByProject[rawScope] !== undefined) {
      continue;
    }

    options.openTab(rawScope, {
      id: tab.id,
      title: tab.title,
      path: tab.path ?? tab.title,
      isDirty: tab.isDirty ?? false,
      isPinned: tab.isPinned ?? true,
    });

    if (activeByProject[rawScope] !== tab.id) {
      options.setActive(rawScope, tab.id);
    }
  }
}

export function useActiveDocument() {
  const {
    id: rawId,
    projectId: rawProjectId,
    pageId: rawPageId,
    draftId,
  } = useParams<{
    id?: string;
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();

  const directPageId = rawPageId || rawId || draftId || '';
  const projectId = rawProjectId || undefined;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const fileId = searchParams.get('file');

  const bootstrapTargetId = directPageId || projectId || '';
  const isProjectOnlyRoute = Boolean(!directPageId && projectId);
  const hasBootstrapClient =
    typeof pagesService.bootstrap?.getEditorBootstrap === 'function';

  // Pin initial ?file=... per bootstrapTargetId so subsequent tab switches never re-trigger /bootstrap
  const initialBootstrapRef = useRef<{ targetId: string; fileId: string | null }>({
    targetId: bootstrapTargetId,
    fileId,
  });
  if (initialBootstrapRef.current.targetId !== bootstrapTargetId) {
    initialBootstrapRef.current = { targetId: bootstrapTargetId, fileId };
  }
  const bootstrapFileId = initialBootstrapRef.current.fileId;

  const bootstrapQuery = useQuery({
    ...editorBootstrapQuery(queryClient, bootstrapTargetId, {
      fileId: bootstrapFileId,
      isProjectRoute: isProjectOnlyRoute,
    }),
    enabled: Boolean(bootstrapTargetId) && hasBootstrapClient,
  });
  const bootstrapData = bootstrapQuery.data ?? null;
  const bootstrapPending = Boolean(
    bootstrapTargetId &&
      hasBootstrapClient &&
      bootstrapQuery.isLoading &&
      !bootstrapData,
  );

  // Fallback project route resolution if bootstrap endpoint was unavailable/offline
  const { data: projectDocsData, isLoading: projectDocsLoading } = useQuery({
    queryKey: ['projects', projectId, 'docs'],
    queryFn: () => pagesService.docs.getProjectDocs(projectId!),
    enabled:
      Boolean(projectId && !directPageId) &&
      !bootstrapPending &&
      !bootstrapData?.workspace.rootDocId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const projectDocs = projectDocsData ?? EMPTY_PAGE_ARRAY;
  const pageId =
    directPageId ||
    bootstrapData?.workspace.pageId ||
    bootstrapData?.workspace.rootDocId ||
    projectDocs[0]?.id ||
    '';

  const storeRootPageId = usePageStore((s) => s.rootPageId || s.parentPageId);
  const isStoreScopedToCurrentPage = Boolean(pageId && storeRootPageId === pageId);
  const storeActiveFilePage = usePageStore((s) => s.activeFilePage);
  const storeActiveFileId = storeActiveFilePage?.id ?? null;
  const scopedStoreActiveFileId = isStoreScopedToCurrentPage ? storeActiveFileId : null;
  const activeTabId = useWorkspaceStore((s) => {
    if (pageId) {
      return s.activeByProject[pageId] ?? null;
    }
    if (projectId) {
      return s.activeByProject[projectId] ?? null;
    }
    return null;
  });

  // Synchronously resolve active file ID: in-memory active tab or scoped pageStore.activeFilePage takes precedence
  const rawResolvedFileId =
    activeTabId ||
    (scopedStoreActiveFileId && scopedStoreActiveFileId !== pageId
      ? scopedStoreActiveFileId
      : null) ||
    fileId;
  const resolvedFileId =
    bootstrapData?.activeDoc.fallbackToRoot && rawResolvedFileId === fileId
      ? null
      : rawResolvedFileId;

  const isMainFile =
    !resolvedFileId ||
    resolvedFileId === pageId ||
    resolvedFileId === `${pageId}-main` ||
    resolvedFileId === bootstrapData?.workspace.rootDocId;

  const { data: serverPage, isLoading: parentLoading } = useQuery({
    ...pageQuery(pageId || ''),
    enabled: Boolean(pageId) && !bootstrapPending && (isMainFile || !bootstrapData),
  });

  const { data: serverFilesData, isLoading: filesLoading } = useQuery({
    ...filesQuery(pageId || ''),
    enabled: Boolean(pageId) && !bootstrapPending,
  });

  const bootstrapRootMetaPage = useMemo(() => {
    if (!bootstrapData) return null;
    const ws = bootstrapData.workspace;
    const resolvedRootProjectId = ws.spaceType === 'project' ? ws.spaceId : '';
    if (bootstrapData.activeDoc.id === ws.rootDocId) {
      return {
        ...bootstrapData.activeDoc.page,
        id: ws.rootDocId,
        title: ws.mainFilePath || bootstrapData.activeDoc.page.title,
        projectId: resolvedRootProjectId,
        mainFile: { id: ws.rootDocId, title: ws.mainFilePath || 'main.tex' },
        mainFileId: ws.rootDocId,
        rootPageId: ws.pageId || ws.rootDocId,
      } as unknown as Page;
    }
    return {
      id: ws.rootDocId,
      title: ws.mainFilePath || 'main.tex',
      path: ws.mainFilePath,
      status: 'published',
      projectId: resolvedRootProjectId,
      mainFile: { id: ws.rootDocId, title: ws.mainFilePath || 'main.tex' },
      mainFileId: ws.rootDocId,
      rootPageId: ws.pageId || ws.rootDocId,
    } as unknown as Page;
  }, [bootstrapData]);

  const serverFiles = serverFilesData ?? EMPTY_FILE_ARRAY;
  const parentPage =
    serverPage ||
    bootstrapRootMetaPage ||
    (projectDocs.length > 0 ? projectDocs[0] : null);
  const childFiles = serverFiles;

  const parentProjectId =
    bootstrapData && bootstrapData.workspace.spaceType !== 'project'
      ? null
      : extractProjectId(parentPage?.projectId) ||
        (bootstrapData?.workspace.spaceType === 'project'
          ? bootstrapData.workspace.spaceId
          : null) ||
        null;
  const effectiveProjectId = projectId || parentProjectId || null;

  const mainId =
    typeof parentPage?.mainFile === 'string'
      ? parentPage.mainFile
      : (parentPage?.mainFile as Page | undefined)?.id ||
        (parentPage as { mainFileId?: string })?.mainFileId;

  const isResolvedMain =
    isMainFile ||
    resolvedFileId === parentPage?.id ||
    Boolean(mainId && resolvedFileId === mainId);

  // Clear stale ?file=... query param if backend bootstrap gracefully fell back to rootDoc
  useEffect(() => {
    if (bootstrapData?.activeDoc.fallbackToRoot && fileId) {
      syncShallowFileUrlParam(null);
    }
  }, [bootstrapData?.activeDoc.fallbackToRoot, fileId]);

  // When a child file is active, query its complete content from server (hits bootstrap cache on initial load)
  const activeFileId = !isResolvedMain && resolvedFileId ? resolvedFileId : null;
  const { data: activeFileDoc, isLoading: fileLoading } = useQuery({
    ...pageQuery(activeFileId || ''),
    enabled: Boolean(activeFileId) && !bootstrapPending,
  });

  const activeFile = useMemo(() => {
    if (!resolvedFileId || isResolvedMain) return undefined;
    if (activeFileDoc) return activeFileDoc;
    // Check in-memory LRU document cache for instantaneous tab-switching (0ms)
    const cached = lruDocumentCache.getModel(resolvedFileId);
    if (cached && typeof cached.content === 'string') {
      const meta = childFiles.find((f) => f.id === resolvedFileId || f.title === resolvedFileId);
      return {
        id: resolvedFileId,
        title: meta?.title || cached.filePath || 'untitled.tex',
        path: cached.filePath || meta?.path || 'untitled.tex',
        content: cached.content,
      } as unknown as Page;
    }
    const meta = childFiles.find((f) => f.id === resolvedFileId || f.title === resolvedFileId);
    if (meta && typeof meta.content === 'string' && meta.content.length > 0) return meta;
    if (
      isStoreScopedToCurrentPage &&
      storeActiveFilePage &&
      storeActiveFilePage.id === resolvedFileId
    ) {
      return storeActiveFilePage;
    }
    return undefined;
  }, [resolvedFileId, isResolvedMain, activeFileDoc, childFiles, isStoreScopedToCurrentPage, storeActiveFilePage]);

  // Keep LRU cache synchronized when active documents are loaded from server
  useEffect(() => {
    if (activeFileDoc && activeFileDoc.id && typeof activeFileDoc.content === 'string') {
      lruDocumentCache.registerModel(activeFileDoc.id, {
        content: activeFileDoc.content,
        filePath: activeFileDoc.path || activeFileDoc.title || 'untitled.tex',
        projectId: effectiveProjectId || pageId || undefined,
        ...(activeFileDoc.spaceId ? { spaceId: activeFileDoc.spaceId } : {}),
        ...(pageId ? { pageId } : {}),
        ...(typeof activeFileDoc.rev === 'number' ? { serverRev: activeFileDoc.rev } : {}),
        ...(activeFileDoc.hash !== undefined ? { hash: activeFileDoc.hash } : {}),
        ...(activeFileDoc.updatedAt ? { serverUpdatedAt: activeFileDoc.updatedAt } : {}),
        isAuthoritative: true,
      });
    }
  }, [activeFileDoc, effectiveProjectId, pageId]);

  useEffect(() => {
    if (parentPage && parentPage.id && typeof parentPage.content === 'string') {
      lruDocumentCache.registerModel(parentPage.id, {
        content: parentPage.content,
        filePath: parentPage.path || parentPage.title || 'main.tex',
        projectId: effectiveProjectId || pageId || undefined,
        ...(parentPage.spaceId ? { spaceId: parentPage.spaceId } : {}),
        ...(pageId ? { pageId } : {}),
        ...(typeof parentPage.rev === 'number' ? { serverRev: parentPage.rev } : {}),
        ...(parentPage.hash !== undefined ? { hash: parentPage.hash } : {}),
        ...(parentPage.updatedAt ? { serverUpdatedAt: parentPage.updatedAt } : {}),
        isAuthoritative: true,
      });
    }
  }, [parentPage, effectiveProjectId, pageId]);

  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const setActiveFilePage = usePageStore((s) => s.setActiveFilePage);
  const setActivePageId = usePageStore((s) => s.setActivePageId);
  const setParentPageId = usePageStore((s) => s.setParentPageId);
  const setMainDocument = usePageStore((s) => s.setMainDocument);
  const setSpaceId = usePageStore((s) => s.setSpaceId);
  const setProjectId = usePageStore((s) => s.setProjectId);
  const activePageId = usePageStore((s) => s.activePageId);

  const openTab = useWorkspaceStore((s) => s.openTab);
  const setActive = useWorkspaceStore((s) => s.setActiveTab);
  const hydratePageTabs = useWorkspaceStore((s) => s.hydratePageTabs);
  const hydratedPageScopeRef = useRef<string | null>(null);

  useEffect(() => {
    const resolvedSpaceId =
      bootstrapData?.workspace?.spaceId || effectiveProjectId || '';
    if (resolvedSpaceId) setSpaceId(resolvedSpaceId);
    if (effectiveProjectId) setProjectId(effectiveProjectId);
    const canonicalPageId = bootstrapData?.workspace?.pageId || pageId;
    if (canonicalPageId) setParentPageId(canonicalPageId);
    if (bootstrapData?.workspace) {
      const ws = bootstrapData.workspace;
      const normalizedWsMain = normalizeVirtualPath(ws.mainFilePath || '') || null;
      setMainDocument({
        rootDocId: ws.rootDocId ?? null,
        mainFilePath: normalizedWsMain,
      });
      latexDependencyGraph.setServerRootDoc(normalizedWsMain, ws.rootDocId ?? null);
    } else if (parentPage && !usePageStore.getState().mainFilePath) {
      const rawMainTitle =
        typeof parentPage.mainFile === 'object' && parentPage.mainFile
          ? (parentPage.mainFile as { title?: string }).title
          : parentPage.path || parentPage.title;
      const normalizedFallback = normalizeVirtualPath(rawMainTitle || '') || null;
      const resolvedFallbackId = mainId || parentPage.id || null;
      if (normalizedFallback) {
        setMainDocument({
          rootDocId: resolvedFallbackId,
          mainFilePath: normalizedFallback,
        });
        latexDependencyGraph.setServerRootDoc(normalizedFallback, resolvedFallbackId);
      }
    }
  }, [
    effectiveProjectId,
    pageId,
    bootstrapData?.workspace,
    parentPage,
    mainId,
    setSpaceId,
    setProjectId,
    setParentPageId,
    setMainDocument,
  ]);

  // Synchronize VFS file tree to workspace coordinator and initiate deferred symbols index
  useEffect(() => {
    if (!serverFiles && !parentPage) return;
    const allFiles: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> = [
      ...(serverFiles || []),
    ];
    if (parentPage && !allFiles.some((f) => f.id === parentPage.id)) {
      allFiles.unshift(parentPage);
    }
    if (allFiles.length > 0) {
      workspaceCoordinator.initProjectSymbols(allFiles, effectiveProjectId || pageId || undefined);
    }
    const targetSymbolScope =
      bootstrapData?.workspace.pageId || pageId || effectiveProjectId;
    if (targetSymbolScope) {
      if (
        bootstrapData?.symbols &&
        !bootstrapData.degradedBranches.includes('symbols')
      ) {
        latexSymbolsIndex.hydrateFromDto(bootstrapData.symbols, targetSymbolScope);
      } else if (!latexSymbolsIndex.hasHydratedProject(targetSymbolScope)) {
        latexSymbolsIndex.refreshFromServer(targetSymbolScope, 50);
      }
    }
  }, [serverFiles, parentPage, effectiveProjectId, pageId, bootstrapData]);

  // Hydrate persisted per-page tabs + per-window session split state on Page mount/F5 reload
  useEffect(() => {
    if (!pageId || !parentPage) return;
    const scopeKey = `${pageId}:${parentPage.id}`;
    if (hydratedPageScopeRef.current === scopeKey) return;
    hydratedPageScopeRef.current = scopeKey;

    const configuredMain = usePageStore.getState().mainFilePath || DEFAULT_MAIN_FILE;
    const resolvedTitle = (parentPage.title || '').trim() || configuredMain;
    hydratePageTabs(pageId, {
      rootDocId: parentPage.id,
      rootTitle: resolvedTitle,
      urlFileId: fileId,
    });
  }, [pageId, parentPage, fileId, hydratePageTabs]);

  useEffect(() => {
    if (!parentPage) return;

    const pageStore = usePageStore.getState();
    if (pageStore.currentPage !== parentPage) {
      setCurrentPage?.(parentPage);
    }
    if (pageId && pageStore.parentPageId !== pageId) {
      setParentPageId?.(pageId);
    }

    if (isResolvedMain) {
      if (pageStore.activeFilePage !== parentPage) {
        setActiveFilePage?.(parentPage);
      }
      if (pageStore.activePageId !== parentPage.id) {
        setActivePageId?.(parentPage.id);
      }

      const configuredMain = usePageStore.getState().mainFilePath || DEFAULT_MAIN_FILE;
      const rawTitle = (parentPage.title || '').trim();
      const resolvedTitle = !rawTitle ? configuredMain : rawTitle;

      syncWorkspaceTabs(
        [pageId || projectId],
        { id: parentPage.id, title: resolvedTitle },
        { onlyIfUninitialized: true, openTab, setActive },
      );
    } else if (activeFile) {
      if (pageStore.activeFilePage !== activeFile) {
        setActiveFilePage?.(activeFile);
      }
      if (pageStore.activePageId !== activeFile.id) {
        setActivePageId?.(activeFile.id);
      }

      syncWorkspaceTabs(
        [pageId || projectId],
        { id: activeFile.id, title: activeFile.title, path: activeFile.path },
        { openTab, setActive },
      );
    }
  }, [
    isResolvedMain,
    resolvedFileId,
    pageId,
    projectId,
    parentPage,
    activeFile,
    setCurrentPage,
    setActiveFilePage,
    setActivePageId,
    setParentPageId,
    openTab,
    setActive,
  ]);

  const selectFile = useCallback((targetFileId: string) => {
    const isTargetMain =
      targetFileId === pageId ||
      targetFileId === parentPage?.id ||
      (mainId && targetFileId === mainId);

    const targetTabId = isTargetMain ? pageId : targetFileId;
    const targetFile = isTargetMain
      ? parentPage
      : childFiles.find((f) => f.id === targetFileId || f.title === targetFileId);

    const configuredMain = usePageStore.getState().mainFilePath || DEFAULT_MAIN_FILE;
    const targetTitle = targetFile?.title || (isTargetMain ? configuredMain : targetFileId);

    syncWorkspaceTabs(
      [pageId || projectId],
      { id: targetTabId, title: targetTitle },
      { openTab, setActive },
    );

    // Shallow history URL update: 0ms latency, eliminates Next.js router transitions
    syncShallowFileUrlParam(isTargetMain ? null : targetFileId);
  }, [pageId, parentPage, mainId, childFiles, openTab, setActive, projectId]);

  const selectedAsset = usePageStore((s) => s.selectedAsset);
  const isAssetTab = activeTabId?.startsWith('asset:') || false;
  const activePage = isResolvedMain ? parentPage : (activeFile || null);
  const displayPage = isAssetTab ? null : activePage;

  const isDocumentLoading =
    bootstrapPending ||
    (Boolean(projectId && !directPageId) && projectDocsLoading) ||
    (parentLoading && !parentPage) ||
    (Boolean(activeFileId) && !activeFile && fileLoading);

  return {
    parentPage,
    activePage,
    displayPage,
    childFiles,
    isLoading: isDocumentLoading,
    isChildLoading: fileLoading,
    selectFile,
    activePageId,
    pageId,
    fileId: resolvedFileId,
    isAssetTab,
    selectedAsset,
    projectId: effectiveProjectId,
  };
}
