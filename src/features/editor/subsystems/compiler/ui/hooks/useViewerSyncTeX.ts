'use client';

/**
 * use-viewer-synctex.ts
 *
 * Bidirectional SyncTeX Navigation Controller (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-viewer-synctex.ts`
 */

import { useCallback, useEffect } from 'react';
import { usePageStore, useTabsStore, type EditorTab, editorCommandBus, getActiveEditorEngine, workspaceCoordinator } from '@/features/editor/core';
import type { NodeTreeItem } from '@/features/editor/domain/types/node.types';
import { useViewerStore } from '@/features/editor/subsystems/compiler/coordinator/viewer.store';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  DEFAULT_PDF_PAGE_HEIGHT_PT,
  type PdfPageDimensions,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import type { SurfaceHandle } from '@/features/editor/subsystems/compiler/ui/PdfSurface';

export interface ViewerPageFileEntry {
  id: string;
  title: string;
  path?: string;
  content?: string;
}

export interface UseViewerSyncTeXOptions {
  pageId: string | null;
  projectId?: string;
  scale: number;
  autoFit?: boolean;
  containerWidth?: number;
  numPages: number;
  pageNumber?: number;
  setPageNumber?: (p: number | ((prev: number) => number)) => void;
  pdfSurfaceRef: React.RefObject<SurfaceHandle | null>;
  synctexMapRef: React.MutableRefObject<SyncTeXMap | null>;
  pageFiles: ViewerPageFileEntry[];
  pageDimensions?: PdfPageDimensions;
}

