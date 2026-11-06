'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  fetchReaderItemState,
  updateReaderItemState,
  markReaderItemAsRead,
  type ItemStateData,
} from '@/features/library/sdk/queries/reader.queries';
import { itemKeys, normalizeScopeId } from '@/features/library/sdk/query-keys';
import { patchItemAcrossScopeCaches } from '@/features/library/sdk/queries/cache-patcher.queries';
import { useReaderStore, type ReaderTab } from '@/features/library/core/store/reader.store';
import {
  MIN_READER_ZOOM,
  MAX_READER_ZOOM,
  normalizeReaderFitMode,
  normalizeReaderTheme,
  normalizeReaderZoom,
} from '@/features/library/core/adapters/project-context.adapter';
import type {
  ReaderDocument,
  ReaderNavigationTarget,
} from '@/features/library/types/reader.types';

interface ScrollPositionWithBookmarks extends Record<string, unknown> { bookmarks?: number[]; }

function normalizeBookmarkPages(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<number>();
  for (const entry of raw) {
    if (typeof entry === 'number' && Number.isFinite(entry) && entry >= 1) unique.add(Math.max(1, Math.floor(entry)));
  }
  return Array.from(unique).sort((a, b) => a - b);
}

function parseScrollPositionObject(scrollPosition: unknown): ScrollPositionWithBookmarks {
  if (scrollPosition && typeof scrollPosition === 'object' && !Array.isArray(scrollPosition)) {
    const record = scrollPosition as Record<string, unknown>;
    return 'bookmarks' in record ? { ...record, bookmarks: normalizeBookmarkPages(record.bookmarks) } : { ...record };
  }
  return {};
}

function hasExplicitBookmarksInScrollPosition(scrollPosition: unknown): boolean {
  return Boolean(scrollPosition && typeof scrollPosition === 'object' && !Array.isArray(scrollPosition) && Array.isArray((scrollPosition as { bookmarks?: unknown }).bookmarks));
}

function extractBookmarksFromScrollPosition(scrollPosition: unknown): number[] | undefined {
  if (hasExplicitBookmarksInScrollPosition(scrollPosition)) {
    const raw = (scrollPosition as { bookmarks?: unknown }).bookmarks;
    return normalizeBookmarkPages(raw);
  }
  return undefined;
}

function buildScrollPositionWithBookmarks(
  baseScrollPosition: unknown,
  latestScrollPosition: Record<string, unknown>,
  bookmarks: readonly number[],
): ScrollPositionWithBookmarks {
  return {
    ...parseScrollPositionObject(baseScrollPosition),
    ...latestScrollPosition,
    bookmarks: normalizeBookmarkPages(bookmarks),
  };
}

function syncPaperStateQueryCache(
  queryClient: QueryClient,
  effectiveScope: string,
  paperId: string,
  patch: Partial<ItemStateData>,
): void {
  const stateKey = itemKeys.state(effectiveScope, paperId);
  queryClient.setQueryData<ItemStateData>(stateKey, (prev) => ({
    ...(prev ?? ({ itemId: paperId } as unknown as ItemStateData)),
    ...patch,
  }));
}

interface UseReadingProgressOptions {
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
  const latestScrollPositionRef = useRef<ScrollPositionWithBookmarks>({});

