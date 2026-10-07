'use client';

/**
 * use-viewer-synctex.ts
 *
 * Bidirectional SyncTeX Navigation Controller (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-viewer-synctex.ts`
 */

import { useCallback, useEffect } from 'react';
import { usePageStore } from '../../../../store';
import { LatexCompilerEngine, type SyncTeXMap } from '../../../../utils/viewer.util';
import { editorCommandBus } from '../../../../core/command-bus/editor-command-bus';
import { navigationCoordinator } from '../../../../coordinators/navigation.coordinator';
import { getActiveEditorEngine } from '../../../../core/context/editor-instance.context';
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
      return pageFiles.find((p: any) => {
        const titleLower = (p.title || '').toLowerCase();
        return (
          titleLower === cleanName ||
          titleLower.replace(/\.(tex|bib|sty|cls)$/i, '') === baseNoExt
        );
      });
    },
    [pageFiles],
  );

  // Jump from PDF click / SyncTeX backward jump directly to source line in editor
  const handleJumpToSource = useCallback(
    (
      sourcePath: string | null,
      line: number,
      _pageNum?: number,
      _x?: number,
      _y?: number,
      highlightType: 'error' | 'synctex' = 'synctex',
    ) => {
      if (sourcePath) {
        const cleanPath = sourcePath.replace(/^\.\//, '');
        const targetPage = findPageByBasename(cleanPath);

        if (targetPage) {
          // Instant 0ms document switch via navigation coordinator (no page reload)
          navigationCoordinator.openDocument({
            fileId: targetPage.id,
            title: targetPage.title,
            path: targetPage.path,
            line,
            highlight: highlightType,
          });
          return;
        }
      }

      navigationCoordinator.jumpToLine({
        fileId: activeFilePage?.id,
        line,
        highlight: highlightType,
      });
    },
    [
      findPageByBasename,
      activeFilePage?.id,
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
      let targetLine = line;
      if (targetLine === undefined || targetLine === null) {
        const engine = getActiveEditorEngine();
        targetLine = engine?.getCursorPosition?.()?.line ?? 1;
      }

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
        const localDetail = LatexCompilerEngine.resolveForwardDetail(
          targetLine,
          synctexMapRef.current,
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
        targetPage = LatexCompilerEngine.resolveForward(
          targetLine,
          synctexMapRef.current,
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
    const handleReverse = (customPage?: number, customX?: number, customY?: number) => {
      const p = customPage || pageNumber || 1;
      const resolved = synctexMapRef.current
        ? LatexCompilerEngine.resolveReverse(0.25, p, synctexMapRef.current, customX, customY)
        : null;
      if (resolved?.line) {
        handleJumpToSource(resolved.sourcePath, resolved.line, p, customX, customY);
      } else {
        handleJumpToSource(null, 1, p, 200, 200);
      }
    };

    const unsubCmd = editorCommandBus.subscribe('synctex:backward', (cmd) => {
      handleReverse(cmd.page, cmd.x, cmd.y);
    });

    return () => {
      unsubCmd();
    };
  }, [pageNumber, handleJumpToSource, synctexMapRef]);

  return {
    handleJumpToSource,
    handleJumpToPage,
  };
}
