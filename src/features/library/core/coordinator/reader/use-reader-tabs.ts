'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { StateService, itemKeys, normalizeScopeId } from '@/features/library/sdk';
import { patchItemAcrossScopeCaches } from '@/features/library/sdk/queries/cache-patcher';
import { useReaderStore, type ReaderTab } from '@/features/library/core/store/reader.store';
import type {
  ReaderDocument,
  ReaderNavigationTarget,
} from '@/features/library/domain/types/reader.schema';

export interface UseReadingProgressOptions {
  scopeId: string;
  paper: ReaderDocument | null;
  effectivePaperId: string;
  visiblePage: number;
  setVisiblePage: (page: number) => void;
  setTargetPage: (target: ReaderNavigationTarget | null) => void;
}

/**
 * Manages PDF Reader progress lifecycle:
 * 1. Restores last saved reading page on initial paper load.
 * 2. Debounces page updates back to the server as the user scrolls.
 * 3. Marks the document as read on first open.
 */
export function useReadingProgress({
  scopeId,
  paper,
  visiblePage,
  setVisiblePage,
  setTargetPage,
}: UseReadingProgressOptions): void {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);
  const hasExplicitDeepLink = Boolean(
    searchParams?.get('page') || searchParams?.get('annotation'),
  );

  const restoredPaperIdRef = useRef<string | null>(null);
  const isInitialStateLoadedRef = useRef<boolean>(false);
  const lastSavedPageRef = useRef<number | null>(null);
  const pendingPageUpdateRef = useRef<{ scope: string; paperId: string; page: number } | null>(null);
  const hydratedBookmarksRef = useRef<string | null>(null);

  useEffect(() => {
    if (!paper?.id || restoredPaperIdRef.current === paper.id) return;
    restoredPaperIdRef.current = paper.id;
    isInitialStateLoadedRef.current = false;
    let isCancelled = false;

    const applyHydratedState = (
      currentPage?: number | null,
      scrollPosition?: unknown,
    ) => {
      if (isCancelled) return;
      if (scrollPosition && typeof scrollPosition === 'object' && 'bookmarks' in scrollPosition) {
        const rawBookmarks = (scrollPosition as { bookmarks?: unknown }).bookmarks;
        if (Array.isArray(rawBookmarks)) {
          useReaderStore.getState().setBookmarks(paper.id, rawBookmarks as number[]);
        }
      }
      hydratedBookmarksRef.current = JSON.stringify(useReaderStore.getState().getBookmarks(paper.id));

      if (!hasExplicitDeepLink && currentPage && currentPage > 1) {
        lastSavedPageRef.current = currentPage;
        setTargetPage({ pageNumber: currentPage, timestamp: Date.now() });
        setVisiblePage(currentPage);
      } else {
        lastSavedPageRef.current = currentPage ?? 1;
      }
      isInitialStateLoadedRef.current = true;
    };

    const embeddedState = paper.readingState;
    const embeddedCurrentPage =
      embeddedState?.currentPage ??
      (paper as { currentPage?: number }).currentPage;

    if (embeddedState !== undefined || embeddedCurrentPage !== undefined) {
      applyHydratedState(embeddedCurrentPage, embeddedState?.scrollPosition);
      return () => {
        isCancelled = true;
      };
    }

    StateService
      .getState(scopeId, paper.id)
      .then((stateData) => {
        applyHydratedState(stateData?.currentPage, stateData?.scrollPosition);
      })
      .catch(() => {
        if (!isCancelled) {
          isInitialStateLoadedRef.current = true;
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [paper, scopeId, setTargetPage, setVisiblePage, hasExplicitDeepLink]);

  const paperBookmarks = useReaderStore((s) => (paper?.id ? s.bookmarks[paper.id] : undefined));
  useEffect(() => {
    if (!paper?.id || !isInitialStateLoadedRef.current) return;
    const currentBookmarks = paperBookmarks ?? [];
    const serialized = JSON.stringify(currentBookmarks);
    if (hydratedBookmarksRef.current === serialized) return;
    hydratedBookmarksRef.current = serialized;

    const existingScrollPos =
      paper.readingState?.scrollPosition &&
      typeof paper.readingState.scrollPosition === 'object' &&
      !Array.isArray(paper.readingState.scrollPosition)
        ? (paper.readingState.scrollPosition as Record<string, unknown>)
        : {};

    StateService
      .updateState(effectiveScope, paper.id, {
        scrollPosition: {
          ...existingScrollPos,
          bookmarks: currentBookmarks,
        },
      })
      .then(() => {
        void queryClient.invalidateQueries({
          queryKey: itemKeys.state(effectiveScope, paper.id),
        });
      })
      .catch(() => undefined);
  }, [paperBookmarks, paper?.id, paper?.readingState?.scrollPosition, effectiveScope, queryClient]);

  useEffect(() => {
    if (!paper?.id || visiblePage < 1 || !isInitialStateLoadedRef.current) return;
    if (lastSavedPageRef.current === visiblePage) {
      pendingPageUpdateRef.current = null;
      return;
    }

    const paperId = paper.id;
    pendingPageUpdateRef.current = {
      scope: effectiveScope,
      paperId,
      page: visiblePage,
    };

    const timeout = setTimeout(() => {
      const pending = pendingPageUpdateRef.current;
      pendingPageUpdateRef.current = null;
      lastSavedPageRef.current = visiblePage;
      StateService
        .updateState(effectiveScope, paperId, {
          currentPage: pending ? pending.page : visiblePage,
        })
        .then(() => {
          void queryClient.invalidateQueries({
            queryKey: itemKeys.state(effectiveScope, paperId),
          });
        })
        .catch(() => undefined);
    }, 800);

    return () => clearTimeout(timeout);
  }, [visiblePage, paper?.id, effectiveScope, queryClient]);

  useEffect(() => {
    return () => {
      const pending = pendingPageUpdateRef.current;
      if (pending && pending.page !== lastSavedPageRef.current) {
        pendingPageUpdateRef.current = null;
        void StateService
          .updateState(pending.scope, pending.paperId, {
            currentPage: pending.page,
          })
          .catch(() => undefined);
      }
    };
  }, []);

  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (paper?.id && markedPaperIdRef.current !== paper.id) {
      const paperId = paper.id;
      markedPaperIdRef.current = paperId;
      StateService
        .markAsRead(effectiveScope, paperId)
        .then((updatedState) => {
          const nextReadStatus = updatedState?.readStatus || 'reading';
          patchItemAcrossScopeCaches(queryClient, effectiveScope, paperId, {
            isRead: nextReadStatus === 'completed',
            readStatus: nextReadStatus,
            lastReadAt: updatedState?.lastReadAt || new Date().toISOString(),
          });
          void queryClient.invalidateQueries({
            queryKey: itemKeys.state(effectiveScope, paperId),
          });
        })
        .catch(() => undefined);
    }
  }, [effectiveScope, paper?.id, queryClient]);
}

export interface UseReaderTabHistoryOptions {
  effectiveTabId: string | null | undefined;
  visiblePage: number;
  onNavigateToPage: (pageNumber: number) => void;
  onNavigateToAnnotation: (pageNumber: number, annotationId?: string) => void;
}

export function useReaderTabHistory({
  effectiveTabId,
  visiblePage,
  onNavigateToPage,
  onNavigateToAnnotation,
}: UseReaderTabHistoryOptions) {
  const [tabHistoryByTabId, setTabHistoryByTabId] = useState<
    Record<string, { pageHistory: number[]; forwardHistory: number[] }>
  >({});

  const tabKey = effectiveTabId || 'default';
  const pageHistory = tabHistoryByTabId[tabKey]?.pageHistory ?? [];
  const forwardHistory = tabHistoryByTabId[tabKey]?.forwardHistory ?? [];

  const handleNavigateToPageWithHistory = useCallback(
    (newPage: number, annotationId?: string) => {
      if (visiblePage && visiblePage !== newPage) {
        setTabHistoryByTabId((prev) => {
          const current = prev[tabKey] ?? { pageHistory: [], forwardHistory: [] };
          return {
            ...prev,
            [tabKey]: {
              pageHistory: [...current.pageHistory.slice(-30), visiblePage],
              forwardHistory: [],
            },
          };
        });
      }
      onNavigateToAnnotation(newPage, annotationId);
    },
    [visiblePage, onNavigateToAnnotation, tabKey],
  );

  const handleNavigateBack = useCallback(() => {
    if (pageHistory.length === 0) return;
    const prevPage = pageHistory[pageHistory.length - 1]!;
    setTabHistoryByTabId((prev) => {
      const current = prev[tabKey] ?? { pageHistory: [], forwardHistory: [] };
      return {
        ...prev,
        [tabKey]: {
          pageHistory: current.pageHistory.slice(0, current.pageHistory.length - 1),
          forwardHistory:
            visiblePage && visiblePage !== prevPage
              ? [...current.forwardHistory.slice(-30), visiblePage]
              : current.forwardHistory,
        },
      };
    });
    onNavigateToPage(prevPage);
  }, [pageHistory, visiblePage, onNavigateToPage, tabKey]);

  const handleNavigateForward = useCallback(() => {
    if (forwardHistory.length === 0) return;
    const nextPage = forwardHistory[forwardHistory.length - 1]!;
    setTabHistoryByTabId((prev) => {
      const current = prev[tabKey] ?? { pageHistory: [], forwardHistory: [] };
      return {
        ...prev,
        [tabKey]: {
          pageHistory:
            visiblePage && visiblePage !== nextPage
              ? [...current.pageHistory.slice(-30), visiblePage]
              : current.pageHistory,
          forwardHistory: current.forwardHistory.slice(0, current.forwardHistory.length - 1),
        },
      };
    });
    onNavigateToPage(nextPage);
  }, [forwardHistory, visiblePage, onNavigateToPage, tabKey]);

  return {
    pageHistory,
    forwardHistory,
    handleNavigateToPageWithHistory,
    handleNavigateBack,
    handleNavigateForward,
  };
}

export interface UseReaderTabPresentationOptions {
  effectiveTabId: string | null | undefined;
  activeTab: ReaderTab | undefined;
  zoom: number;
  visiblePage: number;
  setZoom: (updater: number | ((prev: number) => number)) => void;
  updateTabState: (
    tabId: string,
    updates: Partial<
      Pick<ReaderTab, 'currentPage' | 'zoom' | 'rotation' | 'fitMode' | 'theme'>
    >,
  ) => void;
}

export type ViewerFitMode = 'fit-width' | 'fit-page' | 'auto' | 'custom';
export type StoreFitMode = 'fit-width' | 'fit-page' | 'auto' | 'custom';
export type ViewerThemeMode = 'normal' | 'sepia' | 'dark' | 'invert';

export const STORE_TO_VIEWER_FIT_MODE: Readonly<Record<string, ViewerFitMode>> = {
  'fit-page': 'fit-page',
  'page-fit': 'fit-page',
  'fit-width': 'fit-width',
  'page-width': 'fit-width',
  auto: 'auto',
  custom: 'custom',
  manual: 'custom',
};

export const VIEWER_TO_STORE_FIT_MODE: Readonly<Record<string, StoreFitMode>> = {
  'fit-page': 'fit-page',
  'fit-width': 'fit-width',
  auto: 'auto',
  custom: 'custom',
  manual: 'custom',
};

export const STORE_TO_VIEWER_THEME_MODE: Readonly<Record<string, ViewerThemeMode>> = {
  normal: 'normal',
  light: 'normal',
  sepia: 'sepia',
  dark: 'dark',
  invert: 'invert',
};

export function useReaderTabPresentation({
  effectiveTabId,
  activeTab,
  zoom,
  visiblePage,
  setZoom,
  updateTabState,
}: UseReaderTabPresentationOptions) {
  const [fallbackFitMode, setFitModeState] = useState<ViewerFitMode>(
    () => STORE_TO_VIEWER_FIT_MODE[activeTab?.fitMode ?? ''] ?? 'fit-width',
  );
  const [fallbackRotation, setRotationState] = useState<number>(
    () => activeTab?.rotation ?? 0,
  );
  const [fallbackThemeMode, setThemeModeState] = useState<ViewerThemeMode>(
    () => STORE_TO_VIEWER_THEME_MODE[activeTab?.theme ?? ''] ?? 'normal',
  );

  const fitMode: ViewerFitMode = activeTab
    ? (STORE_TO_VIEWER_FIT_MODE[activeTab.fitMode ?? ''] ?? 'fit-width')
    : fallbackFitMode;

  const rotation: number = activeTab ? (activeTab.rotation ?? 0) : fallbackRotation;

  const themeMode: ViewerThemeMode = activeTab
    ? (STORE_TO_VIEWER_THEME_MODE[activeTab.theme ?? ''] ?? 'normal')
    : fallbackThemeMode;

  useEffect(() => {
    if (!activeTab) return;
    if (typeof activeTab.zoom === 'number') {
      setZoom(activeTab.zoom);
    }
  }, [effectiveTabId, activeTab?.id, setZoom]);

  useEffect(() => {
    if (!effectiveTabId || effectiveTabId === 'library' || visiblePage < 1) return;
    updateTabState(effectiveTabId, { currentPage: visiblePage });
  }, [effectiveTabId, visiblePage, updateTabState]);

  const setTabZoom = useCallback(
    (
      nextOrUpdater: number | ((prev: number) => number),
      nextFitMode: ViewerFitMode = 'custom',
    ) => {
      const currentZoom = activeTab?.zoom ?? zoom;
      const rawResolved =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(currentZoom)
          : nextOrUpdater;
      const resolved = Math.min(3.0, Math.max(0.25, Number(rawResolved.toFixed(4))));
      const mappedFitMode = VIEWER_TO_STORE_FIT_MODE[nextFitMode] ?? 'custom';
      setZoom(resolved);
      setFitModeState(nextFitMode);
      if (effectiveTabId && effectiveTabId !== 'library') {
        updateTabState(effectiveTabId, { zoom: resolved, fitMode: mappedFitMode });
      }
    },
    [effectiveTabId, activeTab?.zoom, zoom, setZoom, updateTabState],
  );

  const setFitMode = useCallback(
    (next: ViewerFitMode) => {
      const mappedFitMode = VIEWER_TO_STORE_FIT_MODE[next] ?? 'fit-width';
      setFitModeState(next);
      if (effectiveTabId && effectiveTabId !== 'library') {
        updateTabState(effectiveTabId, {
          fitMode: mappedFitMode,
        });
      }
    },
    [effectiveTabId, updateTabState],
  );

  const setRotation = useCallback(
    (nextOrUpdater: number | ((prev: number) => number)) => {
      const resolved =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(rotation)
          : nextOrUpdater;
      setRotationState(resolved);
      if (effectiveTabId && effectiveTabId !== 'library') {
        updateTabState(effectiveTabId, { rotation: resolved });
      }
    },
    [effectiveTabId, rotation, updateTabState],
  );

  const setThemeMode = useCallback(
    (
      nextOrUpdater:
        | ('normal' | 'sepia' | 'dark' | 'invert')
        | ((
            prev: 'normal' | 'sepia' | 'dark' | 'invert',
          ) => 'normal' | 'sepia' | 'dark' | 'invert'),
    ) => {
      const resolved =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(themeMode)
          : nextOrUpdater;
      setThemeModeState(resolved);
      if (effectiveTabId && effectiveTabId !== 'library') {
        updateTabState(effectiveTabId, {
          theme: resolved,
        });
      }
    },
    [effectiveTabId, themeMode, updateTabState],
  );

  return {
    fitMode,
    setFitMode,
    rotation,
    setRotation,
    themeMode,
    setThemeMode,
    setTabZoom,
  };
}

export {
  type OcrStatus,
  type DocumentOcrState,
  resolveDocumentOcrState,
} from '@/features/library/domain/reader.domain';
