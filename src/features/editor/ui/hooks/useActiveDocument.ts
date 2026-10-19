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

import { useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { workspaceCoordinator, usePageStore, useWorkspaceStore, useSettingsStore } from '@/features/editor/core';
import { pageQuery, filesQuery } from './document.queries';
import { extractProjectId, type Page } from '@/features/editor/domain/types/core.types';
import type { NodeTreeItem } from '@/features/editor/domain/types/node.types';

import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';

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
  const tabsByProject = useWorkspaceStore.getState().tabsByProject;

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
    options.setActive(rawScope, tab.id);
  }
}

export function useActiveDocument() {
  const router = useRouter();
  const pathname = usePathname();
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

  // Canonical Overleaf project route resolution: when visiting /projects/:projectId directly
  const { data: projectDocs = [], isLoading: projectDocsLoading } = useQuery({
    queryKey: ['projects', projectId, 'docs'],
    queryFn: () => manuscriptService.docs.getProjectDocs(projectId!),
    enabled: !!projectId && !directPageId,
  });

  const pageId = directPageId || projectDocs[0]?.id || '';

  const searchParams = useSearchParams();
  const fileId = searchParams.get('file');

  const { data: serverPage, isLoading: parentLoading } = useQuery({
    ...pageQuery(pageId || ''),
    enabled: !!pageId,
  });

  const { data: serverFiles = [], isLoading: filesLoading } = useQuery({
    ...filesQuery(pageId || ''),
    enabled: !!pageId,
  });

  const parentPage = serverPage || (projectDocs.length > 0 ? projectDocs[0] : null);
  const childFiles = useMemo(() => serverFiles || [], [serverFiles]);

  const parentProjectId = extractProjectId(parentPage?.projectId) || null;
  const effectiveProjectId = projectId || parentProjectId || null;

  const mainId =
    typeof parentPage?.mainFile === 'string'
      ? parentPage.mainFile
      : (parentPage?.mainFile as Page | undefined)?.id ||
        (parentPage as { mainFileId?: string })?.mainFileId;

  const storeActiveFileId = usePageStore((s) => s.activeFilePage?.id ?? null);
  const activeTabId = useWorkspaceStore((s) => {
    for (const key of [effectiveProjectId, pageId, projectId]) {
      if (key && s.activeByProject[key]) {
        return s.activeByProject[key];
      }
    }
    return null;
  });

  // Synchronously resolve active file ID: in-memory active tab or pageStore.activeFilePage takes precedence
  const resolvedFileId =
    activeTabId ||
    (storeActiveFileId && storeActiveFileId !== pageId ? storeActiveFileId : null) ||
    fileId;

  const isMainFile =
    !resolvedFileId ||
    resolvedFileId === pageId ||
    resolvedFileId === `${pageId}-main` ||
    resolvedFileId === parentPage?.id ||
    Boolean(mainId && resolvedFileId === mainId);

  // When a child file is active, query its complete content from server
  const activeFileId = !isMainFile && resolvedFileId ? resolvedFileId : null;
  const { data: activeFileDoc, isLoading: fileLoading } = useQuery({
    ...pageQuery(activeFileId || ''),
    enabled: Boolean(activeFileId),
  });

  const activeFile = useMemo(() => {
    if (!resolvedFileId || isMainFile) return undefined;
    if (activeFileDoc) return activeFileDoc;
    const meta = childFiles.find((f) => f.id === resolvedFileId || f.title === resolvedFileId);
    if (meta && typeof meta.content === 'string' && meta.content.length > 0) return meta;
    const currentStoreFile = usePageStore.getState().activeFilePage;
    if (currentStoreFile && currentStoreFile.id === resolvedFileId) {
      return currentStoreFile;
    }
    return undefined;
  }, [resolvedFileId, isMainFile, activeFileDoc, childFiles, storeActiveFileId]);

  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const setActiveFilePage = usePageStore((s) => s.setActiveFilePage);
  const setActivePageId = usePageStore((s) => s.setActivePageId);
  const setParentPageId = usePageStore((s) => s.setParentPageId);
  const setProjectId = usePageStore((s) => s.setProjectId);
  const activePageId = usePageStore((s) => s.activePageId);

  const openTab = useWorkspaceStore((s) => s.openTab);
  const setActive = useWorkspaceStore((s) => s.setActiveTab);

  useEffect(() => {
    if (effectiveProjectId && typeof setProjectId === 'function') setProjectId(effectiveProjectId);
    if (pageId && typeof setParentPageId === 'function') setParentPageId(pageId);
  }, [effectiveProjectId, pageId, setProjectId, setParentPageId]);

  // Proactively index all project files for 0ms cross-file \cite, \ref, and DAG symbols
  useEffect(() => {
    if (!serverFiles && !parentPage) return;
    const allFiles: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }> = [
      ...(serverFiles || []),
    ];
    if (parentPage && !allFiles.some((f) => f.id === parentPage.id)) {
      allFiles.unshift(parentPage);
    }
    if (allFiles.length > 0) {
      workspaceCoordinator.initProjectSymbols(allFiles);
    }
  }, [serverFiles, parentPage]);

  useEffect(() => {
    if (!parentPage) return;

    setCurrentPage?.(parentPage);
    if (pageId) setParentPageId?.(pageId);

    if (isMainFile) {
      setActiveFilePage?.(parentPage);
      setActivePageId?.(parentPage.id);

      const configuredMain = useSettingsStore.getState().mainFile || 'main.tex';
      const rawTitle = (parentPage.title || '').trim();
      const resolvedTitle =
        !rawTitle || rawTitle.toLowerCase() === 'flux'
          ? configuredMain
          : rawTitle;

      syncWorkspaceTabs(
        [pageId, projectId],
        { id: parentPage.id, title: resolvedTitle },
        { onlyIfUninitialized: true, openTab, setActive },
      );
    } else if (activeFile) {
      setActiveFilePage?.(activeFile);
      setActivePageId?.(activeFile.id);

      syncWorkspaceTabs(
        [pageId, projectId],
        { id: activeFile.id, title: activeFile.title },
        { openTab, setActive },
      );
    }
  }, [
    isMainFile,
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

    const configuredMain = useSettingsStore.getState().mainFile || 'main.tex';
    const targetTitle = targetFile?.title || (isTargetMain ? configuredMain : targetFileId);

    syncWorkspaceTabs(
      [pageId, projectId],
      { id: targetTabId, title: targetTitle },
      { openTab, setActive },
    );

    // Shallow history URL update: 0ms latency, eliminates Next.js router transitions
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (isTargetMain) {
        url.searchParams.delete('file');
      } else {
        url.searchParams.set('file', targetFileId);
      }
      window.history.replaceState(window.history.state, '', url.pathname + url.search);
    }
  }, [pageId, parentPage, mainId, childFiles, openTab, setActive, projectId]);

  const selectedAsset = usePageStore((s) => s.selectedAsset);
  const isAssetTab = activeTabId?.startsWith('asset:') || false;
  const activePage = isMainFile ? parentPage : (activeFile || null);
  const displayPage = isAssetTab ? null : activePage;

  const isDocumentLoading =
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
