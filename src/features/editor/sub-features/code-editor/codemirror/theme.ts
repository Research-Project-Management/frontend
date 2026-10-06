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
      backgroundColor: 'var(--editor-bg, #FCFCFB)',
      color: 'var(--foreground, #212121)',
      fontSize: '14px',
      height: '100%',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-editor': {
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
      lineHeight: '1.65',
      outline: 'none',
      overflowX: 'auto',
      maxWidth: '100%',
      minWidth: '0',
    },
    '.cm-content': {
      outline: 'none',
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
      flexGrow: 1,
      boxSizing: 'border-box',
      padding: '0',
    },
    '.cm-line': {
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      padding: '0 8px',
      overflowWrap: 'anywhere',
    },
    '.cm-lineWrapping': {
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      flexShrink: '1',
      maxWidth: '100%',
    },
    '.cm-lineWrapping .cm-line': {
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      maxWidth: '100%',
    },

    '.cm-gutters': {
      backgroundColor: 'rgba(9, 105, 218, 0.055)',
      color: 'var(--muted-foreground, #6E6E6E)',
      borderRight: 'none',
      userSelect: 'none',
      minHeight: '100%',
    },
    '.cm-lineNumbers': {
      order: 0,
      backgroundColor: 'transparent',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 6px 0 2px',
      minWidth: '22px',
      textAlign: 'right',
      color: 'var(--muted-foreground, #6E6E6E)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(9, 105, 218, 0.12)',
      color: 'var(--primary, #0969DA)',
      fontWeight: '600',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--primary-subtle, rgba(9, 105, 218, 0.08))',
      width: '100%',
    },
    '.cm-foldGutter': {
      order: 1,
      backgroundColor: 'transparent',
    },
    '.cm-gutter-lint, .cm-lint-gutter': {
      order: -1,
      width: '12px',
      backgroundColor: 'transparent',
    },
    '.cm-gutter-lint .cm-gutterElement, .cm-lint-gutter .cm-gutterElement': {
      padding: '0 1px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.cm-lint-marker': {
      width: '8px',
      height: '8px',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--popover, #FCFCFB)',
      color: 'var(--popover-foreground, #212121)',
      border: '1px solid var(--border, #E4E4E4)',
      borderRadius: '8px',
      boxShadow: 'var(--shadow-overlay, 0 4px 12px 0 rgb(0 0 0 / 0.08))',
    },
    '.cm-tooltip.cm-tooltip-lint': {
      marginLeft: '24px',
      marginTop: '4px',
      borderRadius: '8px',
      border: '1px solid var(--border, #E4E4E4)',
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
      borderLeft: '2px solid hsl(var(--destructive, #ef4444))',
      backgroundColor: 'rgba(239, 68, 68, 0.04)',
    },
    '.cm-diagnostic-warning': {
      borderLeft: '2px solid hsl(var(--warning, #f59e0b))',
      backgroundColor: 'rgba(245, 158, 11, 0.04)',
    },
    '.cm-diagnosticSource': {
      fontSize: '11px',
      color: 'var(--text-muted, #6E6E6E)',
      marginTop: '4px',
      display: 'block',
      fontWeight: '500',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--foreground, #212121)',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(9, 105, 218, 0.15)',
    },
    '.cm-synctex-flash': {
      backgroundColor: 'rgba(234, 179, 8, 0.35)',
      transition: 'background-color 0.8s ease-out',
    },
    '.cm-error-line': {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      textDecoration: 'underline wavy #ef4444',
    },
    '.cm-comment-highlight': {
      backgroundColor: '#fae29c',
      color: '#0f172a',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-comment-highlight-active': {
      backgroundColor: '#fcd34d',
      outline: '1.5px solid #3b82f6',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-track-change': {
      borderRadius: '2px',
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    },
    '.cm-track-change-insert': {
      backgroundColor: 'rgba(34, 197, 94, 0.16)',
      borderBottom: '2px solid #16a34a',
      color: '#15803d',
    },
    '.cm-track-change-insert:hover': {
      backgroundColor: 'rgba(34, 197, 94, 0.28)',
    },
    '.cm-track-change-delete': {
      backgroundColor: 'rgba(239, 68, 68, 0.14)',
      textDecoration: 'line-through #dc2626 2px',
      color: '#b91c1c',
    },
    '.cm-track-change-delete:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.26)',
    },
    '.cm-track-change-replace': {
      backgroundColor: 'rgba(245, 158, 11, 0.16)',
      borderBottom: '2px dashed #d97706',
      color: '#b45309',
    },
    '.cm-track-change-replace:hover': {
      backgroundColor: 'rgba(245, 158, 11, 0.28)',
    },
    '.cm-track-change-hidden': {
      display: 'none',
    },
  },
  { dark: false }
);

