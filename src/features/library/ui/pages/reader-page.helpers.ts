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
  setZoom: (updater: number | ((prev: number) => number)) => void;
  updateTabState: (
    tabId: string,
    updates: Partial<Pick<ReaderTab, "zoom" | "rotation" | "fitMode" | "theme">>,
  ) => void;
}

export function useReaderTabPresentation({
  effectiveTabId,
  activeTab,
  setZoom,
  updateTabState,
}: UseReaderTabPresentationOptions) {
  const [fallbackFitMode, setFitModeState] = useState<"fit-width" | "fit-page" | "auto">(
    () =>
      activeTab?.fitMode === "page-fit"
        ? "fit-page"
        : activeTab?.fitMode === "auto"
          ? "auto"
          : "fit-width",
  );
  const [fallbackRotation, setRotationState] = useState<number>(() => activeTab?.rotation ?? 0);
  const [fallbackThemeMode, setThemeModeState] = useState<"normal" | "sepia" | "dark">(
    () =>
      activeTab?.theme === "sepia"
        ? "sepia"
        : activeTab?.theme === "dark"
          ? "dark"
          : "normal",
  );

  const fitMode: "fit-width" | "fit-page" | "auto" = activeTab
    ? activeTab.fitMode === "page-fit"
      ? "fit-page"
      : activeTab.fitMode === "auto"
        ? "auto"
        : "fit-width"
    : fallbackFitMode;

  const rotation: number = activeTab ? (activeTab.rotation ?? 0) : fallbackRotation;

  const themeMode: "normal" | "sepia" | "dark" = activeTab
    ? activeTab.theme === "sepia"
      ? "sepia"
      : activeTab.theme === "dark"
        ? "dark"
        : "normal"
    : fallbackThemeMode;

  useEffect(() => {
    if (!activeTab) return;
    if (typeof activeTab.zoom === "number") {
      setZoom(activeTab.zoom);
    }
  }, [effectiveTabId, activeTab?.id, setZoom]);

  const setTabZoom = useCallback(
    (nextOrUpdater: number | ((prev: number) => number)) => {
      setZoom((prev) => {
        const resolved =
          typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
        if (effectiveTabId && effectiveTabId !== "library") {
          updateTabState(effectiveTabId, { zoom: resolved });
        }
        return resolved;
      });
    },
    [effectiveTabId, setZoom, updateTabState],
  );

  const setFitMode = useCallback(
    (next: "fit-width" | "fit-page" | "auto") => {
      setFitModeState(next);
      if (effectiveTabId && effectiveTabId !== "library") {
        updateTabState(effectiveTabId, {
          fitMode:
            next === "fit-page"
              ? "page-fit"
              : next === "auto"
                ? "auto"
                : "page-width",
        });
      }
    },
    [effectiveTabId, updateTabState],
  );

  const setRotation = useCallback(
    (nextOrUpdater: number | ((prev: number) => number)) => {
      setRotationState((prev) => {
        const resolved =
          typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
        if (effectiveTabId && effectiveTabId !== "library") {
          updateTabState(effectiveTabId, { rotation: resolved });
        }
        return resolved;
      });
    },
    [effectiveTabId, updateTabState],
  );

  const setThemeMode = useCallback(
    (
      nextOrUpdater:
        | ("normal" | "sepia" | "dark" | "invert")
        | ((prev: "normal" | "sepia" | "dark") => "normal" | "sepia" | "dark" | "invert"),
    ) => {
      setThemeModeState((prev) => {
        const raw =
          typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
        const resolved: "normal" | "sepia" | "dark" =
          raw === "invert" ? "dark" : raw;
        if (effectiveTabId && effectiveTabId !== "library") {
          updateTabState(effectiveTabId, {
            theme:
              resolved === "sepia"
                ? "sepia"
                : resolved === "dark"
                  ? "dark"
                  : "light",
          });
        }
        return resolved;
      });
    },
    [effectiveTabId, updateTabState],
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