export function useViewerSyncTeX({
  pageId,
  projectId,
  scale,
  autoFit,
  containerWidth,
  numPages,
  pageNumber,
  setPageNumber,
  pdfSurfaceRef,
  synctexMapRef,
  pageFiles,
  pageDimensions,
}: UseViewerSyncTeXOptions) {
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const widthPt =
    pageDimensions?.widthPt && pageDimensions.widthPt > 0
      ? pageDimensions.widthPt
      : DEFAULT_PDF_PAGE_WIDTH_PT;
  const heightPt =
    pageDimensions?.heightPt && pageDimensions.heightPt > 0
      ? pageDimensions.heightPt
      : DEFAULT_PDF_PAGE_HEIGHT_PT;

  const findPageByBasename = useCallback(
    (basename: string) => {
      const normalized = basename.replace(/\\/g, '/');
      const cleanName = normalized.replace(/^\.\//, '').toLowerCase();
      const baseNoExt = cleanName.replace(/\.(tex|bib|sty|cls)$/i, '');
      const bareName = cleanName.split('/').pop() || cleanName;
      const bareNoExt = bareName.replace(/\.(tex|bib|sty|cls)$/i, '');

      const candidateFiles: ViewerPageFileEntry[] = [...pageFiles];
      const wsFiles = workspaceCoordinator.getProjectFiles() || [];
      for (const wf of wsFiles) {
        if (wf.id && !candidateFiles.some((c) => c.id === wf.id)) {
          candidateFiles.push({
            id: wf.id,
            title: wf.title || wf.path || wf.id,
            path: wf.path || wf.title,
            content: typeof wf.content === 'string' ? wf.content : undefined,
          });
        }
      }
      const treeStack: Array<{ node: NodeTreeItem; parentPath: string }> = (
        usePageStore.getState().fileHierarchy ?? []
      ).map((n) => ({ node: n, parentPath: '' }));
      while (treeStack.length > 0) {
        const { node, parentPath } = treeStack.pop()!;
        const fullPath = parentPath ? `${parentPath}/${node.title}` : node.title;
        const isFolder = Boolean((node as { isFolder?: boolean }).isFolder || (node.children && node.children.length > 0));
        if (!isFolder && node.id && !candidateFiles.some((c) => c.id === node.id)) {
          candidateFiles.push({
            id: node.id,
            title: node.title,
            path: fullPath,
          });
        }
        if (node.children?.length) {
          for (const child of node.children) {
            treeStack.push({ node: child, parentPath: fullPath });
          }
        }
      }

      // 1. Exact child file path match in candidateFiles (prioritize subfiles first)
      const exactChild = candidateFiles.find((p) => {
        const pPathLower = (p.path || p.title || '').replace(/\\/g, '/').toLowerCase();
        return (
          pPathLower === cleanName ||
          pPathLower.replace(/\.(tex|bib|sty|cls)$/i, '') === baseNoExt ||
          cleanName.endsWith('/' + pPathLower) ||
          pPathLower.endsWith('/' + cleanName)
        );
      });
      if (exactChild) return exactChild;

      // 2. Match LRU Document in-memory cache by path
      const cached = lruDocumentCache.findByPath(cleanName);
      if (cached) {
        return {
          id: cached.fileId,
          title: cached.filePath,
          path: cached.filePath,
        };
      }

      // 3. Match root document (main.tex) from currentPage
      const currentPage = usePageStore.getState().currentPage;
      if (currentPage) {
        const rootTitle = (currentPage.title || 'main.tex').replace(/\\/g, '/').toLowerCase();
        const rootBase = rootTitle.split('/').pop() || rootTitle;
        if (
          rootTitle === cleanName ||
          rootTitle.replace(/\.(tex|bib|sty|cls)$/i, '') === baseNoExt ||
          cleanName.endsWith('/' + rootTitle) ||
          (!cleanName.includes('/') &&
            (bareName === rootBase || bareNoExt === rootBase.replace(/\.(tex|bib|sty|cls)$/i, '')))
        ) {
          return {
            id: currentPage.id,
            title: currentPage.title || 'main.tex',
            path: currentPage.title || 'main.tex',
          };
        }
      }

      // 4. Fallback to child files by bare filename
      const bareMatch = candidateFiles.find((p) => {
        const titleLower = (p.title || '').replace(/\\/g, '/').toLowerCase();
        const pBare = titleLower.split('/').pop() || titleLower;
        return pBare === bareName || pBare.replace(/\.(tex|bib|sty|cls)$/i, '') === bareNoExt;
      });
      if (bareMatch) return bareMatch;

      // 5. Match open tabs in useTabsStore
      const tabsByProject = useTabsStore.getState().tabsByProject;
      const allTabs = Object.values(tabsByProject).flat();
      const matchingTab = allTabs.find((t: EditorTab) => {
        const tPath = (t.path || t.title || '').replace(/\\/g, '/').toLowerCase();
        const tBare = tPath.split('/').pop() || tPath;
        return tPath === cleanName || tBare === bareName || cleanName.endsWith(tPath);
      });
      if (matchingTab) {
        return {
          id: matchingTab.id,
          title: matchingTab.title,
          path: matchingTab.path || matchingTab.title,
        };
      }

      return undefined;
    },
    [pageFiles],
  );

  // Jump from PDF click / SyncTeX backward jump directly to source line in editor
  const handleJumpToSource = useCallback(
    async (
      sourcePath: string | null,
      line: number,
      pageNum?: number,
      x?: number,
      y?: number,
      highlightType: 'error' | 'synctex' = 'synctex',
    ) => {
      let targetPath = sourcePath;
      let targetLine = line;

      // Remote fallback: if local map had no target or line <= 1, query backend SyncTeX processor
      const rootId = projectId || pageId;
      if ((!targetPath || targetLine <= 1) && rootId && pageNum && x !== undefined && y !== undefined) {
        try {
          const remoteRes = await compilerCoordinator.resolveReverseRemote(
            rootId,
            pageNum,
            x,
            y,
          );
          if (remoteRes && remoteRes.line) {
            targetPath = remoteRes.sourcePath;
            targetLine = remoteRes.line;
          }
        } catch {}
      }

      if (targetPath) {
        const cleanPath = targetPath.replace(/^\.\//, '');
        const targetPage = findPageByBasename(cleanPath);

        if (targetPage) {
          // Instant 0ms document switch via navigation coordinator (no page reload)
          navigationCoordinator.openDocument({
            fileId: targetPage.id,
            title: targetPage.title,
            path: targetPage.path,
            content: (targetPage as ViewerPageFileEntry).content,
            line: targetLine,
            highlight: highlightType,
          });
          return;
        }
      }

      // Fallback: If no file was specified in the error or SyncTeX node, jump in root/active document
      const pageStore = usePageStore.getState();
      const fallbackDoc = pageStore.activeFilePage || pageStore.currentPage;
      if (fallbackDoc) {
        navigationCoordinator.jumpToLine({
          fileId: fallbackDoc.id,
          line: targetLine,
          highlight: highlightType,
        });
      }
    },
    [
      findPageByBasename,
      pageId,
      projectId,
    ],
  );

  const handleJumpToPage = useCallback(
    (targetPage: number) => {
      const p = Math.max(1, Math.min(targetPage, numPages || 1));
      const updatePage = setPageNumber ?? useViewerStore.getState().setPageNumber;
      updatePage(p);
      pdfSurfaceRef.current?.scrollToPage(p);
    },
    [numPages, setPageNumber, pdfSurfaceRef],
  );

  // Subscribe to viewer:goto-page command from EditorCommandBus
  useEffect(() => {
    const unsub = editorCommandBus.subscribe('viewer:goto-page', (cmd) => {
      handleJumpToPage(cmd.page);
    });
    return unsub;
  }, [handleJumpToPage]);

  // SyncTeX forward sync (Code cursor -> PDF highlight)
  useEffect(() => {
    const handleForwardSync = async (line?: number, overrideFilePath?: string) => {
      const targetLine: number = Math.max(1, line ?? getActiveEditorEngine()?.getCursorPosition?.()?.line ?? 1);

      const rootId = projectId || pageId;
      if (!rootId) return;
      const filename =
        overrideFilePath ||
        (activeFilePage && 'path' in activeFilePage && typeof activeFilePage.path === 'string'
          ? activeFilePage.path
          : undefined) ||
        activeFilePage?.title ||
        'main.tex';

      const effectiveScale =
        autoFit && containerWidth && containerWidth > 0
          ? containerWidth / widthPt
          : (scale > 0 ? scale : 1);

      // 1. Try Backend Single Source of Truth
      const remoteRes = await compilerCoordinator.resolveForwardRemote(
        rootId,
        filename,
        targetLine,
      );

      let targetPage = remoteRes?.page ?? null;
      let targetX = remoteRes ? remoteRes.x * effectiveScale : undefined;
      let targetY = remoteRes ? remoteRes.y * effectiveScale : undefined;
      let targetW = remoteRes && remoteRes.w !== undefined ? remoteRes.w * effectiveScale : undefined;
      let targetH = remoteRes && remoteRes.h !== undefined ? remoteRes.h * effectiveScale : undefined;

      if (!targetPage) {
        const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
        const localDetail = compilerCoordinator.resolveForwardDetail(
          targetLine,
          filename,
          numPages || 1,
          effectiveMap,
        );
        if (localDetail) {
          targetPage = localDetail.page;
          if (localDetail.x !== undefined && localDetail.y !== undefined) {
            targetX = localDetail.x * effectiveScale;
            targetY = localDetail.y * effectiveScale;
            targetW = localDetail.w !== undefined ? localDetail.w * effectiveScale : undefined;
            targetH = localDetail.h !== undefined ? localDetail.h * effectiveScale : undefined;
          }
        }
      }

      if (!targetPage) {
        const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
        targetPage = compilerCoordinator.resolveForward(
          targetLine,
          filename,
          numPages || 1,
          effectiveMap,
        );
      }

      if (targetPage) {
        const updatePage = setPageNumber ?? useViewerStore.getState().setPageNumber;
        updatePage(targetPage);
        if (targetX !== undefined && targetY !== undefined) {
          pdfSurfaceRef.current?.highlightTarget?.(targetPage, targetX, targetY, targetW, targetH);
        } else {
          const fallbackX = 72 * effectiveScale;
          const fallbackY = 100 * effectiveScale;
          pdfSurfaceRef.current?.highlightTarget?.(targetPage, fallbackX, fallbackY, targetW, targetH);
        }
      }
    };

    const unsubJump = editorCommandBus.subscribe('viewer:jump-to-line', (cmd) => {
      handleForwardSync(cmd.line);
    });

    const unsubForward = editorCommandBus.subscribe('synctex:forward', (cmd) => {
      handleForwardSync(cmd.line, cmd.filePath);
    });

    return () => {
      unsubJump();
      unsubForward();
    };
  }, [pageId, projectId, activeFilePage, scale, autoFit, containerWidth, widthPt, numPages, setPageNumber, pdfSurfaceRef, synctexMapRef]);

  // SyncTeX reverse search event listener
  useEffect(() => {
    const handleReverse = async (customPage?: number, customX?: number, customY?: number) => {
      const p = customPage || pageNumber || useViewerStore.getState().pageNumber || 1;
      const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
      let resolved = compilerCoordinator.resolveReverse(
        0.25,
        p,
        customX,
        customY,
        effectiveMap,
        heightPt,
      );

      if (!resolved || !resolved.line) {
        const rootId = projectId || pageId;
        if (rootId && customX !== undefined && customY !== undefined) {
          try {
            const remoteRes = await compilerCoordinator.resolveReverseRemote(
              rootId,
              p,
              customX,
              customY,
            );
            if (remoteRes && remoteRes.line) {
              resolved = remoteRes;
            }
          } catch {}
        }
      }

      if (resolved?.line && resolved.line >= 1) {
        void handleJumpToSource(resolved.sourcePath, resolved.line, p, customX, customY);
      }
    };

    const unsubCmd = editorCommandBus.subscribe('synctex:backward', (cmd) => {
      void handleReverse(cmd.page, cmd.x, cmd.y);
    });

    return () => {
      unsubCmd();
    };
  }, [handleJumpToSource, synctexMapRef, pageId, projectId, pageNumber, heightPt]);

  return {
    handleJumpToSource,
    handleJumpToPage,
  };
}
