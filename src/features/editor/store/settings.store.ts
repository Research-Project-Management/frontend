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
export type { CompilerEngine, CompileMode };
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
  isHistoryOpen: boolean;
  isShareModalOpen: boolean;
  isTemplateModalOpen: boolean;
  spellCheck: boolean;
  spellCheckLanguage: string;
  texLiveVersion: string;
  fontFamily: string;
  autoCloseBrackets: boolean;
  linterEnabled: boolean;
  showBreadcrumbs: boolean;
  showEditorTabs: boolean;
  showEquationPreview: boolean;

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
  setIsHistoryOpen: (open: boolean) => void;
  toggleHistory: () => void;
  setIsShareModalOpen: (open: boolean) => void;
  toggleShareModal: () => void;
  setIsTemplateModalOpen: (open: boolean) => void;
  toggleTemplateModal: () => void;
  setMainFile: (mainFile: string) => void;
  setFontSize: (fontSize: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setWordWrap: (wordWrap: boolean) => void;
  setLineNumbers: (lineNumbers: boolean) => void;
  setEditorMode: (mode: 'code' | 'visual') => void;
  toggleEditorMode: () => void;
  setReviewMode: (reviewMode: boolean) => void;
  toggleReviewMode: () => void;
  setSpellCheck: (spellCheck: boolean) => void;
  toggleSpellCheck: () => void;
  setSpellCheckLanguage: (lang: string) => void;
  setTexLiveVersion: (version: string) => void;
  setAutoCloseBrackets: (enabled: boolean) => void;
  toggleAutoCloseBrackets: () => void;
  setLinterEnabled: (linterEnabled: boolean) => void;
  toggleLinterEnabled: () => void;
  setShowBreadcrumbs: (show: boolean) => void;
  toggleShowBreadcrumbs: () => void;
  setShowEditorTabs: (show: boolean) => void;
  toggleShowEditorTabs: () => void;
  setShowEquationPreview: (show: boolean) => void;
  toggleShowEquationPreview: () => void;
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
      isHistoryOpen: false,
      isShareModalOpen: false,
      isTemplateModalOpen: false,
      spellCheck: true,
      spellCheckLanguage: 'en_US',
      texLiveVersion: '2024',
      fontFamily: 'default',
      autoCloseBrackets: true,
      linterEnabled: true,
      showBreadcrumbs: true,
      showEditorTabs: true,
      showEquationPreview: true,

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
      setIsHistoryOpen: (isHistoryOpen) => set({ isHistoryOpen }),
      toggleHistory: () => set((s) => ({ isHistoryOpen: !s.isHistoryOpen })),
      setIsShareModalOpen: (isShareModalOpen) => set({ isShareModalOpen }),
      toggleShareModal: () => set((s) => ({ isShareModalOpen: !s.isShareModalOpen })),
      setIsTemplateModalOpen: (isTemplateModalOpen) => set({ isTemplateModalOpen }),
      toggleTemplateModal: () => set((s) => ({ isTemplateModalOpen: !s.isTemplateModalOpen })),
      setMainFile: (mainFile) => set({ mainFile }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setWordWrap: (wordWrap) => set({ wordWrap }),
      setLineNumbers: (lineNumbers) => set({ lineNumbers }),
      setEditorMode: (editorMode) => set({ editorMode }),
      toggleEditorMode: () =>
        set((s) => ({ editorMode: s.editorMode === 'code' ? 'visual' : 'code' })),
      setReviewMode: (reviewMode) => set({ reviewMode }),
      toggleReviewMode: () => set((s) => ({ reviewMode: !s.reviewMode })),
      setSpellCheck: (spellCheck) => set({ spellCheck }),
      toggleSpellCheck: () => set((s) => ({ spellCheck: !s.spellCheck })),
      setSpellCheckLanguage: (spellCheckLanguage) => set({ spellCheckLanguage }),
      setTexLiveVersion: (texLiveVersion) => set({ texLiveVersion }),
      setAutoCloseBrackets: (autoCloseBrackets) => set({ autoCloseBrackets }),
      toggleAutoCloseBrackets: () => set((s) => ({ autoCloseBrackets: !s.autoCloseBrackets })),
      setLinterEnabled: (linterEnabled) => set({ linterEnabled }),
      toggleLinterEnabled: () => set((s) => ({ linterEnabled: !s.linterEnabled })),
      setShowBreadcrumbs: (showBreadcrumbs) => set({ showBreadcrumbs }),
      toggleShowBreadcrumbs: () => set((s) => ({ showBreadcrumbs: !s.showBreadcrumbs })),
      setShowEditorTabs: (showEditorTabs) => set({ showEditorTabs }),
      toggleShowEditorTabs: () => set((s) => ({ showEditorTabs: !s.showEditorTabs })),
      setShowEquationPreview: (showEquationPreview) => set({ showEquationPreview }),
      toggleShowEquationPreview: () => set((s) => ({ showEquationPreview: !s.showEquationPreview })),
    }),
    {
      name: 'flux-editor-settings',
      partialize: (state) => {
        // Don't persist transient UI state or auto-compile (always on by default)
        const { settingsPanelOpen, autoCompile, isHistoryOpen, isShareModalOpen, isTemplateModalOpen, ...rest } = state;
        return rest;
      },
    },
  ),
);

// Aliases for seamless backward compatibility
export const useSettingsStore = useDocumentSettingsStore;
export const useEditorSettingsStore = useDocumentSettingsStore;
export type SettingsState = DocumentSettingsState;
