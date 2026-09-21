import { loader } from "@monaco-editor/react";
import { registerLaTeXLanguage } from "monaco-latex";

export interface MonacoThemeDefinition {
  id: string;
  name: string;
  type: 'light' | 'dark';
}

export const MONACO_THEMES: MonacoThemeDefinition[] = [
  { id: 'auto', name: 'Auto (Follow Workspace)', type: 'light' },
  { id: 'latex-light', name: 'Overleaf Light', type: 'light' },
  { id: 'latex-dark', name: 'Overleaf Dark', type: 'dark' },
  { id: 'dracula', name: 'Dracula', type: 'dark' },
  { id: 'monokai', name: 'Monokai', type: 'dark' },
  { id: 'solarized-light', name: 'Solarized Light', type: 'light' },
  { id: 'solarized-dark', name: 'Solarized Dark', type: 'dark' },
  { id: 'github-light', name: 'GitHub Light', type: 'light' },
  { id: 'github-dark', name: 'GitHub Dark', type: 'dark' },
  { id: 'cobalt', name: 'Cobalt', type: 'dark' },
  { id: 'eclipse', name: 'Eclipse', type: 'light' },
];

/**
 * Registers LaTeX language definition and custom Overleaf-parity Monaco themes.
 */
export function initializeMonacoThemes(): void {
  if (
    typeof window === 'undefined' ||
    (typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST))
  ) {
    return;
  }

  loader.init().then((monaco) => {
    registerLaTeXLanguage(monaco);

    // 1. Overleaf Default Light
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
        "editorGutter.background": "#f8fafc",
        "editor.selectionBackground": "#255fdc2e",
        "editor.inactiveSelectionBackground": "#255fdc18",
        "editorCursor.foreground": "#0f172a",
        "scrollbarSlider.background": "#94a3b833",
        "scrollbarSlider.hoverBackground": "#94a3b855",
      },
    });

    // 2. Overleaf Default Dark
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
        "editorCursor.foreground": "#93c5fd",
        "scrollbarSlider.background": "#64748b33",
        "scrollbarSlider.hoverBackground": "#64748b55",
      },
    });

    // 3. Dracula
    monaco.editor.defineTheme("dracula", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword", foreground: "ff79c6", fontStyle: "bold" },
        { token: "string", foreground: "f1fa8c" },
        { token: "number", foreground: "bd93f9" },
        { token: "delimiter", foreground: "f8f8f2" },
        { token: "operator", foreground: "ff79c6" },
        { token: "type", foreground: "8be9fd" },
        { token: "tag", foreground: "bd93f9" },
        { token: "attribute.name", foreground: "50fa7b" },
      ],
      colors: {
        "editor.background": "#282a36",
        "editor.foreground": "#f8f8f2",
        "editor.lineHighlightBackground": "#44475a60",
        "editorLineNumber.foreground": "#6272a4",
        "editorLineNumber.activeForeground": "#f8f8f2",
        "editorGutter.background": "#21222c",
        "editor.selectionBackground": "#44475a90",
        "editorCursor.foreground": "#aeafad",
        "scrollbarSlider.background": "#6272a440",
      },
    });

    // 4. Monokai
    monaco.editor.defineTheme("monokai", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "75715e", fontStyle: "italic" },
        { token: "keyword", foreground: "f92672", fontStyle: "bold" },
        { token: "string", foreground: "e6db74" },
        { token: "number", foreground: "ae81ff" },
        { token: "delimiter", foreground: "f8f8f2" },
        { token: "operator", foreground: "f92672" },
        { token: "type", foreground: "66d9ef" },
        { token: "tag", foreground: "a6e22e" },
        { token: "attribute.name", foreground: "a6e22e" },
      ],
      colors: {
        "editor.background": "#272822",
        "editor.foreground": "#f8f8f2",
        "editor.lineHighlightBackground": "#3e3d3280",
        "editorLineNumber.foreground": "#90908a",
        "editorLineNumber.activeForeground": "#f8f8f2",
        "editorGutter.background": "#1e1f1c",
        "editor.selectionBackground": "#49483e",
        "editorCursor.foreground": "#f8f8f0",
      },
    });

    // 5. Solarized Light
    monaco.editor.defineTheme("solarized-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "93a1a1", fontStyle: "italic" },
        { token: "keyword", foreground: "859900", fontStyle: "bold" },
        { token: "string", foreground: "2aa198" },
        { token: "number", foreground: "d33682" },
        { token: "delimiter", foreground: "657b83" },
        { token: "operator", foreground: "859900" },
        { token: "type", foreground: "b58900" },
        { token: "tag", foreground: "268bd2" },
        { token: "attribute.name", foreground: "cb4b16" },
      ],
      colors: {
        "editor.background": "#fdf6e3",
        "editor.foreground": "#657b83",
        "editor.lineHighlightBackground": "#eee8d5",
        "editorLineNumber.foreground": "#93a1a1",
        "editorLineNumber.activeForeground": "#586e75",
        "editorGutter.background": "#f5eed9",
        "editor.selectionBackground": "#eee8d5",
        "editorCursor.foreground": "#586e75",
      },
    });

    // 6. Solarized Dark
    monaco.editor.defineTheme("solarized-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "586e75", fontStyle: "italic" },
        { token: "keyword", foreground: "859900", fontStyle: "bold" },
        { token: "string", foreground: "2aa198" },
        { token: "number", foreground: "d33682" },
        { token: "delimiter", foreground: "839496" },
        { token: "operator", foreground: "859900" },
        { token: "type", foreground: "b58900" },
        { token: "tag", foreground: "268bd2" },
        { token: "attribute.name", foreground: "cb4b16" },
      ],
      colors: {
        "editor.background": "#002b36",
        "editor.foreground": "#839496",
        "editor.lineHighlightBackground": "#07364280",
        "editorLineNumber.foreground": "#586e75",
        "editorLineNumber.activeForeground": "#93a1a1",
        "editorGutter.background": "#00212b",
        "editor.selectionBackground": "#073642",
        "editorCursor.foreground": "#839496",
      },
    });

    // 7. GitHub Light
    monaco.editor.defineTheme("github-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6e7781", fontStyle: "italic" },
        { token: "keyword", foreground: "cf222e", fontStyle: "bold" },
        { token: "string", foreground: "0a3069" },
        { token: "number", foreground: "0550ae" },
        { token: "delimiter", foreground: "24292f" },
        { token: "operator", foreground: "cf222e" },
        { token: "type", foreground: "953800" },
        { token: "tag", foreground: "8250df" },
        { token: "attribute.name", foreground: "116329" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#24292f",
        "editor.lineHighlightBackground": "#f6f8fa",
        "editorLineNumber.foreground": "#8c959f",
        "editorLineNumber.activeForeground": "#24292f",
        "editorGutter.background": "#f6f8fa",
        "editor.selectionBackground": "#b6e3ff",
        "editorCursor.foreground": "#24292f",
      },
    });

    // 8. GitHub Dark
    monaco.editor.defineTheme("github-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "8b949e", fontStyle: "italic" },
        { token: "keyword", foreground: "ff7b72", fontStyle: "bold" },
        { token: "string", foreground: "a5d6ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "delimiter", foreground: "c9d1d9" },
        { token: "operator", foreground: "ff7b72" },
        { token: "type", foreground: "ffa657" },
        { token: "tag", foreground: "d2a8ff" },
        { token: "attribute.name", foreground: "7ee787" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#c9d1d9",
        "editor.lineHighlightBackground": "#161b22",
        "editorLineNumber.foreground": "#6e7681",
        "editorLineNumber.activeForeground": "#c9d1d9",
        "editorGutter.background": "#010409",
        "editor.selectionBackground": "#1f6feb40",
        "editorCursor.foreground": "#c9d1d9",
      },
    });

    // 9. Cobalt
    monaco.editor.defineTheme("cobalt", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "0088ff", fontStyle: "italic" },
        { token: "keyword", foreground: "ff9d00", fontStyle: "bold" },
        { token: "string", foreground: "3ad900" },
        { token: "number", foreground: "ff628c" },
        { token: "delimiter", foreground: "ffffff" },
        { token: "operator", foreground: "ff9d00" },
        { token: "type", foreground: "ffee80" },
        { token: "tag", foreground: "9effff" },
        { token: "attribute.name", foreground: "ffee80" },
      ],
      colors: {
        "editor.background": "#002240",
        "editor.foreground": "#ffffff",
        "editor.lineHighlightBackground": "#001b33",
        "editorLineNumber.foreground": "#3b536b",
        "editorLineNumber.activeForeground": "#ffffff",
        "editorGutter.background": "#00162b",
        "editor.selectionBackground": "#b36500",
        "editorCursor.foreground": "#ffee80",
      },
    });

    // 10. Eclipse
    monaco.editor.defineTheme("eclipse", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "3f7f5f", fontStyle: "italic" },
        { token: "keyword", foreground: "7f0055", fontStyle: "bold" },
        { token: "string", foreground: "2a00ff" },
        { token: "number", foreground: "000000" },
        { token: "delimiter", foreground: "000000" },
        { token: "operator", foreground: "7f0055" },
        { token: "type", foreground: "000000" },
        { token: "tag", foreground: "7f0055" },
        { token: "attribute.name", foreground: "7f0055" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#000000",
        "editor.lineHighlightBackground": "#e8f2fe",
        "editorLineNumber.foreground": "#787878",
        "editorLineNumber.activeForeground": "#000000",
        "editorGutter.background": "#f0f0f0",
        "editor.selectionBackground": "#b5d5ff",
        "editorCursor.foreground": "#000000",
      },
    });
  });
}

// Auto-run once on module import in browser
initializeMonacoThemes();
