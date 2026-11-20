/**
 * codemirror-base-theme.ts
 *
 * Base layout theme, typography theme, fold gutter markers, line number interactions,
 * and visual mode extension bundle for CodeMirror 6.
 */

import { type Extension, EditorSelection } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { foldGutter } from '@codemirror/language';
import { latexVisualHeadings } from '@/features/editor/core/engine/extensions/latex-visual-headings';
import { latexVisualMath } from '@/features/editor/core/engine/extensions/latex-visual-math';
import { latexVisualCitations } from '@/features/editor/core/engine/extensions/latex-visual-citations';

export const editorBaseTheme = EditorView.theme({
  '&': {
    flex: '1 1 0%',
    minHeight: '0',
    height: '100%',
    backgroundColor: 'var(--editor-bg, var(--canvas, #FCFCFB))',
  },
  '.cm-scroller': {
    flex: '1 1 0%',
    minHeight: '0',
    height: '100%',
    overflowX: 'auto',
    overflowY: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    padding: '0 0 32px 0',
    flexGrow: '1',
    minWidth: '0',
    boxSizing: 'border-box',
  },
  '.cm-line': {
    padding: '0 8px',
    boxSizing: 'border-box',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    padding: '0 8px',
    boxSizing: 'border-box',
  },
  '.cm-gutters': {
    borderRight: '1px solid var(--editor-gutter-border, #CFE3FA)',
    backgroundColor: 'var(--editor-gutter, #EEF6FF)',
    color: 'var(--muted-foreground, #57606a)',
    fontFamily:
      'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    userSelect: 'none',
    padding: '0',
  },
  '.cm-gutterElement': {
    display: 'flex !important',
    alignItems: 'flex-start',
    color: 'var(--muted-foreground, #57606a)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  '.cm-gutter.cm-foldGutter': {
    width: '14px',
    minWidth: '14px',
  },
  '.cm-gutter.cm-foldGutter .cm-gutterElement': {
    justifyContent: 'center',
    padding: '0 2px 0 0',
    width: '14px',
    minWidth: '14px',
    cursor: 'pointer',
  },
  '.cm-gutter.cm-lineNumbers': {
    minWidth: '30px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    justifyContent: 'flex-end',
    padding: '0 4px 0 8px',
    minWidth: '30px',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
  },
  '.cm-gutterElement.cm-foldGutter': {
    justifyContent: 'center',
    padding: '0',
    width: '14px',
    minWidth: '14px',
    marginRight: '0px',
    cursor: 'pointer',
  },
  '.cm-fold-marker': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    marginTop: 'calc((var(--cm-line-height, 1.54) * 1em - 14px) / 2)',
    borderRadius: '3px',
    color: 'var(--muted-foreground, #57606a)',
  },
  '.cm-fold-marker.cm-fold-open': {
    opacity: '0',
  },
  '.cm-gutters:hover .cm-fold-marker.cm-fold-open': {
    opacity: '0.45',
  },
  '.cm-fold-marker.cm-fold-open:hover': {
    opacity: '1 !important',
    color: 'var(--foreground)',
    backgroundColor: 'var(--muted, rgba(125, 125, 125, 0.2))',
  },
  '.cm-fold-marker.cm-fold-closed': {
    opacity: '1',
    color: 'var(--primary, #0969DA)',
  },
  '.cm-fold-marker.cm-fold-closed:hover': {
    opacity: '1 !important',
    backgroundColor: 'var(--muted, rgba(125, 125, 125, 0.2))',
  },
  '.cm-foldGutter span': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
  },
  '.cm-foldPlaceholder': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle',
    height: '1.15em',
    lineHeight: '1',
    padding: '0 4px',
    margin: '0 2px',
    border: '1px solid var(--border, #d0d7de)',
    borderRadius: '3px',
    backgroundColor: 'var(--muted, #f6f8fa)',
    color: 'var(--muted-foreground, #57606a)',
    fontSize: '0.85em',
    cursor: 'pointer',
  },
  '.cm-activeLineGutter': {
    color: 'var(--primary, #0969DA)',
    fontWeight: '600',
  },
  '.cm-panel.cm-search': {
    padding: '6px 12px',
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    borderTop: '1px solid var(--border)',
    fontSize: '12px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
  },
  '.cm-panel.cm-search input': {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    outline: 'none',
  },
  '.cm-panel.cm-search input:focus': {
    borderColor: 'var(--primary, #0969DA)',
  },
  '.cm-panel.cm-search button': {
    backgroundColor: 'var(--muted)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  '.cm-panel.cm-search button:hover': {
    backgroundColor: 'var(--accent)',
  },
  '.cm-panel.cm-search label': {
    fontSize: '11px',
    color: 'var(--muted-foreground)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    cursor: 'pointer',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(255, 213, 0, 0.35)',
    borderRadius: '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(255, 170, 0, 0.65)',
    outline: '1px solid #d97706',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    outline: '1px solid rgba(99, 102, 241, 0.35)',
    borderRadius: '2px',
  },
});

