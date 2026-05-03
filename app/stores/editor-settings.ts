import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LaTeXEngine = "pdflatex" | "xelatex" | "lualatex";
/** "full" = complete compile with images · "draft" = skip image rendering (faster) */
export type CompileMode = "full" | "draft";
export type LayoutMode = "split" | "editor-only" | "viewer-only";
export type EditorTheme = "light" | "dark";

interface EditorSettingsState {
  engine: LaTeXEngine;
  compileMode: CompileMode;
  autoCompile: boolean;
  layout: LayoutMode;
  editorTheme: EditorTheme;
  sidebarWidth: number;
  editorFlex: number;
  useCache: boolean;
  settingsPanelOpen: boolean;
  mainFile: string;
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  setEngine: (engine: LaTeXEngine) => void;
  setCompileMode: (compileMode: CompileMode) => void;
  setAutoCompile: (autoCompile: boolean) => void;
  setLayout: (layout: LayoutMode) => void;
  setEditorTheme: (editorTheme: EditorTheme) => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  setEditorFlex: (editorFlex: number) => void;
  setUseCache: (useCache: boolean) => void;
  setSettingsPanelOpen: (open: boolean) => void;
  toggleSettingsPanel: () => void;
  setMainFile: (mainFile: string) => void;
  setFontSize: (fontSize: number) => void;
  setWordWrap: (wordWrap: boolean) => void;
  setLineNumbers: (lineNumbers: boolean) => void;
}

export const useEditorSettingsStore = create<EditorSettingsState>()(
  persist(
    (set) => ({
      engine: "pdflatex",
      compileMode: "full",
      autoCompile: false,
      layout: "split",
      editorTheme: "light",
      sidebarWidth: 300,
      editorFlex: 0.5,
      useCache: true,
      settingsPanelOpen: false,
      mainFile: "main.tex",
      fontSize: 14,
      wordWrap: true,
      lineNumbers: true,
      setEngine: (engine) => set({ engine }),
      setCompileMode: (compileMode) => set({ compileMode }),
      setAutoCompile: (autoCompile) => set({ autoCompile }),
      setLayout: (layout) => set({ layout }),
      setEditorTheme: (editorTheme) => set({ editorTheme }),
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
    }),
    {
      name: "flux-editor-settings",
      partialize: (state) => {
        // Don't persist the panel open state
        const { settingsPanelOpen, ...rest } = state;
        return rest;
      },
    },
  ),
);
