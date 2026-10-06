/**
 * latex-typography.ts
 *
 * Configures dynamic typography (font size, font family, line height) for CodeMirror.
 */

import { EditorView } from '@codemirror/view';

export const FONT_FAMILY_MAP: Record<string, string> = {
  default: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
  menlo: 'Menlo, Monaco, "Courier New", monospace',
  consolas: 'Consolas, "Lucida Console", monospace',
  fira: '"Fira Code", monospace',
  'source-code': '"Source Code Pro", monospace',
};

export function getTypographyExtension(
  fontSize = 15,
  fontFamily = 'default',
  lineHeight = 1.6
) {
  const resolvedFont = FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP.default;

  return EditorView.theme({
    '&': {
      fontSize: `${fontSize}px`,
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      fontFamily: resolvedFont,
      lineHeight: `${lineHeight}`,
      outline: 'none',
    },
    '.cm-content': {
      outline: 'none',
    },
  });
}
