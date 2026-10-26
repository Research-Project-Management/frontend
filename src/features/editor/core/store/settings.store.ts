/**
 * settings.store.ts
 *
 * Store for editor user preferences, compiler settings, layout sizing, and typography.
 * Persisted in localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompilerEngine, CompileMode } from '@/features/editor/domain/types/compiler.types';
import type { TrackChangesViewMode } from '@/features/editor/domain/types/suggestion.types';
import { EDITOR_STORAGE_KEYS } from '@/features/editor/domain/constants/editor.constants';

export type { CompilerEngine, CompileMode, TrackChangesViewMode };
export type LayoutMode = 'split' | 'editor-only' | 'viewer-only';
export type EditorTheme =
  | 'auto'
  | 'latex-light'
  | 'latex-dark'
  | 'dracula'
  | 'monokai'
  | 'solarized-light'
  | 'solarized-dark'
  | 'github-light'
  | 'github-dark'
  | 'cobalt'
  | 'eclipse'
  | 'light'
  | 'dark';
export type KeybindingMode = 'standard' | 'vim' | 'emacs';
export type SettingsTab =
  | 'editor'
  | 'compiler'
  | 'references'
  | 'github'
  | 'appearance'
  | 'notifications';

export interface DocumentSettingsState {
  engine: CompilerEngine;
  compileMode: CompileMode;
  autoCompile: boolean;
  layout: LayoutMode;
  editorTheme: EditorTheme;
  keybinding: KeybindingMode;
  useCache: boolean;
  stopOnFirstError: boolean;
  settingsPanelOpen: boolean;
  settingsActiveTab: SettingsTab;
  mainFile: string;
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  editorMode: 'code' | 'visual';
  reviewMode: boolean;
  trackChangesViewMode: TrackChangesViewMode;
  isHistoryOpen: boolean;
  isShortcutsOpen: boolean;
  isTemplateModalOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;
  toggleShortcuts: () => void;
  spellCheck: boolean;
  spellCheckLanguage: string;
  texLiveVersion: string;
  fontFamily: string;
  lineHeight: number;
  autoCloseBrackets: boolean;
  linterEnabled: boolean;
  errorLensEnabled: boolean;
  autoComplete: boolean;
  nonBlinkingCursor: boolean;
  previewEditorTabs: boolean;
  pdfViewer: 'overleaf' | 'browser';
  notifyComments: boolean;
  notifyUpdates: boolean;
  showEditorTabs: boolean;
  showEquationPreview: boolean;
  pdfSpreadView: boolean;
  isLocked: boolean;
  syncScroll: boolean;
  mainBibFile: string;
  referenceSearchStyle: 'author-year' | 'numeric' | 'alphanumeric';

  setMainBibFile: (bibFile: string) => void;
  setReferenceSearchStyle: (style: 'author-year' | 'numeric' | 'alphanumeric') => void;
  setSyncScroll: (syncScroll: boolean) => void;
  toggleSyncScroll: () => void;
  setIsLocked: (isLocked: boolean) => void;
  setAutoComplete: (autoComplete: boolean) => void;
  setNonBlinkingCursor: (nonBlinkingCursor: boolean) => void;
  setPreviewEditorTabs: (previewEditorTabs: boolean) => void;
  setPdfViewer: (pdfViewer: 'overleaf' | 'browser') => void;
  setNotifyComments: (notifyComments: boolean) => void;
  setNotifyUpdates: (notifyUpdates: boolean) => void;
  setEngine: (engine: CompilerEngine) => void;
  setCompileMode: (compileMode: CompileMode) => void;
  setAutoCompile: (autoCompile: boolean) => void;
  setLayout: (layout: LayoutMode) => void;
  setEditorTheme: (editorTheme: EditorTheme) => void;
  setKeybinding: (keybinding: KeybindingMode) => void;
  setUseCache: (useCache: boolean) => void;
  setStopOnFirstError: (stop: boolean) => void;
  toggleStopOnFirstError: () => void;
  setSettingsPanelOpen: (open: boolean) => void;
  toggleSettingsPanel: () => void;
  setSettingsActiveTab: (tab: SettingsTab) => void;
  openSettingsModal: (tab?: SettingsTab) => void;
  setIsHistoryOpen: (open: boolean) => void;
  toggleHistory: () => void;
  setIsTemplateModalOpen: (open: boolean) => void;
  toggleTemplateModal: () => void;
  setMainFile: (mainFile: string) => void;
  setFontSize: (fontSize: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setLineHeight: (lineHeight: number) => void;
  setWordWrap: (wordWrap: boolean) => void;
  setLineNumbers: (lineNumbers: boolean) => void;
  setEditorMode: (mode: 'code' | 'visual') => void;
  toggleEditorMode: () => void;
  setReviewMode: (reviewMode: boolean) => void;
  toggleReviewMode: () => void;
  setTrackChangesViewMode: (mode: TrackChangesViewMode) => void;
  setSpellCheck: (spellCheck: boolean) => void;
  toggleSpellCheck: () => void;
  setSpellCheckLanguage: (lang: string) => void;
  setTexLiveVersion: (texLiveVersion: string) => void;
  setAutoCloseBrackets: (enabled: boolean) => void;
  toggleAutoCloseBrackets: () => void;
  setLinterEnabled: (linterEnabled: boolean) => void;
  toggleLinterEnabled: () => void;
  setErrorLensEnabled: (enabled: boolean) => void;
  toggleErrorLensEnabled: () => void;
  setShowEditorTabs: (show: boolean) => void;
  toggleShowEditorTabs: () => void;
  setShowEquationPreview: (show: boolean) => void;
  toggleShowEquationPreview: () => void;
  setPdfSpreadView: (spread: boolean) => void;
  togglePdfSpreadView: () => void;
  suppressBadBoxes: boolean;
  suppressFontWarnings: boolean;
  suppressPackageWarnings: boolean;
  customSuppressedWarnings: string[];
  setSuppressBadBoxes: (suppress: boolean) => void;
  toggleSuppressBadBoxes: () => void;
  setSuppressFontWarnings: (suppress: boolean) => void;
  toggleSuppressFontWarnings: () => void;
  setSuppressPackageWarnings: (suppress: boolean) => void;
  toggleSuppressPackageWarnings: () => void;
  setCustomSuppressedWarnings: (patterns: string[]) => void;
  addSuppressedWarning: (pattern: string) => void;
  removeSuppressedWarning: (pattern: string) => void;
}

export const useSettingsStore = create<DocumentSettingsState>()(
  persist(
    (set) => ({
      engine: 'pdflatex',
      compileMode: 'full',
      autoCompile: true,
      layout: 'split',
      editorTheme: 'auto',
      pdfSpreadView: false,
      isLocked: false,
      syncScroll: true,
      keybinding: 'standard',
      useCache: true,
      settingsPanelOpen: false,
      settingsActiveTab: 'editor',
      mainFile: 'main.tex',
      fontSize: 15,
      wordWrap: true,
      lineNumbers: true,
      editorMode: 'code',
      reviewMode: false,
      trackChangesViewMode: 'changes',
      isHistoryOpen: false,
      isShortcutsOpen: false,
      isTemplateModalOpen: false,
      spellCheck: true,
      spellCheckLanguage: 'en_US',
      texLiveVersion: '2024',
      fontFamily: 'default',
      lineHeight: 1.6,
      autoCloseBrackets: true,
      linterEnabled: true,
      errorLensEnabled: true,
      autoComplete: true,
      nonBlinkingCursor: false,
      previewEditorTabs: false,
      pdfViewer: 'overleaf',
      notifyComments: true,
      notifyUpdates: false,
      showEditorTabs: true,
      showEquationPreview: true,
      stopOnFirstError: false,
      mainBibFile: 'auto',
      referenceSearchStyle: 'author-year',

      setMainBibFile: (mainBibFile) => set({ mainBibFile }),
      setReferenceSearchStyle: (referenceSearchStyle) => set({ referenceSearchStyle }),
      setEngine: (engine) => set({ engine }),
      setCompileMode: (compileMode) => set({ compileMode }),
      setAutoCompile: (autoCompile) => set({ autoCompile }),
      setLayout: (layout) => set({ layout }),
      setEditorTheme: (editorTheme) => set({ editorTheme }),
      setKeybinding: (keybinding) => set({ keybinding }),
      setUseCache: (useCache) => set({ useCache }),
      setStopOnFirstError: (stopOnFirstError) => set({ stopOnFirstError }),
      toggleStopOnFirstError: () =>
        set((s) => ({ stopOnFirstError: !s.stopOnFirstError })),
      setSyncScroll: (syncScroll) => set({ syncScroll }),
      toggleSyncScroll: () => set((s) => ({ syncScroll: !s.syncScroll })),
      setSettingsPanelOpen: (settingsPanelOpen) => set({ settingsPanelOpen }),
      toggleSettingsPanel: () =>
        set((s) => ({ settingsPanelOpen: !s.settingsPanelOpen })),
      setSettingsActiveTab: (settingsActiveTab) => set({ settingsActiveTab }),
      openSettingsModal: (tab) =>
        set((s) => ({
          settingsPanelOpen: true,
          settingsActiveTab: tab || s.settingsActiveTab || 'editor',
        })),
      setIsHistoryOpen: (isHistoryOpen) => set({ isHistoryOpen }),
      toggleHistory: () => set((s) => ({ isHistoryOpen: !s.isHistoryOpen })),
      setIsShortcutsOpen: (isShortcutsOpen) => set({ isShortcutsOpen }),
      toggleShortcuts: () => set((s) => ({ isShortcutsOpen: !s.isShortcutsOpen })),
      setIsTemplateModalOpen: (isTemplateModalOpen) => set({ isTemplateModalOpen }),
      toggleTemplateModal: () => set((s) => ({ isTemplateModalOpen: !s.isTemplateModalOpen })),
      setMainFile: (mainFile) => set({ mainFile }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setWordWrap: (wordWrap) => set({ wordWrap }),
      setLineNumbers: (lineNumbers) => set({ lineNumbers }),
      setEditorMode: (editorMode) => set({ editorMode }),
      toggleEditorMode: () =>
        set((s) => ({ editorMode: s.editorMode === 'code' ? 'visual' : 'code' })),
      setReviewMode: (reviewMode) => set({ reviewMode }),
      toggleReviewMode: () => set((s) => ({ reviewMode: !s.reviewMode })),
      setTrackChangesViewMode: (trackChangesViewMode) => set({ trackChangesViewMode }),
      setSpellCheck: (spellCheck) => set({ spellCheck }),
      toggleSpellCheck: () => set((s) => ({ spellCheck: !s.spellCheck })),
      setSpellCheckLanguage: (spellCheckLanguage) => set({ spellCheckLanguage }),
      setTexLiveVersion: (texLiveVersion) => set({ texLiveVersion }),
      setAutoCloseBrackets: (autoCloseBrackets) => set({ autoCloseBrackets }),
      toggleAutoCloseBrackets: () => set((s) => ({ autoCloseBrackets: !s.autoCloseBrackets })),
      setLinterEnabled: (linterEnabled) => set({ linterEnabled }),
      toggleLinterEnabled: () => set((s) => ({ linterEnabled: !s.linterEnabled })),
      setErrorLensEnabled: (errorLensEnabled) => set({ errorLensEnabled }),
      toggleErrorLensEnabled: () => set((s) => ({ errorLensEnabled: !s.errorLensEnabled })),
      setShowEditorTabs: (showEditorTabs) => set({ showEditorTabs }),
      toggleShowEditorTabs: () => set((s) => ({ showEditorTabs: !s.showEditorTabs })),
      setShowEquationPreview: (showEquationPreview) => set({ showEquationPreview }),
      toggleShowEquationPreview: () => set((s) => ({ showEquationPreview: !s.showEquationPreview })),
      setPdfSpreadView: (pdfSpreadView) => set({ pdfSpreadView }),
      togglePdfSpreadView: () => set((s) => ({ pdfSpreadView: !s.pdfSpreadView })),
      setAutoComplete: (autoComplete) => set({ autoComplete }),
      setNonBlinkingCursor: (nonBlinkingCursor) => set({ nonBlinkingCursor }),
      setPreviewEditorTabs: (previewEditorTabs) => set({ previewEditorTabs }),
      setPdfViewer: (pdfViewer) => set({ pdfViewer }),
      setIsLocked: (isLocked) => set({ isLocked }),
      suppressBadBoxes: false,
      suppressFontWarnings: false,
      suppressPackageWarnings: false,
      customSuppressedWarnings: [],

      setSuppressBadBoxes: (suppressBadBoxes) => set({ suppressBadBoxes }),
      toggleSuppressBadBoxes: () =>
        set((s) => ({ suppressBadBoxes: !s.suppressBadBoxes })),
      setSuppressFontWarnings: (suppressFontWarnings) => set({ suppressFontWarnings }),
      toggleSuppressFontWarnings: () =>
        set((s) => ({ suppressFontWarnings: !s.suppressFontWarnings })),
      setSuppressPackageWarnings: (suppressPackageWarnings) => set({ suppressPackageWarnings }),
      toggleSuppressPackageWarnings: () =>
        set((s) => ({ suppressPackageWarnings: !s.suppressPackageWarnings })),
      setCustomSuppressedWarnings: (customSuppressedWarnings) => set({ customSuppressedWarnings }),
      addSuppressedWarning: (pattern) =>
        set((s) => {
          const trimmed = pattern.trim();
          if (!trimmed || s.customSuppressedWarnings.includes(trimmed)) return s;
          return { customSuppressedWarnings: [...s.customSuppressedWarnings, trimmed] };
        }),
      removeSuppressedWarning: (pattern) =>
        set((s) => ({
          customSuppressedWarnings: s.customSuppressedWarnings.filter((p) => p !== pattern),
        })),
      setNotifyComments: (notifyComments) => set({ notifyComments }),
      setNotifyUpdates: (notifyUpdates) => set({ notifyUpdates }),
    }),
    {
      name: EDITOR_STORAGE_KEYS.SETTINGS,
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 3) {
          return {
            ...(persistedState && typeof persistedState === 'object' ? persistedState : {}),
            wordWrap: true,
          };
        }
        return persistedState;
      },
      partialize: (state) => {
        // Don't persist transient UI state or auto-compile (always on by default)
        const { settingsPanelOpen, settingsActiveTab, autoCompile, isHistoryOpen, isShortcutsOpen, isTemplateModalOpen, isLocked, ...rest } = state;
        return rest;
      },
    },
  ),
);

