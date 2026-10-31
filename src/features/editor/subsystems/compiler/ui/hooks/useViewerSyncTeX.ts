'use client';

/**
 * use-viewer-synctex.ts
 *
 * Bidirectional SyncTeX Navigation Controller (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-viewer-synctex.ts`
 */

import { useCallback, useEffect } from 'react';
import { usePageStore, useSettingsStore, useWorkspaceStore, type EditorTab, editorCommandBus, getActiveEditorEngine, workspaceCoordinator } from '@/features/editor/core';
import { DEFAULT_MAIN_FILE } from '@/features/editor/domain/constants/editor.constants';
import { useViewerStore } from '@/features/editor/subsystems/compiler/coordinator/viewer.store';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  DEFAULT_PDF_PAGE_HEIGHT_PT,
  type PdfPageDimensions,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import type { PdfSurfaceHandle } from '@/features/editor/subsystems/compiler/ui/PdfSurface';

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
  pdfSurfaceRef: React.RefObject<PdfSurfaceHandle | null>;
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
  const activeFilePath = usePageStore((s) => {
    const af = s.activeFilePage;
    if (af && 'path' in af && typeof af.path === 'string' && af.path) {
      return af.path;
    }
    return af?.title || undefined;
  });
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

      // 3. Match root document from currentPage
      const currentPage = usePageStore.getState().currentPage;
      if (currentPage) {
        const configuredMainFile = useSettingsStore.getState().mainFile || DEFAULT_MAIN_FILE;
        const rootTitle = (currentPage.title || configuredMainFile).replace(/\\/g, '/').toLowerCase();
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
            title: currentPage.title || configuredMainFile,
            path: currentPage.title || configuredMainFile,
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

      // 5. Match open tabs in useWorkspaceStore
      const tabsByProject = useWorkspaceStore.getState().tabsByProject;
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

      // Remote fallback: if local map had no target or line < 1, query backend SyncTeX processor
      const rootId = projectId || pageId;
      if ((!targetPath || targetLine < 1) && rootId && pageNum && x !== undefined && y !== undefined) {
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
      const filename = overrideFilePath || activeFilePath || useSettingsStore.getState().mainFile || DEFAULT_MAIN_FILE;

      const effectiveScale =
        scale > 0
          ? scale
          : autoFit && containerWidth && containerWidth > 0
            ? containerWidth / widthPt
            : 1;

      let targetPage: number | null = null;
      let targetX: number | undefined;
      let targetY: number | undefined;
      let targetW: number | undefined;
      let targetH: number | undefined;

      // 1. Fast-path: 0ms Local In-Memory SyncTeX Map Lookup
      const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
      if (effectiveMap) {
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
        if (!targetPage) {
          targetPage = compilerCoordinator.resolveForward(
            targetLine,
            filename,
            numPages || 1,
            effectiveMap,
          );
        }
      }

      // 2. Fallback: Backend Remote SyncTeX Resolution when local map is absent or misses
      if (!targetPage) {
        const remoteRes = await compilerCoordinator.resolveForwardRemote(
          rootId,
          filename,
          targetLine,
        );
        if (remoteRes) {
          targetPage = remoteRes.page ?? null;
          targetX = remoteRes.x * effectiveScale;
          targetY = remoteRes.y * effectiveScale;
          targetW = remoteRes.w !== undefined ? remoteRes.w * effectiveScale : undefined;
          targetH = remoteRes.h !== undefined ? remoteRes.h * effectiveScale : undefined;
        }
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
  }, [pageId, projectId, activeFilePath, scale, autoFit, containerWidth, widthPt, numPages, setPageNumber, pdfSurfaceRef, synctexMapRef]);

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