  useEffect(() => {
    if (!paper?.id || restoredPaperIdRef.current === paper.id) return;
    const paperId = paper.id;
    restoredPaperIdRef.current = paperId;
    isInitialStateLoadedRef.current = false;
    let isCancelled = false;

    const applyHydratedState = (
      currentPage?: number | null,
      scrollPosition?: unknown,
    ) => {
      if (isCancelled) return;
      const parsedScroll = parseScrollPositionObject(scrollPosition);
      latestScrollPositionRef.current = parsedScroll;

      const hasExplicitBookmarks = hasExplicitBookmarksInScrollPosition(scrollPosition);
      const extractedBookmarks = extractBookmarksFromScrollPosition(scrollPosition);
      if (hasExplicitBookmarks) {
        useReaderStore.getState().setBookmarks(paperId, extractedBookmarks ?? []);
        hydratedBookmarksRef.current = JSON.stringify(extractedBookmarks ?? []);
      } else {
        hydratedBookmarksRef.current = null;
      }

      syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
        ...(typeof currentPage === 'number' ? { currentPage } : {}),
        ...(scrollPosition !== undefined ? { scrollPosition: parsedScroll } : {}),
      });

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

    const stateKey = itemKeys.state(effectiveScope, paperId);
    const cachedState = queryClient.getQueryData<ItemStateData | null>(stateKey);
    if (cachedState && (cachedState.currentPage !== undefined || cachedState.scrollPosition !== undefined)) {
      applyHydratedState(cachedState.currentPage, cachedState.scrollPosition);
      return () => {
        isCancelled = true;
      };
    }

    queryClient
      .fetchQuery({
        queryKey: stateKey,
        queryFn: () => fetchReaderItemState(effectiveScope, paperId),
        staleTime: 30_000,
      })
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
  }, [paper, effectiveScope, queryClient, setTargetPage, setVisiblePage, hasExplicitDeepLink]);

  const paperBookmarks = useReaderStore((s) => (paper?.id ? s.bookmarks[paper.id] : undefined));
  useEffect(() => {
    if (!paper?.id || !isInitialStateLoadedRef.current) return;
    const currentBookmarks = normalizeBookmarkPages(paperBookmarks);
    const serialized = JSON.stringify(currentBookmarks);
    if (hydratedBookmarksRef.current === serialized) return;

    const paperId = paper.id;
    const embeddedScrollPos = paper.readingState?.scrollPosition;

    const timeout = setTimeout(() => {
      const previousSerialized = hydratedBookmarksRef.current;
      const previousScrollPos = { ...latestScrollPositionRef.current };
      hydratedBookmarksRef.current = serialized;

      const nextScrollPos = buildScrollPositionWithBookmarks(
        embeddedScrollPos,
        latestScrollPositionRef.current,
        currentBookmarks,
      );
      latestScrollPositionRef.current = nextScrollPos;

      syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
        scrollPosition: nextScrollPos,
      });

      updateReaderItemState(effectiveScope, paperId, {
        scrollPosition: nextScrollPos,
      })
        .then((updatedState) => {
          syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
            ...(updatedState ?? {}),
            scrollPosition: updatedState?.scrollPosition ?? nextScrollPos,
          });
        })
        .catch(() => {
          hydratedBookmarksRef.current = previousSerialized;
          latestScrollPositionRef.current = previousScrollPos;
          syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
            scrollPosition: previousScrollPos,
          });
        });
    }, 400);

    return () => clearTimeout(timeout);
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
      const targetPage = pending ? pending.page : visiblePage;
      const previousSavedPage = lastSavedPageRef.current;
      pendingPageUpdateRef.current = null;
      lastSavedPageRef.current = targetPage;

      const currentScrollPos = latestScrollPositionRef.current;
      syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
        currentPage: targetPage,
        ...(Object.keys(currentScrollPos).length > 0 ? { scrollPosition: currentScrollPos } : {}),
      });
      patchItemAcrossScopeCaches(
        queryClient,
        effectiveScope,
        paperId,
        { currentPage: targetPage },
        { forceSkipMembershipInvalidation: true },
      );

      updateReaderItemState(effectiveScope, paperId, {
        currentPage: targetPage,
      })
        .then((updatedState) => {
          const mergedScrollPos =
            updatedState?.scrollPosition !== undefined
              ? { ...parseScrollPositionObject(updatedState.scrollPosition), ...latestScrollPositionRef.current }
              : latestScrollPositionRef.current;
          syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
            ...(updatedState ?? {}),
            currentPage: updatedState?.currentPage ?? targetPage,
            ...(Object.keys(mergedScrollPos).length > 0 ? { scrollPosition: mergedScrollPos } : {}),
          });
        })
        .catch(() => {
          if (lastSavedPageRef.current === targetPage) {
            lastSavedPageRef.current = previousSavedPage;
          }
          if (previousSavedPage !== null) {
            syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
              currentPage: previousSavedPage,
            });
          }
        });
    }, 800);

    return () => clearTimeout(timeout);
  }, [visiblePage, paper?.id, effectiveScope, queryClient]);

  useEffect(() => {
    return () => {
      const pending = pendingPageUpdateRef.current;
      if (pending && pending.page !== lastSavedPageRef.current) {
        pendingPageUpdateRef.current = null;
        syncPaperStateQueryCache(queryClient, pending.scope, pending.paperId, {
          currentPage: pending.page,
        });
        void updateReaderItemState(pending.scope, pending.paperId, {
          currentPage: pending.page,
        })
          .then((updatedState) => {
            syncPaperStateQueryCache(queryClient, pending.scope, pending.paperId, {
              ...(updatedState ?? {}),
              currentPage: updatedState?.currentPage ?? pending.page,
            });
          })
          .catch(() => undefined);
      }
    };
  }, [queryClient]);

  const markedPaperIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (paper?.id && markedPaperIdRef.current !== paper.id) {
      const paperId = paper.id;
      markedPaperIdRef.current = paperId;
      markReaderItemAsRead(effectiveScope, paperId)
        .then((updatedState) => {
          const nextReadStatus = updatedState?.readStatus || 'reading';
          const lastReadAt = updatedState?.lastReadAt || new Date().toISOString();
          syncPaperStateQueryCache(queryClient, effectiveScope, paperId, {
            ...(updatedState ?? {}),
            readStatus: nextReadStatus,
            lastReadAt,
          });
          patchItemAcrossScopeCaches(queryClient, effectiveScope, paperId, {
            isRead: nextReadStatus === 'completed',
            readStatus: nextReadStatus,
            lastReadAt,
          });
        })
        .catch(() => {
          if (markedPaperIdRef.current === paperId) {
            markedPaperIdRef.current = null;
          }
        });
    }
  }, [effectiveScope, paper?.id, queryClient]);
}

