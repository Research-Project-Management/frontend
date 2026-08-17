'use client';

/**
 * use-settings.ts (editor feature)
 *
 * Hook providing high-level helpers, state access, and operations
 * for editor configuration and user preferences.
 */

import { useCallback } from "react";
import {
  useSettingsStore,
  type CompileMode,
  type LaTeXEngine,
  type LayoutMode,
  type EditorTheme,
} from "../store/settings.store";
import { useFileActions } from "./use-page";

export interface UseSettingsOptions {
  pageId?: string;
}

export function useSettings(options?: UseSettingsOptions) {
  const settings = useSettingsStore();
  const { setMainFile: setMainFileMutation } = useFileActions();

  // Font size actions
  const increaseFontSize = useCallback(() => {
    settings.setFontSize(Math.min(32, settings.fontSize + 1));
  }, [settings]);

  const decreaseFontSize = useCallback(() => {
    settings.setFontSize(Math.max(10, settings.fontSize - 1));
  }, [settings]);

  const resetFontSize = useCallback(() => {
    settings.setFontSize(15);
  }, [settings]);

  // Theme actions
  const toggleTheme = useCallback(() => {
    settings.setEditorTheme(settings.editorTheme === "light" ? "dark" : "light");
  }, [settings]);

  // Compile mode actions
  const toggleCompileMode = useCallback(() => {
    settings.setCompileMode(settings.compileMode === "full" ? "draft" : "full");
  }, [settings]);

  // Toggle helpers
  const toggleAutoCompile = useCallback(() => {
    settings.setAutoCompile(!settings.autoCompile);
  }, [settings]);

  const toggleWordWrap = useCallback(() => {
    settings.setWordWrap(!settings.wordWrap);
  }, [settings]);

  const toggleLineNumbers = useCallback(() => {
    settings.setLineNumbers(!settings.lineNumbers);
  }, [settings]);

  const toggleCache = useCallback(() => {
    settings.setUseCache(!settings.useCache);
  }, [settings]);

  // Panel helpers
  const openSettingsPanel = useCallback(() => {
    settings.setSettingsPanelOpen(true);
  }, [settings]);

  const closeSettingsPanel = useCallback(() => {
    settings.setSettingsPanelOpen(false);
  }, [settings]);

  // Main file change with backend sync
  const updateMainFile = useCallback(
    async (fileId: string, filename: string) => {
      settings.setMainFile(filename);
      if (options?.pageId) {
        await setMainFileMutation.mutateAsync({
          pageId: options.pageId,
          fileId,
        });
      }
    },
    [settings, options?.pageId, setMainFileMutation]
  );

  return {
    ...settings,
    // Computed layout flags
    isSplit: settings.layout === "split",
    isEditorOnly: settings.layout === "editor-only",
    isViewerOnly: settings.layout === "viewer-only",
    // Actions
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    toggleTheme,
    toggleCompileMode,
    toggleAutoCompile,
    toggleWordWrap,
    toggleLineNumbers,
    toggleCache,
    openSettingsPanel,
    closeSettingsPanel,
    updateMainFile,
    isUpdatingMainFile: setMainFileMutation.isPending,
  };
}

/** @deprecated alias for backward compatibility */
export const useEditorSettings = useSettings;
