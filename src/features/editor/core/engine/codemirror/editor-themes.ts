/**
 * editor-themes.ts
 *
 * Theme definitions and CodeMirror 6 theme extensions for workspace settings.
 * Supports 0ms live reconfiguration across all standard themes with Overleaf parity.
 */

import { EditorView } from '@codemirror/view';
import { type Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export interface EditorThemeDefinition {
  id: string;
  name: string;
  type: 'light' | 'dark';
}

export const EDITOR_THEMES: EditorThemeDefinition[] = [
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

// ── 1. Auto (Adapts to Workspace CSS Variables) ──────────────────────────────
const autoThemeStyle = EditorView.theme({
  '&': {
    color: 'var(--foreground, #1e293b)',
    backgroundColor: 'var(--editor-bg, var(--canvas, #FCFCFB))',
  },
  '.cm-content': {
    caretColor: 'var(--foreground, #0f172a)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--foreground, #0f172a)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--editor-selection, #bfdbfe) !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-gutter, transparent)',
    color: 'var(--muted-foreground, #64748b)',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: 'var(--editor-active-line, #e2f2ff)',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line, #e2f2ff)',
    color: 'var(--foreground, #0f172a)',
    fontWeight: '600',
  },
});

const autoHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#2563eb', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#0d9488' },
  { tag: [t.number, t.atom], color: '#d97706' },
  { tag: [t.variableName, t.propertyName], color: '#7c3aed' },
  { tag: [t.macroName, t.standard(t.name)], color: '#0284c7', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#475569' },
]);

export const autoTheme: Extension = [
  autoThemeStyle,
  syntaxHighlighting(autoHighlightStyle),
];

// ── 2. Overleaf Light (Default LaTeX Light) ──────────────────────────────────
const latexLightStyle = EditorView.theme({
  '&': {
    color: '#24292e',
    backgroundColor: '#FCFCFB',
  },
  '.cm-content': {
    caretColor: '#000000',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#c8e1ff !important',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-gutter, transparent)',
    color: '#57606a',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: 'var(--editor-active-line, #e2f2ff)',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: 'var(--editor-active-line, #e2f2ff)',
    color: '#0366d6',
    fontWeight: '600',
  },
});

const latexLightHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#005cc5', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#22863a' },
  { tag: [t.number, t.atom], color: '#005cc5' },
  { tag: [t.macroName, t.standard(t.name)], color: '#6f42c1', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#24292e' },
]);

export const latexLightTheme: Extension = [
  latexLightStyle,
  syntaxHighlighting(latexLightHighlight),
];

// ── 3. Overleaf Dark ─────────────────────────────────────────────────────────
const latexDarkStyle = EditorView.theme({
  '&': {
    color: '#d4d4d4',
    backgroundColor: '#1e1e1e',
  },
  '.cm-content': {
    caretColor: '#ffffff',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#264f78 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#252526',
    color: '#858585',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#2a2d2e',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#333738',
    color: '#ffffff',
    fontWeight: '600',
  },
}, { dark: true });

const latexDarkHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#569cd6', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#ce9178' },
  { tag: [t.number, t.atom], color: '#b5cea8' },
  { tag: [t.macroName, t.standard(t.name)], color: '#4ec9b0', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#d4d4d4' },
]);

export const latexDarkTheme: Extension = [
  latexDarkStyle,
  syntaxHighlighting(latexDarkHighlight),
];

// ── 4. Dracula ───────────────────────────────────────────────────────────────
const draculaStyle = EditorView.theme({
  '&': {
    color: '#f8f8f2',
    backgroundColor: '#282a36',
  },
  '.cm-content': {
    caretColor: '#f8f8f0',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#44475a !important',
  },
  '.cm-gutters': {
    backgroundColor: '#282a36',
    color: '#6272a4',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#44475a66',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#44475a88',
    color: '#50fa7b',
  },
}, { dark: true });

const draculaHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#6272a4', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#ff79c6', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#f1fa8c' },
  { tag: [t.number, t.atom], color: '#bd93f9' },
  { tag: [t.macroName, t.standard(t.name)], color: '#50fa7b', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#f8f8f2' },
]);

export const draculaTheme: Extension = [
  draculaStyle,
  syntaxHighlighting(draculaHighlight),
];

// ── 5. Monokai ───────────────────────────────────────────────────────────────
const monokaiStyle = EditorView.theme({
  '&': {
    color: '#f8f8f2',
    backgroundColor: '#272822',
  },
  '.cm-content': {
    caretColor: '#f8f8f0',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#49483e !important',
  },
  '.cm-gutters': {
    backgroundColor: '#272822',
    color: '#75715e',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#3e3d32',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#49483e',
    color: '#a6e22e',
  },
}, { dark: true });

const monokaiHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#75715e', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#f92672', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#e6db74' },
  { tag: [t.number, t.atom], color: '#ae81ff' },
  { tag: [t.macroName, t.standard(t.name)], color: '#a6e22e', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#f8f8f2' },
]);

export const monokaiTheme: Extension = [
  monokaiStyle,
  syntaxHighlighting(monokaiHighlight),
];