export const fluxDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--editor-bg, #1A1A22)',
      color: 'var(--foreground, #F0F0F0)',
      fontSize: '14px',
      height: '100%',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-editor': {
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
      lineHeight: '1.65',
      outline: 'none',
      overflowX: 'auto',
      maxWidth: '100%',
      minWidth: '0',
    },
    '.cm-content': {
      outline: 'none',
      width: '100%',
      maxWidth: '100%',
      minWidth: '0',
      flexGrow: 1,
      boxSizing: 'border-box',
      padding: '0',
    },
    '.cm-line': {
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      padding: '0 8px',
      overflowWrap: 'anywhere',
    },
    '.cm-lineWrapping': {
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      flexShrink: '1',
      maxWidth: '100%',
    },
    '.cm-lineWrapping .cm-line': {
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
      maxWidth: '100%',
    },

    '.cm-gutters': {
      backgroundColor: 'rgba(56, 139, 253, 0.08)',
      color: 'var(--muted-foreground, #8A8A8E)',
      borderRight: 'none',
      userSelect: 'none',
      minHeight: '100%',
    },
    '.cm-lineNumbers': {
      order: 0,
      backgroundColor: 'transparent',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 6px 0 2px',
      minWidth: '22px',
      textAlign: 'right',
      color: 'var(--muted-foreground, #8A8A8E)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(56, 139, 253, 0.18)',
      color: 'var(--primary, #58A6FF)',
      fontWeight: '600',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(56, 139, 253, 0.15)',
      width: '100%',
    },
    '.cm-foldGutter': {
      order: 1,
      backgroundColor: 'transparent',
    },
    '.cm-gutter-lint, .cm-lint-gutter': {
      order: -1,
      width: '12px',
      backgroundColor: 'transparent',
    },
    '.cm-gutter-lint .cm-gutterElement, .cm-lint-gutter .cm-gutterElement': {
      padding: '0 1px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.cm-lint-marker': {
      width: '8px',
      height: '8px',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--popover, #1A1A22)',
      color: 'var(--popover-foreground, #F0F0F0)',
      border: '1px solid var(--border, #2D2D31)',
      borderRadius: '8px',
      boxShadow: 'var(--shadow-overlay, 0 4px 12px 0 rgb(0 0 0 / 0.4))',
    },
    '.cm-tooltip.cm-tooltip-lint': {
      marginLeft: '24px',
      marginTop: '4px',
      borderRadius: '8px',
      border: '1px solid var(--border, #2D2D31)',
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
      borderLeft: '2px solid hsl(var(--destructive, #ef4444))',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    '.cm-diagnostic-warning': {
      borderLeft: '2px solid hsl(var(--warning, #f59e0b))',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
    },
    '.cm-diagnosticSource': {
      fontSize: '11px',
      color: 'var(--text-muted, #8A8A8E)',
      marginTop: '4px',
      display: 'block',
      fontWeight: '500',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--foreground, #F0F0F0)',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(88, 166, 255, 0.22)',
    },
    '.cm-synctex-flash': {
      backgroundColor: 'rgba(234, 179, 8, 0.35)',
      transition: 'background-color 0.8s ease-out',
    },
    '.cm-error-line': {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      textDecoration: 'underline wavy #ef4444',
    },
    '.cm-comment-highlight': {
      backgroundColor: 'rgba(250, 226, 156, 0.4)',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-comment-highlight-active': {
      backgroundColor: 'rgba(250, 226, 156, 0.65)',
      outline: '1.5px solid #3b82f6',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-track-change': {
      borderRadius: '2px',
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    },
    '.cm-track-change-insert': {
      backgroundColor: 'rgba(34, 197, 94, 0.22)',
      borderBottom: '2px solid #22c55e',
      color: '#4ade80',
    },
    '.cm-track-change-insert:hover': {
      backgroundColor: 'rgba(34, 197, 94, 0.35)',
    },
    '.cm-track-change-delete': {
      backgroundColor: 'rgba(239, 68, 68, 0.22)',
      textDecoration: 'line-through #ef4444 2px',
      color: '#f87171',
    },
    '.cm-track-change-delete:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.35)',
    },
    '.cm-track-change-replace': {
      backgroundColor: 'rgba(245, 158, 11, 0.22)',
      borderBottom: '2px dashed #f59e0b',
      color: '#fbbf24',
    },
    '.cm-track-change-replace:hover': {
      backgroundColor: 'rgba(245, 158, 11, 0.35)',
    },
    '.cm-track-change-hidden': {
      display: 'none',
    },
  },
  { dark: true }
);

export const fluxLightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#7c3aed', fontWeight: '600' }, // \begin, \end, \section
  { tag: t.controlKeyword, color: '#6d28d9', fontWeight: '600' },
  { tag: t.definition(t.variableName), color: '#0369a1' }, // labels
  { tag: t.variableName, color: '#0284c7' },
  { tag: t.comment, color: '#64748b', fontStyle: 'italic' }, // % comments
  { tag: t.string, color: '#15803d' },
  { tag: t.special(t.string), color: '#b45309' }, // math expressions
  { tag: t.macroName, color: '#1d4ed8', fontWeight: '600' }, // \textbf, \textit, \cite
  { tag: t.bracket, color: '#d97706' }, // {}, []
  { tag: t.operator, color: '#c2410c' },
  { tag: t.heading, color: '#1e40af', fontWeight: '600' },
]);

export const fluxDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c084fc', fontWeight: '600' }, // \begin, \end, \section (~8.5:1 on dark)
  { tag: t.controlKeyword, color: '#d8b4fe', fontWeight: '600' },
  { tag: t.definition(t.variableName), color: '#38bdf8' }, // labels (~9.8:1)
  { tag: t.variableName, color: '#38bdf8' },
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' }, // % comments (~7.2:1)
  { tag: t.string, color: '#4ade80' }, // (~10.5:1)
  { tag: t.special(t.string), color: '#fde047' }, // math expressions (~13:1)
  { tag: t.macroName, color: '#60a5fa', fontWeight: '600' }, // \textbf, \textit (~8.2:1)
  { tag: t.bracket, color: '#fbbf24' }, // {}, [] (~10:1)
  { tag: t.operator, color: '#fb923c' }, // (~8.7:1)
  { tag: t.heading, color: '#93c5fd', fontWeight: '600' }, // (~11.5:1)
]);

// Backward compatibility alias
export const fluxHighlightStyle = fluxLightHighlightStyle;

export function getEditorTheme(isDark: boolean): Extension {
  return [
    isDark ? fluxDarkTheme : fluxLightTheme,
    syntaxHighlighting(isDark ? fluxDarkHighlightStyle : fluxLightHighlightStyle),
  ];
}
