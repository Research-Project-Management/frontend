/**
 * theme.ts
 *
 * CodeMirror 6 theme styling for Flux Editor:
 * - Syncs with Tailwind CSS variables and dark/light modes.
 * - LaTeX syntax highlight tags.
 * - SyncTeX and compiler error line flash styles.
 */

import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
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
    '&.cm-focused': {
      outline: 'none !important',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
      lineHeight: '1.65',
      outline: 'none !important',
    },
    '.cm-content': {
      outline: 'none !important',
    },

    '.cm-gutters': {
      backgroundColor: 'var(--background, #ffffff)',
      color: 'var(--text-muted, #94a3b8)',
      borderRight: 'none',
      userSelect: 'none',
      minHeight: '100%',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 12px',
      minWidth: '36px',
      textAlign: 'right',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(0, 0, 0, 0.035)',
      color: 'var(--primary, #0969DA)',
      fontWeight: '600',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(0, 0, 0, 0.035)',
    },
    '.cm-foldGutter, .cm-lint-gutter': {
      backgroundColor: 'transparent',
    },
    '.cm-lint-gutter': {
      width: '18px',
    },
    '.cm-lint-gutter .cm-gutterElement': {
      padding: '0 2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--popover, #ffffff)',
      color: 'var(--popover-foreground, #0f172a)',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: '8px',
      boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.06)',
    },
    '.cm-tooltip.cm-tooltip-lint': {
      marginLeft: '24px',
      marginTop: '4px',
      borderRadius: '8px',
      border: '1px solid var(--border, #e2e8f0)',
      overflow: 'hidden',
      maxWidth: '460px',
    },
    '.cm-diagnostic': {
      padding: '8px 12px',
      fontSize: '12.5px',
      lineHeight: '1.5',
      display: 'block',
      whiteSpace: 'pre-wrap',
    },
    '.cm-diagnostic-error': {
      borderLeft: '4px solid #ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.04)',
    },
    '.cm-diagnostic-warning': {
      borderLeft: '4px solid #f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.04)',
    },
    '.cm-diagnosticSource': {
      fontSize: '11px',
      color: 'var(--text-muted, #64748b)',
      marginTop: '4px',
      display: 'block',
      fontWeight: '500',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--foreground, #0f172a)',
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
    '.cm-comment-highlight': {
      backgroundColor: '#fae29c !important',
      color: '#0f172a !important',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-comment-highlight-active': {
      backgroundColor: '#fcd34d !important',
      outline: '1.5px solid #3b82f6',
      borderRadius: '2px',
      cursor: 'pointer',
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
    '&.cm-focused': {
      outline: 'none !important',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
      lineHeight: '1.65',
      outline: 'none !important',
    },
    '.cm-content': {
      outline: 'none !important',
    },

    '.cm-gutters': {
      backgroundColor: 'var(--background, #090d16)',
      color: 'rgba(255, 255, 255, 0.4)',
      borderRight: 'none',
      userSelect: 'none',
      minHeight: '100%',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 12px',
      minWidth: '36px',
      textAlign: 'right',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      color: '#60a5fa',
      fontWeight: '600',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    '.cm-foldGutter, .cm-lint-gutter': {
      backgroundColor: 'transparent',
    },
    '.cm-lint-gutter': {
      width: '18px',
    },
    '.cm-lint-gutter .cm-gutterElement': {
      padding: '0 2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--popover, #0f172a)',
      color: 'var(--popover-foreground, #f8fafc)',
      border: '1px solid var(--border, #1e293b)',
      borderRadius: '8px',
      boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.4), 0 2px 6px -1px rgba(0, 0, 0, 0.2)',
    },
    '.cm-tooltip.cm-tooltip-lint': {
      marginLeft: '24px',
      marginTop: '4px',
      borderRadius: '8px',
      border: '1px solid var(--border, #1e293b)',
      overflow: 'hidden',
      maxWidth: '460px',
    },
    '.cm-diagnostic': {
      padding: '8px 12px',
      fontSize: '12.5px',
      lineHeight: '1.5',
      display: 'block',
      whiteSpace: 'pre-wrap',
    },
    '.cm-diagnostic-error': {
      borderLeft: '4px solid #ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    '.cm-diagnostic-warning': {
      borderLeft: '4px solid #f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    '.cm-diagnosticSource': {
      fontSize: '11px',
      color: 'rgba(255, 255, 255, 0.45)',
      marginTop: '4px',
      display: 'block',
      fontWeight: '500',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--foreground, #f8fafc)',
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
    '.cm-comment-highlight': {
      backgroundColor: 'rgba(250, 226, 156, 0.4) !important',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-comment-highlight-active': {
      backgroundColor: 'rgba(250, 226, 156, 0.65) !important',
      outline: '1.5px solid #3b82f6',
      borderRadius: '2px',
      cursor: 'pointer',
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
