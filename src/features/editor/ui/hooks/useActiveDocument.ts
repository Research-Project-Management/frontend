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
import { workspaceCoordinator } from '@/features/editor/coordinators/workspace.coordinator';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useTabsStore } from '@/features/editor/store/tabs.store';
import { pageQuery, filesQuery } from './document.queries';
import type { Page } from '@/features/editor/domain/types/core.types';
import type { NodeTreeItem } from '@/features/editor/domain/types/node.types';

export function useActiveDocument() {
  const router = useRouter();
  const pathname = usePathname();
  const { projectId: rawProjectId, pageId: rawPageId, draftId } = useParams<{
    projectId?: string;
    pageId?: string;
    draftId?: string;
  }>();

  const directPageId = rawPageId || draftId || '';
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
  const childFiles = serverFiles || [];

  const mainId =
    typeof parentPage?.mainFile === 'string'
      ? parentPage.mainFile
      : (parentPage?.mainFile as Page | undefined)?.id ||
        (parentPage as { mainFileId?: string })?.mainFileId;

  const activeTabId = useTabsStore((s) =>
    (pageId ? s.activeByProject[pageId] : null) ||
    (projectId ? s.activeByProject[projectId] : null) ||
    null
  );

  // Synchronously resolve active file ID: in-memory active tab takes precedence, falling back to searchParams (?file=...)
  const resolvedFileId = activeTabId || fileId;

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
    return undefined;
  }, [resolvedFileId, isMainFile, activeFileDoc, childFiles]);

  const setCurrentPage = usePageStore((s) => s.setCurrentPage);
  const setFileHierarchy = usePageStore((s) => s.setFileHierarchy);
  const setActivePageId = usePageStore((s) => s.setActivePageId);
  const setParentPageId = usePageStore((s) => s.setParentPageId);
  const setProjectId = usePageStore((s) => s.setProjectId);
  const activePageId = usePageStore((s) => s.activePageId);

  const openTab = useTabsStore((s) => s.openTab);
  const setActive = useTabsStore((s) => s.setActive);
  const rawParentProj =
    typeof parentPage?.projectId === 'object'
      ? parentPage?.projectId?.id
      : parentPage?.projectId;
  const parentProjectId = rawParentProj || null;
  const effectiveProjectId = projectId || parentProjectId || null;

  useEffect(() => {
    if (effectiveProjectId && typeof setProjectId === 'function') setProjectId(effectiveProjectId);
    if (pageId && typeof setParentPageId === 'function') setParentPageId(pageId);
  }, [effectiveProjectId, pageId, setProjectId, setParentPageId]);

  useEffect(() => {
    if (parentPage && typeof setFileHierarchy === 'function') {
      const hierarchy = Array.isArray(parentPage)
        ? (parentPage as NodeTreeItem[])
        : Array.isArray((parentPage as unknown as { children?: NodeTreeItem[] }).children)
          ? (parentPage as unknown as { children: NodeTreeItem[] }).children
          : null;
      setFileHierarchy(hierarchy);
    }
  }, [parentPage, setFileHierarchy]);

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

    if (isMainFile) {
      setCurrentPage?.(parentPage);
      setActivePageId?.(parentPage.id);

      const rawTitle = parentPage.title || '';
      const resolvedTitle =
        rawTitle.toLowerCase() === 'flux' || rawTitle.toLowerCase() === 'flux.tex' || !rawTitle.includes('.')
          ? 'main.tex'
          : rawTitle;

      if (pageId) {
        const existingTabs = useTabsStore.getState().tabsByProject[pageId];
        // Only seed tab if project tabs are completely uninitialized
        if (existingTabs === undefined) {
          openTab(pageId, {
            id: parentPage.id,
            title: resolvedTitle,
          });
          setActive(pageId, parentPage.id);
        }
      }
      if (projectId && projectId !== pageId) {
        const existingTabs = useTabsStore.getState().tabsByProject[projectId];
        if (existingTabs === undefined) {
          openTab(projectId, {
            id: parentPage.id,
            title: resolvedTitle,
          });
          setActive(projectId, parentPage.id);
        }
      }
    } else if (activeFile) {
      setCurrentPage?.(activeFile);
      setActivePageId?.(activeFile.id);

      if (pageId) {
        openTab(pageId, {
          id: activeFile.id,
          title: activeFile.title,
        });
        setActive(pageId, activeFile.id);
      }
      if (projectId && projectId !== pageId) {
        openTab(projectId, {
          id: activeFile.id,
          title: activeFile.title,
        });
        setActive(projectId, activeFile.id);
      }
    }
  }, [
    isMainFile,
    resolvedFileId,
    pageId,
    projectId,
    parentPage,
    activeFile,
    setCurrentPage,
    setActivePageId,
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

    const targetTitle = targetFile?.title || (isTargetMain ? 'main.tex' : targetFileId);

    if (pageId) {
      openTab(pageId, { id: targetTabId, title: targetTitle });
      setActive(pageId, targetTabId);
    }
    if (projectId && projectId !== pageId) {
      openTab(projectId, { id: targetTabId, title: targetTitle });
      setActive(projectId, targetTabId);
    }

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
    (Boolean(activeFileId) && (fileLoading || !activeFileDoc));

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
