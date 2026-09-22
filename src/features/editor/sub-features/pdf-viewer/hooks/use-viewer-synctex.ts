'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageStore } from '../../../store';
import { LatexCompilerEngine, type SyncTeXMap } from '../../../utils/viewer.util';
import { EditorEventBus } from '../../../utils/editor.util';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import type { SurfaceHandle } from '../../../components/viewer/Surface';

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
  const router = useRouter();
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const setActiveFilePage = usePageStore((s) => s.setActiveFilePage);

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

        if (targetPage && targetPage.id !== activeFilePage?.id) {
          setActiveFilePage(targetPage);
          if (projectId) {
            router.push(`/projects/${projectId}/pages/${targetPage.id}`);
          }
          setTimeout(() => {
            editorCommandBus.dispatch({
              type: 'editor:jump-to-line',
              line,
              highlight: highlightType,
            });
          }, 200);
          return;
        }
      }

      editorCommandBus.dispatch({
        type: 'editor:jump-to-line',
        line,
        highlight: highlightType,
      });
    },
    [
      projectId,
      findPageByBasename,
      activeFilePage?.id,
      setActiveFilePage,
      router,
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
    const handleForwardSync = async (line: number) => {
      const rootId = pageId || projectId || 'default';
      const filename = activeFilePage?.title || 'main.tex';

      // 1. Try Backend Single Source of Truth
      const remoteRes = await LatexCompilerEngine.resolveForwardRemote(
        rootId,
        filename,
        line,
      );

      let targetPage = remoteRes?.page ?? null;
      let targetX = remoteRes ? remoteRes.x * scale : undefined;
      let targetY = remoteRes ? remoteRes.y * scale : undefined;
      let targetW = remoteRes && remoteRes.w !== undefined ? remoteRes.w * scale : undefined;
      let targetH = remoteRes && remoteRes.h !== undefined ? remoteRes.h * scale : undefined;

      if (!targetPage) {
        const localDetail = LatexCompilerEngine.resolveForwardDetail(
          line,
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
          line,
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

    const unsub = editorCommandBus.subscribe('viewer:jump-to-line', (cmd) => {
      handleForwardSync(cmd.line);
    });
    return unsub;
  }, [pageId, projectId, activeFilePage?.title, scale, numPages, setPageNumber, pdfSurfaceRef, synctexMapRef]);

  // SyncTeX reverse search event listener (Floating widget backward arrow)
  useEffect(() => {
    return EditorEventBus.on('flux:synctex-backward', () => {
      const p = pageNumber || 1;
      const resolved = synctexMapRef.current
        ? LatexCompilerEngine.resolveReverse(0.25, p, synctexMapRef.current)
        : null;
      if (resolved?.line) {
        handleJumpToSource(resolved.sourcePath, resolved.line, p);
      } else {
        handleJumpToSource(null, 1, p, 200, 200);
      }
    });
  }, [pageNumber, handleJumpToSource, synctexMapRef]);

  return {
    handleJumpToSource,
    handleJumpToPage,
  };
}