interface UseReaderTabHistoryOptions {
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

interface UseReaderTabPresentationOptions {
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

type ViewerFitMode = 'fit-width' | 'fit-page' | 'auto' | 'custom';
type ViewerThemeMode = 'normal' | 'sepia' | 'dark' | 'invert';

export function useReaderTabPresentation({
  effectiveTabId,
  activeTab,
  zoom,
  visiblePage,
  setZoom,
  updateTabState,
}: UseReaderTabPresentationOptions) {
  const [fallbackFitMode, setFitModeState] = useState<ViewerFitMode>(
    () => normalizeReaderFitMode(activeTab?.fitMode),
  );
  const [fallbackRotation, setRotationState] = useState<number>(
    () => activeTab?.rotation ?? 0,
  );
  const [fallbackThemeMode, setThemeModeState] = useState<ViewerThemeMode>(
    () => normalizeReaderTheme(activeTab?.theme),
  );

  const fitMode: ViewerFitMode = activeTab
    ? normalizeReaderFitMode(activeTab.fitMode)
    : fallbackFitMode;

  const rotation: number = activeTab ? (activeTab.rotation ?? 0) : fallbackRotation;

  const themeMode: ViewerThemeMode = activeTab
    ? normalizeReaderTheme(activeTab.theme)
    : fallbackThemeMode;

  useEffect(() => {
    if (!activeTab) return;
    if (typeof activeTab.zoom === 'number') {
      setZoom(activeTab.zoom);
    }
  }, [effectiveTabId, activeTab?.id, setZoom]);

  useEffect(() => {
    if (!effectiveTabId || effectiveTabId === 'library' || visiblePage < 1) return;
    const timeout = setTimeout(() => {
      updateTabState(effectiveTabId, { currentPage: visiblePage });
    }, 400);
    return () => clearTimeout(timeout);
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
      const resolved = normalizeReaderZoom(rawResolved);
      const mappedFitMode = normalizeReaderFitMode(nextFitMode);
      setZoom(resolved);
      setFitModeState(mappedFitMode);
      if (effectiveTabId && effectiveTabId !== 'library') {
        updateTabState(effectiveTabId, { zoom: resolved, fitMode: mappedFitMode });
      }
    },
    [effectiveTabId, activeTab?.zoom, zoom, setZoom, updateTabState],
  );

  const setFitMode = useCallback(
    (next: ViewerFitMode) => {
      const mappedFitMode = normalizeReaderFitMode(next);
      setFitModeState(mappedFitMode);
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

interface UseReaderKeyboardShortcutsOptions {
  activeTool: string;
  setActiveTool: (tool: 'select' | 'highlight' | 'underline' | 'note' | 'text' | 'area' | 'ink' | 'eraser') => void;
  setInteractionMode: (mode: 'select' | 'hand') => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onNavigatePage: (pageNumber: number) => void;
  visiblePage: number;
  totalPages: number;
  setTabZoom: (updater: number | ((prev: number) => number), fitMode?: ViewerFitMode) => void;
  setFitMode: (mode: ViewerFitMode) => void;
  setRotation: (updater: number | ((prev: number) => number)) => void;
}

export function useReaderKeyboardShortcuts({
  activeTool,
  setActiveTool,
  setInteractionMode,
  onNavigateBack,
  onNavigateForward,
  onNavigatePage,
  visiblePage,
  totalPages,
  setTabZoom,
  setFitMode,
  setRotation,
}: UseReaderKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditable) return;

      // Alt+1..7: Zotero annotation tool shortcuts, Alt+Left/Right: Back/Forward
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onNavigateBack();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNavigateForward();
          return;
        }
        const toolMap: Record<string, 'highlight' | 'underline' | 'note' | 'text' | 'area' | 'ink' | 'eraser'> = {
          '1': 'highlight',
          '2': 'underline',
          '3': 'note',
          '4': 'text',
          '5': 'area',
          '6': 'ink',
          '7': 'eraser',
        };
        const mapped = toolMap[e.key];
        if (mapped) {
          e.preventDefault();
          setInteractionMode('select');
          setActiveTool(activeTool === mapped ? 'select' : mapped);
          return;
        }
      }

      // Ctrl/Cmd + = / - / 0: Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setTabZoom((z) => Math.min(MAX_READER_ZOOM, Number((z + 0.1).toFixed(2))), 'custom');
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          setTabZoom((z) => Math.max(MIN_READER_ZOOM, Number((z - 0.1).toFixed(2))), 'custom');
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          setTabZoom(1.0, 'fit-width');
          setFitMode('fit-width');
          return;
        }
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Single-key shortcuts: S (Select), H (Hand), R / Shift+R (Rotate), PageUp / PageDown
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setInteractionMode('select');
        setActiveTool('select');
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setInteractionMode('hand');
        setActiveTool('select');
        return;
      }
      if (e.key === 'r') {
        e.preventDefault();
        setRotation((r) => (r + 90) % 360);
        return;
      }
      if (e.key === 'R' && e.shiftKey) {
        e.preventDefault();
        setRotation((r) => (r + 270) % 360);
        return;
      }
      if (e.key === 'PageUp') {
        if (visiblePage > 1) {
          e.preventDefault();
          onNavigatePage(visiblePage - 1);
        }
        return;
      }
      if (e.key === 'PageDown') {
        if (totalPages > 0 && visiblePage < totalPages) {
          e.preventDefault();
          onNavigatePage(visiblePage + 1);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    setActiveTool,
    setInteractionMode,
    onNavigateBack,
    onNavigateForward,
    onNavigatePage,
    visiblePage,
    totalPages,
    setTabZoom,
    setFitMode,
    setRotation,
  ]);
}