// ── 6. Solarized Light ───────────────────────────────────────────────────────
const solarizedLightStyle = EditorView.theme({
  '&': {
    color: '#657b83',
    backgroundColor: '#fdf6e3',
  },
  '.cm-content': {
    caretColor: '#586e75',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#eee8d5 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#eee8d5',
    color: '#586e75',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#07364210',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#07364218',
    color: '#268bd2',
  },
});

const solarizedLightHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#93a1a1', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#859900', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#2aa198' },
  { tag: [t.number, t.atom], color: '#d33682' },
  { tag: [t.macroName, t.standard(t.name)], color: '#268bd2', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#657b83' },
]);

export const solarizedLightTheme: Extension = [
  solarizedLightStyle,
  syntaxHighlighting(solarizedLightHighlight),
];

// ── 7. Solarized Dark ────────────────────────────────────────────────────────
const solarizedDarkStyle = EditorView.theme({
  '&': {
    color: '#839496',
    backgroundColor: '#002b36',
  },
  '.cm-content': {
    caretColor: '#839496',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#073642 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#073642',
    color: '#586e75',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#07364288',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#073642cc',
    color: '#2aa198',
  },
}, { dark: true });

export const solarizedDarkTheme: Extension = [
  solarizedDarkStyle,
  syntaxHighlighting(solarizedLightHighlight),
];

// ── 8. GitHub Light ──────────────────────────────────────────────────────────
export const githubLightTheme: Extension = [
  latexLightStyle,
  syntaxHighlighting(latexLightHighlight),
];

// ── 9. GitHub Dark ───────────────────────────────────────────────────────────
const githubDarkStyle = EditorView.theme({
  '&': {
    color: '#c9d1d9',
    backgroundColor: '#0d1117',
  },
  '.cm-content': {
    caretColor: '#58a6ff',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#3b5070 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#0d1117',
    color: '#6e7681',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#161b22',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#1f242c',
    color: '#58a6ff',
  },
}, { dark: true });

const githubDarkHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#8b949e', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#ff7b72', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#a5d6ff' },
  { tag: [t.number, t.atom], color: '#79c0ff' },
  { tag: [t.macroName, t.standard(t.name)], color: '#d2a8ff', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#c9d1d9' },
]);

export const githubDarkTheme: Extension = [
  githubDarkStyle,
  syntaxHighlighting(githubDarkHighlight),
];

// ── 10. Cobalt ───────────────────────────────────────────────────────────────
const cobaltStyle = EditorView.theme({
  '&': {
    color: '#ffffff',
    backgroundColor: '#002240',
  },
  '.cm-content': {
    caretColor: '#ffffff',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#b36500 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#001b33',
    color: '#38566f',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#003366',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#003d7a',
    color: '#ffee80',
  },
}, { dark: true });

const cobaltHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#0088ff', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#ff9d00', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#3ad900' },
  { tag: [t.number, t.atom], color: '#ff628c' },
  { tag: [t.macroName, t.standard(t.name)], color: '#ffee80', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#e1efff' },
]);

export const cobaltTheme: Extension = [
  cobaltStyle,
  syntaxHighlighting(cobaltHighlight),
];

// ── 11. Eclipse ──────────────────────────────────────────────────────────────
const eclipseStyle = EditorView.theme({
  '&': {
    color: '#000000',
    backgroundColor: '#FCFCFB',
  },
  '.cm-content': {
    caretColor: '#000000',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#c6d8f0 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#f0f0f0',
    color: '#57606a',
    borderRight: 'none',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    backgroundColor: '#e8f2fe',
  },
  '&.cm-editor .cm-activeLineGutter, .cm-activeLineGutter': {
    backgroundColor: '#d8e8fc',
    color: '#000000',
    fontWeight: '600',
  },
});

const eclipseHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#3f7f5f', fontStyle: 'italic' },
  { tag: [t.keyword, t.operatorKeyword], color: '#7f0055', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#2a00ff' },
  { tag: [t.number, t.atom], color: '#0000c0' },
  { tag: [t.macroName, t.standard(t.name)], color: '#7f0055', fontWeight: '600' },
  { tag: [t.bracket, t.punctuation], color: '#000000' },
]);

export const eclipseTheme: Extension = [
  eclipseStyle,
  syntaxHighlighting(eclipseHighlight),
];

/**
 * Resolves a CodeMirror 6 Extension corresponding to a user theme setting.
 */
export function getThemeExtension(themeId: string): Extension {
  switch (themeId) {
    case 'latex-light':
    case 'light':
      return latexLightTheme;
    case 'latex-dark':
    case 'dark':
      return latexDarkTheme;
    case 'dracula':
      return draculaTheme;
    case 'monokai':
      return monokaiTheme;
    case 'solarized-light':
      return solarizedLightTheme;
    case 'solarized-dark':
      return solarizedDarkTheme;
    case 'github-light':
      return githubLightTheme;
    case 'github-dark':
      return githubDarkTheme;
    case 'cobalt':
      return cobaltTheme;
    case 'eclipse':
      return eclipseTheme;
    case 'auto':
    default:
      return autoTheme;
  }
}
