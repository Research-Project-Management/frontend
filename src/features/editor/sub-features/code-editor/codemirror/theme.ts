/**
 * theme.ts
 *
 * CodeMirror 6 theme styling for Flux Editor:
 * - Syncs with Tailwind CSS variables and dark/light modes.
 * - LaTeX syntax highlight tags.
 * - SyncTeX and compiler error line flash styles.
 */

import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const fluxLightTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--background, #ffffff)',
      color: 'var(--foreground, #0f172a)',
      fontSize: '14px',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
      lineHeight: '1.65',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--muted, #f8fafc)',
      color: '#94a3b8',
      borderRight: '1px solid var(--border, #e2e8f0)',
      userSelect: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--accent, #e2e8f0)',
      color: '#1e293b',
      fontWeight: '600',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(226, 232, 240, 0.4)',
    },
    '.cm-cursor': {
      borderLeftColor: '#2563eb',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(59, 130, 246, 0.2) !important',
    },
    '.cm-synctex-flash': {
      backgroundColor: 'rgba(234, 179, 8, 0.35) !important',
      transition: 'background-color 1s ease-out',
    },
    '.cm-error-line': {
      backgroundColor: 'rgba(239, 68, 68, 0.15) !important',
      textDecoration: 'underline wavy #ef4444',
    },
  },
  { dark: false }
);

export const fluxDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--background, #090d16)',
      color: 'var(--foreground, #f8fafc)',
      fontSize: '14px',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
      lineHeight: '1.65',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--muted, #0f172a)',
      color: '#64748b',
      borderRight: '1px solid var(--border, #1e293b)',
      userSelect: 'none',
      paddingRight: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--accent, #1e293b)',
      color: '#93c5fd',
      fontWeight: '600',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(30, 41, 59, 0.5)',
    },
    '.cm-cursor': {
      borderLeftColor: '#60a5fa',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(59, 130, 246, 0.3) !important',
    },
    '.cm-synctex-flash': {
      backgroundColor: 'rgba(234, 179, 8, 0.35) !important',
      transition: 'background-color 1s ease-out',
    },
    '.cm-error-line': {
      backgroundColor: 'rgba(239, 68, 68, 0.2) !important',
      textDecoration: 'underline wavy #ef4444',
    },
  },
  { dark: true }
);

export const fluxHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#9333ea', fontWeight: 'bold' }, // \begin, \end, \section
  { tag: t.controlKeyword, color: '#7c3aed', fontWeight: 'bold' },
  { tag: t.definition(t.variableName), color: '#0284c7' }, // labels
  { tag: t.variableName, color: '#0284c7' },
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' }, // % comments
  { tag: t.string, color: '#16a34a' },
  { tag: t.special(t.string), color: '#d97706' }, // math expressions
  { tag: t.macroName, color: '#2563eb', fontWeight: '600' }, // \textbf, \textit, \cite
  { tag: t.bracket, color: '#f59e0b' }, // {}, []
  { tag: t.operator, color: '#ea580c' },
  { tag: t.heading, color: '#1d4ed8', fontWeight: 'bold' },
]);

export function getEditorTheme(isDark: boolean): Extension {
  return [isDark ? fluxDarkTheme : fluxLightTheme, syntaxHighlighting(fluxHighlightStyle)];
}
