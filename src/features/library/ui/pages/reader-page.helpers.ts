"use client";

import { useState, useCallback, useEffect } from "react";
import type { ReaderTab } from "@/features/library/core/store/reader.store";

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

  const tabKey = effectiveTabId || "default";
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
      Pick<ReaderTab, "currentPage" | "zoom" | "rotation" | "fitMode" | "theme">
    >,
  ) => void;
}

export function useReaderTabPresentation({
  effectiveTabId,
  activeTab,
  zoom,
  visiblePage,
  setZoom,
  updateTabState,
}: UseReaderTabPresentationOptions) {
  const [fallbackFitMode, setFitModeState] = useState<
    "fit-width" | "fit-page" | "auto" | "custom"
  >(() =>
    activeTab?.fitMode === "fit-page"
      ? "fit-page"
      : activeTab?.fitMode === "auto"
        ? "auto"
        : activeTab?.fitMode === "custom"
          ? "custom"
          : "fit-width",
  );
  const [fallbackRotation, setRotationState] = useState<number>(
    () => activeTab?.rotation ?? 0,
  );
  const [fallbackThemeMode, setThemeModeState] = useState<
    "normal" | "sepia" | "dark" | "invert"
  >(() =>
    activeTab?.theme === "sepia"
      ? "sepia"
      : activeTab?.theme === "dark"
        ? "dark"
        : activeTab?.theme === "invert"
          ? "invert"
          : "normal",
  );

  const fitMode: "fit-width" | "fit-page" | "auto" | "custom" = activeTab
    ? activeTab.fitMode === "fit-page"
      ? "fit-page"
      : activeTab.fitMode === "auto"
        ? "auto"
        : activeTab.fitMode === "custom"
          ? "custom"
          : "fit-width"
    : fallbackFitMode;

  const rotation: number = activeTab ? (activeTab.rotation ?? 0) : fallbackRotation;

  const themeMode: "normal" | "sepia" | "dark" | "invert" = activeTab
    ? activeTab.theme === "sepia"
      ? "sepia"
      : activeTab.theme === "dark"
        ? "dark"
        : activeTab.theme === "invert"
          ? "invert"
          : "normal"
    : fallbackThemeMode;

  useEffect(() => {
    if (!activeTab) return;
    if (typeof activeTab.zoom === "number") {
      setZoom(activeTab.zoom);
    }
  }, [effectiveTabId, activeTab?.id, setZoom]);

  useEffect(() => {
    if (!effectiveTabId || effectiveTabId === "library" || visiblePage < 1) return;
    updateTabState(effectiveTabId, { currentPage: visiblePage });
  }, [effectiveTabId, visiblePage, updateTabState]);

  const setTabZoom = useCallback(
    (
      nextOrUpdater: number | ((prev: number) => number),
      nextFitMode: "fit-width" | "fit-page" | "auto" | "custom" = "custom",
    ) => {
      const currentZoom = activeTab?.zoom ?? zoom;
      const rawResolved =
        typeof nextOrUpdater === "function"
          ? nextOrUpdater(currentZoom)
          : nextOrUpdater;
      const resolved = Math.min(3.0, Math.max(0.25, Number(rawResolved.toFixed(4))));
      setZoom(resolved);
      setFitModeState(nextFitMode);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, { zoom: resolved, fitMode: nextFitMode });
      }
    },
    [effectiveTabId, activeTab?.zoom, zoom, setZoom, updateTabState],
  );

  const setFitMode = useCallback(
    (next: "fit-width" | "fit-page" | "auto" | "custom") => {
      setFitModeState(next);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, {
          fitMode: next,
        });
      }
    },
    [effectiveTabId, updateTabState],
  );

  const setRotation = useCallback(
    (nextOrUpdater: number | ((prev: number) => number)) => {
      const resolved =
        typeof nextOrUpdater === "function"
          ? nextOrUpdater(rotation)
          : nextOrUpdater;
      setRotationState(resolved);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, { rotation: resolved });
      }
    },
    [effectiveTabId, rotation, updateTabState],
  );

  const setThemeMode = useCallback(
    (
      nextOrUpdater:
        | ("normal" | "sepia" | "dark" | "invert")
        | ((
            prev: "normal" | "sepia" | "dark" | "invert",
          ) => "normal" | "sepia" | "dark" | "invert"),
    ) => {
      const resolved =
        typeof nextOrUpdater === "function"
          ? nextOrUpdater(themeMode)
          : nextOrUpdater;
      setThemeModeState(resolved);
      if (effectiveTabId && effectiveTabId !== "library") {
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
} from "@/features/library/domain/reader.domain";

