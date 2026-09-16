/**
 * settings.store.ts
 *
 * Store for editor user preferences, compiler settings, layout sizing, and typography.
 * Persisted in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompilerEngine, CompileMode } from '../types/compiler.types';

export type LaTeXEngine = CompilerEngine;
export type { CompileMode };
export type LayoutMode = 'split' | 'editor-only' | 'viewer-only';
export type EditorTheme = 'light' | 'dark';
export type KeybindingMode = 'standard' | 'vim';

export interface DocumentSettingsState {
  engine: CompilerEngine;
  compileMode: CompileMode;
  autoCompile: boolean;
  layout: LayoutMode;
  editorTheme: EditorTheme;
  keybinding: KeybindingMode;
  sidebarWidth: number;
  editorFlex: number;
  useCache: boolean;
  settingsPanelOpen: boolean;
  mainFile: string;
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  editorMode: 'code' | 'visual';
  reviewMode: boolean;

  setEngine: (engine: CompilerEngine) => void;
  setCompileMode: (compileMode: CompileMode) => void;
  setAutoCompile: (autoCompile: boolean) => void;
  setLayout: (layout: LayoutMode) => void;
  setEditorTheme: (editorTheme: EditorTheme) => void;
  setKeybinding: (keybinding: KeybindingMode) => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  setEditorFlex: (editorFlex: number) => void;
  setUseCache: (useCache: boolean) => void;
  setSettingsPanelOpen: (open: boolean) => void;
  toggleSettingsPanel: () => void;
  setMainFile: (mainFile: string) => void;
  setFontSize: (fontSize: number) => void;
  setWordWrap: (wordWrap: boolean) => void;
  setLineNumbers: (lineNumbers: boolean) => void;
  setEditorMode: (mode: 'code' | 'visual') => void;
  toggleEditorMode: () => void;
  setReviewMode: (reviewMode: boolean) => void;
  toggleReviewMode: () => void;
}

export const useDocumentSettingsStore = create<DocumentSettingsState>()(
  persist(
    (set) => ({
      engine: 'pdflatex',
      compileMode: 'full',
      autoCompile: true,
      layout: 'split',
      editorTheme: 'light',
      keybinding: 'standard',
      sidebarWidth: 320,
      editorFlex: 0.5,
      useCache: true,
      settingsPanelOpen: false,
      mainFile: 'main.tex',
      fontSize: 15,
      wordWrap: true,
      lineNumbers: true,
      editorMode: 'code',
      reviewMode: false,

      setEngine: (engine) => set({ engine }),
      setCompileMode: (compileMode) => set({ compileMode }),
      setAutoCompile: (autoCompile) => set({ autoCompile }),
      setLayout: (layout) => set({ layout }),
      setEditorTheme: (editorTheme) => set({ editorTheme }),
      setKeybinding: (keybinding) => set({ keybinding }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setEditorFlex: (editorFlex) => set({ editorFlex }),
      setUseCache: (useCache) => set({ useCache }),
      setSettingsPanelOpen: (settingsPanelOpen) => set({ settingsPanelOpen }),
      toggleSettingsPanel: () =>
        set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
      setMainFile: (mainFile) => set({ mainFile }),
      setFontSize: (fontSize) => set({ fontSize }),
      setWordWrap: (wordWrap) => set({ wordWrap }),
      setLineNumbers: (lineNumbers) => set({ lineNumbers }),
      setEditorMode: (editorMode) => set({ editorMode }),
      toggleEditorMode: () =>
        set((s) => ({ editorMode: s.editorMode === 'code' ? 'visual' : 'code' })),
      setReviewMode: (reviewMode) => set({ reviewMode }),
      toggleReviewMode: () => set((s) => ({ reviewMode: !s.reviewMode })),
    }),
    {
      name: 'flux-editor-settings',
      partialize: (state) => {
        // Don't persist transient UI state or auto-compile (always on by default)
        const { settingsPanelOpen, autoCompile, ...rest } = state;
        return rest;
      },
    },
  ),
);

// Aliases for seamless backward compatibility
export const useSettingsStore = useDocumentSettingsStore;
export const useEditorSettingsStore = useDocumentSettingsStore;
export type SettingsState = DocumentSettingsState;
