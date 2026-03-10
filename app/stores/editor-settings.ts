import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LaTeXEngine = "pdflatex" | "xelatex" | "lualatex";
export type CompileMode = "normal" | "fast";
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
  setEngine: (engine: LaTeXEngine) => void;
  setCompileMode: (compileMode: CompileMode) => void;
  setAutoCompile: (autoCompile: boolean) => void;
  setLayout: (layout: LayoutMode) => void;
  setEditorTheme: (editorTheme: EditorTheme) => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  setEditorFlex: (editorFlex: number) => void;
}

export const useEditorSettingsStore = create<EditorSettingsState>()(
  persist(
    (set) => ({
      engine: "pdflatex",
      compileMode: "normal",
      autoCompile: false,
      layout: "split",
      editorTheme: "light",
      sidebarWidth: 300,
      editorFlex: 0.5,
      setEngine: (engine) => set({ engine }),
      setCompileMode: (compileMode) => set({ compileMode }),
      setAutoCompile: (autoCompile) => set({ autoCompile }),
      setLayout: (layout) => set({ layout }),
      setEditorTheme: (editorTheme) => set({ editorTheme }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setEditorFlex: (editorFlex) => set({ editorFlex }),
    }),
    { name: "flux-editor-settings" },
  ),
);
