import { loader } from "@monaco-editor/react";
import { registerLaTeXLanguage } from "monaco-latex";

/**
 * Registers LaTeX language definition and custom Monaco themes:
 * - `latex-light`: Clean, distraction-free light theme with gentle contrast.
 * - `latex-dark`: Soft dark theme with muted slate background.
 */
export function initializeMonacoThemes(): void {
  if (typeof window === 'undefined') return;

  loader.init().then((monaco) => {
    registerLaTeXLanguage(monaco);

    // Calm light theme tuned for long LaTeX/code editing sessions.
    monaco.editor.defineTheme("latex-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "7c8698", fontStyle: "italic" },
        { token: "keyword", foreground: "255fdc", fontStyle: "bold" },
        { token: "string", foreground: "1a7f4b" },
        { token: "number", foreground: "9a5b00" },
        { token: "delimiter", foreground: "4b5563" },
        { token: "operator", foreground: "b4235b" },
        { token: "type", foreground: "7c3aed" },
        { token: "tag", foreground: "255fdc" },
        { token: "attribute.name", foreground: "b45309" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#1f2328",
        "editor.lineHighlightBackground": "#ededed",
        "editor.lineHighlightBorder": "#00000000",
        "editorLineNumber.foreground": "#8c96a5",
        "editorLineNumber.activeForeground": "#1e293b",
        "editorGutter.background": "#f0f0f0",
        "editorGutter.modifiedBackground": "#f59e0b",
        "editorGutter.addedBackground": "#16a34a",
        "editorGutter.deletedBackground": "#dc2626",
        "editor.selectionBackground": "#255fdc2e",
        "editor.inactiveSelectionBackground": "#255fdc18",
        "editor.selectionHighlightBackground": "#facc1530",
        "editor.wordHighlightBackground": "#facc1526",
        "editor.wordHighlightStrongBackground": "#f59e0b30",
        "editor.findMatchBackground": "#facc1555",
        "editor.findMatchHighlightBackground": "#fde68a66",
        "editorCursor.foreground": "#0f172a",
        "editorWhitespace.foreground": "#d7dce3",
        "editorIndentGuide.background1": "#e6eaf0",
        "editorIndentGuide.activeBackground1": "#94a3b8",
        "editorBracketMatch.background": "#255fdc16",
        "editorBracketMatch.border": "#255fdc80",
        "editorOverviewRuler.border": "#00000000",
        "scrollbarSlider.background": "#94a3b833",
        "scrollbarSlider.hoverBackground": "#94a3b855",
        "scrollbarSlider.activeBackground": "#64748b66",
      },
    });

    // Soft dark theme with enough contrast without the harsh pure-black feel.
    monaco.editor.defineTheme("latex-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "7a8699", fontStyle: "italic" },
        { token: "keyword", foreground: "7aa2ff", fontStyle: "bold" },
        { token: "string", foreground: "7dd3a7" },
        { token: "number", foreground: "f6c177" },
        { token: "delimiter", foreground: "cbd5e1" },
        { token: "operator", foreground: "f0abfc" },
        { token: "type", foreground: "c4b5fd" },
        { token: "tag", foreground: "93c5fd" },
        { token: "attribute.name", foreground: "fbbf24" },
      ],
      colors: {
        "editor.background": "#111827",
        "editor.foreground": "#dbeafe",
        "editor.lineHighlightBackground": "#1e293b",
        "editorLineNumber.foreground": "#64748b",
        "editorLineNumber.activeForeground": "#93c5fd",
        "editorGutter.background": "#0f172a",
        "editor.selectionBackground": "#3b82f64a",
        "editor.inactiveSelectionBackground": "#3b82f626",
        "editor.selectionHighlightBackground": "#fbbf2430",
        "editor.wordHighlightBackground": "#fbbf2426",
        "editor.wordHighlightStrongBackground": "#f59e0b30",
        "editor.findMatchBackground": "#fbbf2455",
        "editor.findMatchHighlightBackground": "#fde68a33",
        "editorCursor.foreground": "#93c5fd",
        "editorWhitespace.foreground": "#334155",
        "editorIndentGuide.background1": "#263449",
        "editorIndentGuide.activeBackground1": "#64748b",
        "editorBracketMatch.background": "#3b82f61f",
        "editorBracketMatch.border": "#93c5fd80",
        "editorOverviewRuler.border": "#00000000",
        "scrollbarSlider.background": "#64748b33",
        "scrollbarSlider.hoverBackground": "#64748b55",
        "scrollbarSlider.activeBackground": "#94a3b866",
      },
    });
  });
}

// Auto-run once on module import in browser
initializeMonacoThemes();
