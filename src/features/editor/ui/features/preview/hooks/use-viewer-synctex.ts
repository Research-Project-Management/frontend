'use client';

/**
 * use-viewer-synctex.ts
 *
 * Bidirectional SyncTeX Navigation Controller (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-viewer-synctex.ts`
 */

import { useCallback, useEffect } from 'react';
import { usePageStore } from '../../../../store';
import { LatexCompilerEngine, type SyncTeXMap } from '../../../../domain/utils/viewer.util';
import { editorCommandBus, getActiveEditorEngine } from '../../../../coordinators/command-bus';
import { navigationCoordinator } from '../../../../coordinators/navigation.coordinator';
import { compilerCoordinator } from '../../../../coordinators/compiler.coordinator';
import { lruDocumentCache } from '../../../../domain/lru-document-cache';
import type { SurfaceHandle } from '../PdfSurface';

export interface UseViewerSyncTeXOptions {
  pageId: string | null;
  projectId?: string;
  scale: number;
  numPages: number;
  pageNumber: number;
  setPageNumber: (p: number | ((prev: number) => number)) => void;
  pdfSurfaceRef: React.RefObject<SurfaceHandle | null>;
  synctexMapRef: React.MutableRefObject<SyncTeXMap | null>;
  pageFiles: any[];
}

export function useViewerSyncTeX({
  pageId,
  projectId,
  scale,
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
      const cleanName = basename.replace(/^\.\//, '').toLowerCase();
      const baseNoExt = cleanName.replace(/\.(tex|bib|sty|cls)$/i, '');
      const bareName = cleanName.split('/').pop() || cleanName;
      const bareNoExt = bareName.replace(/\.(tex|bib|sty|cls)$/i, '');

      // 1. Match root document (main.tex) from currentPage
      const currentPage = usePageStore.getState().currentPage;
      if (currentPage) {
        const rootTitle = (currentPage.title || 'main.tex').toLowerCase();
        if (
          rootTitle === cleanName ||
          rootTitle.replace(/\.(tex|bib|sty|cls)$/i, '') === baseNoExt ||
          rootTitle === bareName ||
          rootTitle.replace(/\.(tex|bib|sty|cls)$/i, '') === bareNoExt
        ) {
          return {
            id: currentPage.id,
            title: currentPage.title || 'main.tex',
            path: currentPage.title || 'main.tex',
          };
        }
      }

      // 2. Match project child files
      const match = pageFiles.find((p: any) => {
        const titleLower = (p.title || '').toLowerCase();
        const pPathLower = (p.path || '').toLowerCase();
        const pBare = titleLower.split('/').pop() || titleLower;
        return (
          titleLower === cleanName ||
          titleLower.replace(/\.(tex|bib|sty|cls)$/i, '') === baseNoExt ||
          pBare === bareName ||
          pBare.replace(/\.(tex|bib|sty|cls)$/i, '') === bareNoExt ||
          (pPathLower && (pPathLower.endsWith(cleanName) || pPathLower.endsWith(bareName))) ||
          (pPathLower && cleanName.endsWith(pPathLower)) ||
          cleanName.endsWith(titleLower)
        );
      });
      if (match) return match;

      // 3. Match LRU Document in-memory cache
      const cached =
        lruDocumentCache.findByPath(cleanName) ||
        lruDocumentCache.findByPath(bareName) ||
        lruDocumentCache.getAllModels().find((m) => {
          const mLower = m.filePath.toLowerCase();
          return cleanName.endsWith(mLower) || mLower.endsWith(cleanName);
        });
      if (cached) {
        return {
          id: cached.fileId,
          title: cached.filePath,
          path: cached.filePath,
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
      const rootId = pageId || projectId;
      if ((!targetPath || targetLine <= 1) && rootId && pageNum && x !== undefined && y !== undefined) {
        try {
          const remoteRes = await LatexCompilerEngine.resolveReverseRemote(
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

      navigationCoordinator.jumpToLine({
        fileId: activeFilePage?.id,
        line: targetLine,
        highlight: highlightType,
      });
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
      setPageNumber(p);
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
      const targetLine: number = line ?? getActiveEditorEngine()?.getCursorPosition?.()?.line ?? 1;

      const rootId = pageId || projectId;
      if (!rootId) return;
      const filename = activeFilePage?.title || 'main.tex';

      // 1. Try Backend Single Source of Truth
      const remoteRes = await LatexCompilerEngine.resolveForwardRemote(
        rootId,
        filename,
        targetLine,
      );

      let targetPage = remoteRes?.page ?? null;
      let targetX = remoteRes ? remoteRes.x * scale : undefined;
      let targetY = remoteRes ? remoteRes.y * scale : undefined;
      let targetW = remoteRes && remoteRes.w !== undefined ? remoteRes.w * scale : undefined;
      let targetH = remoteRes && remoteRes.h !== undefined ? remoteRes.h * scale : undefined;

      if (!targetPage) {
        const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
        const localDetail = LatexCompilerEngine.resolveForwardDetail(
          targetLine,
          effectiveMap,
          activeFilePage?.title,
          numPages || 1,
        );
        if (localDetail) {
          targetPage = localDetail.page;
          if (localDetail.x !== undefined && localDetail.y !== undefined) {
            targetX = localDetail.x * scale;
            targetY = localDetail.y * scale;
            targetW = localDetail.w !== undefined ? localDetail.w * scale : undefined;
            targetH = localDetail.h !== undefined ? localDetail.h * scale : undefined;
          }
        }
      }

      if (!targetPage) {
        const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
        targetPage = LatexCompilerEngine.resolveForward(
          targetLine,
          effectiveMap,
          activeFilePage?.title,
          numPages || 1,
        );
      }

      if (targetPage) {
        setPageNumber(targetPage);
        pdfSurfaceRef.current?.scrollToPage(targetPage);
        if (targetX !== undefined && targetY !== undefined) {
          pdfSurfaceRef.current?.highlightTarget?.(targetPage, targetX, targetY, targetW, targetH);
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
  }, [pageId, projectId, activeFilePage?.title, scale, numPages, setPageNumber, pdfSurfaceRef, synctexMapRef]);

  // SyncTeX reverse search event listener
  useEffect(() => {
    const handleReverse = async (customPage?: number, customX?: number, customY?: number) => {
      const p = customPage || pageNumber || 1;
      const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
      let resolved = effectiveMap
        ? LatexCompilerEngine.resolveReverse(0.25, p, effectiveMap, customX, customY)
        : null;

      if (!resolved || !resolved.line) {
        const rootId = pageId || projectId;
        if (rootId && customX !== undefined && customY !== undefined) {
          try {
            const remoteRes = await LatexCompilerEngine.resolveReverseRemote(
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

      if (resolved?.line) {
        void handleJumpToSource(resolved.sourcePath, resolved.line, p, customX, customY);
      } else {
        void handleJumpToSource(null, 1, p, 200, 200);
      }
    };

    const unsubCmd = editorCommandBus.subscribe('synctex:backward', (cmd) => {
      void handleReverse(cmd.page, cmd.x, cmd.y);
    });

    return () => {
      unsubCmd();
    };
  }, [pageNumber, handleJumpToSource, synctexMapRef, pageId, projectId]);

  return {
    handleJumpToSource,
    handleJumpToPage,
  };
}
