'use client';

/**
 * use-viewer-synctex.ts
 *
 * Bidirectional SyncTeX Navigation Controller (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-viewer-synctex.ts`
 */

import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useViewerStore } from '@/features/editor/store/viewer.store';
import { useTabsStore, type EditorTab } from '../../../../store/tabs.store';
import type { SyncTeXMap } from '@/features/editor/domain/pdf/synctex-index';
import { editorCommandBus, getActiveEditorEngine } from '../../../../coordinators/command-bus';
import { navigationCoordinator } from '../../../../coordinators/navigation.coordinator';
import { compilerCoordinator } from '../../../../coordinators/compiler.coordinator';
import { lruDocumentCache } from '../../../../domain/document/lru-document-cache';
import type { SurfaceHandle } from '../PdfSurface';

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
  pageFiles: any[];
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
}: UseViewerSyncTeXOptions) {
  const activeFilePage = usePageStore((s) => s.activeFilePage);

  const findPageByBasename = useCallback(
    (basename: string) => {
      const normalized = basename.replace(/\\/g, '/');
      const cleanName = normalized.replace(/^\.\//, '').toLowerCase();
      const baseNoExt = cleanName.replace(/\.(tex|bib|sty|cls)$/i, '');
      const bareName = cleanName.split('/').pop() || cleanName;
      const bareNoExt = bareName.replace(/\.(tex|bib|sty|cls)$/i, '');

      // 1. Exact child file path match in pageFiles (prioritize subfiles first)
      const exactChild = pageFiles.find((p: any) => {
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
      const bareMatch = pageFiles.find((p: any) => {
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
      activeFilePage?.id,
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
    const handleForwardSync = async (line?: number) => {
      const targetLine: number = Math.max(1, line ?? getActiveEditorEngine()?.getCursorPosition?.()?.line ?? 1);

      const rootId = projectId || pageId;
      if (!rootId) return;
      const filename =
        (activeFilePage && 'path' in activeFilePage && typeof activeFilePage.path === 'string'
          ? activeFilePage.path
          : undefined) ||
        activeFilePage?.title ||
        'main.tex';

      const effectiveScale =
        autoFit && containerWidth && containerWidth > 0
          ? containerWidth / 595
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
      handleForwardSync(cmd.line);
    });

    return () => {
      unsubJump();
      unsubForward();
    };
  }, [pageId, projectId, activeFilePage?.title, scale, autoFit, containerWidth, numPages, setPageNumber, pdfSurfaceRef, synctexMapRef]);

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
      } else {
        // No SyncTeX data for this location: do not jump (previously fell back to line 1)
        toast.info('SyncTeX data unavailable for this location');
      }
    };

    const unsubCmd = editorCommandBus.subscribe('synctex:backward', (cmd) => {
      void handleReverse(cmd.page, cmd.x, cmd.y);
    });

    return () => {
      unsubCmd();
    };
  }, [handleJumpToSource, synctexMapRef, pageId, projectId]);

  return {
    handleJumpToSource,
    handleJumpToPage,
  };
}