const FONT_STACK_MAP: Record<string, string> = {
  opendyslexic: 'OpenDyslexic, OpenDyslexicMono',
  fira: 'Fira Code',
  jetbrains: 'JetBrains Mono',
  'source-code': 'Source Code Pro',
  consolas: 'Consolas',
  courier: 'Courier New',
  inconsolata: 'Inconsolata',
};

export function createTypographyExtension(
  fontSize: number = 13,
  fontFamily?: string,
  lineHeight?: number,
): Extension {
  const customFont = fontFamily ? (FONT_STACK_MAP[fontFamily] ?? fontFamily) : undefined;
  const fallbackStack =
    'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  const fontStack =
    customFont && customFont.trim().length > 0 && customFont !== 'default'
      ? `${customFont.includes(',') ? customFont : `"${customFont}"`}, ${fallbackStack}`
      : fallbackStack;

  const effectiveLineHeight = lineHeight ? `${lineHeight}` : '1.54';

  return EditorView.theme({
    '&': {
      fontSize: `${fontSize}px`,
      '--cm-line-height': effectiveLineHeight,
    },
    '.cm-scroller': {
      fontFamily: fontStack,
    },
    '.cm-content, .cm-gutters, .cm-gutter, .cm-gutterElement': {
      fontSize: `${fontSize}px`,
      lineHeight: effectiveLineHeight,
      fontFamily: fontStack,
    },
    '.cm-line': {
      lineHeight: effectiveLineHeight,
      fontFamily: fontStack,
    },
  });
}

/**
 * Creates SVG vector fold marker DOM for CodeMirror 6 foldGutter.
 * Replaces crude text "v" / ">" with crisp, perfectly aligned vector chevrons (Overleaf / VS Code standard).
 */
export function createFoldMarkerDOM(open: boolean): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('createFoldMarkerDOM requires a browser DOM environment');
  }
  const marker = document.createElement('span');
  marker.className = `cm-fold-marker ${open ? 'cm-fold-open' : 'cm-fold-closed'}`;
  marker.setAttribute('aria-label', open ? 'Fold line' : 'Unfold line');
  marker.title = open ? 'Fold line' : 'Unfold line';
  marker.innerHTML = open
    ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="cm-fold-chevron"><polyline points="6 9 12 15 18 9"></polyline></svg>'
    : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="cm-fold-chevron"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  return marker;
}

export function createFoldGutter(): Extension {
  return foldGutter({
    markerDOM: (open) => createFoldMarkerDOM(open),
  });
}

/**
 * Creates configured lineNumbers extension with standard editor event handling:
 * - Left click selects the entire line.
 * - Shift+Left click extends the active selection range to the target line.
 */
export function createConfiguredLineNumbers(): Extension {
  return lineNumbers({
    domEventHandlers: {
      mousedown(view, line, event) {
        const mouseEvent = event as MouseEvent;
        if (mouseEvent.button !== 0) return false;
        const docLength = view.state.doc.length;
        const targetTo = Math.min(line.to + 1, docLength);
        if (mouseEvent.shiftKey) {
          const anchor = view.state.selection.main.anchor;
          view.dispatch({
            selection: EditorSelection.range(anchor, targetTo),
          });
        } else {
          view.dispatch({
            selection: EditorSelection.range(line.from, targetTo),
          });
        }
        return true;
      },
    },
  });
}

export const visualModeTheme = EditorView.theme({
  '.cm-gutters': {
    display: 'none !important',
  },
  '.cm-content': {
    paddingLeft: '24px',
    paddingRight: '24px',
  },
});

export function createVisualModeExtensions(): Extension[] {
  return [
    visualModeTheme,
    latexVisualHeadings(),
    latexVisualMath(),
    latexVisualCitations(),
  ];
}
