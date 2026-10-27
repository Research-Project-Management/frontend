/**
 * codemirror-preset.ts
 *
 * Core CodeMirror 6 Extension Preset (Engines Layer).
 *
 * Provides a production-grade baseline configuration for LaTeX & academic writing:
 * - Line numbering & active line gutter highlighting.
 * - History (undo/redo) and bracket matching.
 * - LaTeX StreamLanguage grammar & tokenization.
 * - SyncTeX & Compiler error line highlighting StateField.
 * - Overleaf-compatible keymap presets.
 */

import { type Extension, type StateEffect, Compartment, EditorState, EditorSelection, Facet, Prec } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  rectangularSelection,
  crosshairCursor,
  keymap,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  toggleComment,
  addCursorAbove,
  addCursorBelow,
  indentWithTab,
  deleteLine,
  emacsStyleKeymap,
} from '@codemirror/commands';
import {
  foldGutter,
  foldKeymap,
  foldCode,
  unfoldCode,
  foldAll,
  unfoldAll,
  bracketMatching,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { search, searchKeymap, gotoLine, selectNextOccurrence } from '@codemirror/search';
import { vim, Vim } from '@replit/codemirror-vim';
import { latexLanguage, lineHighlightField, synctexHighlightTheme } from '@/features/editor/core/engine/extensions/latex-language';
import { createLatexAutocompleteExtension } from '@/features/editor/core/engine/extensions/latex-autocomplete';
import { createLatexSmartPasteExtension } from '@/features/editor/core/engine/extensions/latex-smart-paste';
import {
  createLatexLinterExtension,
  createLatexErrorLensExtension,
} from '@/features/editor/subsystems/diagnostics';
import { latexMathHoverTooltip } from '@/features/editor/core/engine/extensions/latex-math-preview';
import { latexCitationHoverTooltip } from '@/features/editor/subsystems/citation';
import { createInlineDiffExtension } from '@/features/editor/subsystems/review';
import { createLatexFoldExtension } from '@/features/editor/core/engine/extensions/latex-folding';
import { createLatexSpellingExtension } from '@/features/editor/core/engine/extensions/latex-spelling';
import { latexVisualHeadings } from '@/features/editor/core/engine/extensions/latex-visual-headings';
import { latexVisualMath } from '@/features/editor/core/engine/extensions/latex-visual-math';
import { latexVisualCitations } from '@/features/editor/core/engine/extensions/latex-visual-citations';
import { editorCommandBus } from '../../bus/command-bus';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { getThemeExtension } from './editor-themes';

export const editorBaseTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--editor-bg, var(--canvas, #FCFCFB))',
  },
  '.cm-scroller': {
    overflowX: 'auto',
    overflowY: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    padding: '0 0 32px 0',
    flexGrow: '1',
    flexShrink: '0',
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
    borderRight: 'none',
    backgroundColor: 'var(--editor-gutter, transparent)',
    color: 'var(--muted-foreground, #57606a)',
    fontFamily: 'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    userSelect: 'none',
    padding: '0 0 32px 0',
  },
  '.cm-gutterElement': {
    display: 'flex !important',
    alignItems: 'center',
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
    padding: '0',
    width: '14px',
    minWidth: '14px',
    cursor: 'pointer',
  },
  '.cm-gutter.cm-lineNumbers': {
    minWidth: '32px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    justifyContent: 'flex-end',
    padding: '0 4px 0 0',
    minWidth: '32px',
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
});

export function createTypographyExtension(
  fontSize: number = 13,
  fontFamily?: string,
  lineHeight?: number
): Extension {
  let customFont = fontFamily;
  if (fontFamily === 'opendyslexic') {
    customFont = 'OpenDyslexic, OpenDyslexicMono';
  } else if (fontFamily === 'fira') {
    customFont = 'Fira Code';
  } else if (fontFamily === 'jetbrains') {
    customFont = 'JetBrains Mono';
  } else if (fontFamily === 'source-code') {
    customFont = 'Source Code Pro';
  } else if (fontFamily === 'consolas') {
    customFont = 'Consolas';
  } else if (fontFamily === 'courier') {
    customFont = 'Courier New';
  } else if (fontFamily === 'inconsolata') {
    customFont = 'Inconsolata';
  }

  const fontStack =
    customFont && customFont.trim().length > 0 && customFont !== 'default'
      ? `${customFont.includes(',') ? customFont : `"${customFont}"`}, var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      : 'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  return EditorView.theme({
    '&': {
      fontSize: `${fontSize}px`,
    },
    '.cm-scroller': {
      fontFamily: fontStack,
    },
    '.cm-content, .cm-gutters, .cm-gutter, .cm-gutterElement': {
      fontSize: `${fontSize}px`,
      lineHeight: lineHeight ? `${lineHeight}` : '1.54',
      fontFamily: fontStack,
    },
    '.cm-line': {
      lineHeight: lineHeight ? `${lineHeight}` : '1.54',
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
    return {} as HTMLElement;
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

export function createModernFoldGutter(): Extension {
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

export interface CodeMirrorPresetOptions {
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  readOnly?: boolean;
  bracketMatching?: boolean;
  autoCloseBrackets?: boolean;
  highlightActiveLine?: boolean;
  vimMode?: boolean;
  keybinding?: 'standard' | 'vim' | 'emacs';
  enableMathPreview?: boolean;
  enableCitationHover?: boolean;
  enableAutocomplete?: boolean;
  enableLinter?: boolean;
  enableInlineDiff?: boolean;
  enableFolding?: boolean;
  enableErrorLens?: boolean;
  enableSpellCheck?: boolean;
  enableSmartPaste?: boolean;
  projectId?: string;
  spellCheckLanguage?: string;
  editorTheme?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  enableVisualMode?: boolean;
  compartments?: EditorCompartmentMap;
}

declare global {
  interface Window {
    CodeMirrorVim?: { Vim: typeof Vim };
  }
}

// Expose Vim for custom vimrc / user keybindings (Overleaf parity)
if (typeof window !== 'undefined') {
  window.CodeMirrorVim = { Vim };
}

/**
 * Isolated Compartments for 0ms Dynamic Reconfiguration.
 * Allows toggling editor features without unmounting EditorView or losing undo history.
 * Use `createEditorCompartments()` for per-instance compartments across split panes.
 */
export function createEditorCompartments() {
  return {
    readOnly: new Compartment(),
    lineNumbers: new Compartment(),
    lineWrapping: new Compartment(),
    keybinding: new Compartment(),
    bracketMatching: new Compartment(),
    highlightActiveLine: new Compartment(),
    autocomplete: new Compartment(),
    linter: new Compartment(),
    mathPreview: new Compartment(),
    citationHover: new Compartment(),
    inlineDiff: new Compartment(),
    folding: new Compartment(),
    errorLens: new Compartment(),
    spellCheck: new Compartment(),
    smartPaste: new Compartment(),
    theme: new Compartment(),
    typography: new Compartment(),
    visualMode: new Compartment(),
  };
}

export type EditorCompartmentMap = ReturnType<typeof createEditorCompartments>;

export const editorCompartments: EditorCompartmentMap = createEditorCompartments();

export const editorCompartmentsFacet = Facet.define<EditorCompartmentMap, EditorCompartmentMap>({
  combine: (values) => values[0] ?? editorCompartments,
});

export function getViewCompartments(view?: EditorView | null): EditorCompartmentMap {
  return view?.state.facet(editorCompartmentsFacet) ?? editorCompartments;
}

import {
  wrapFormatting,
  changeCase,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
  latexFormattingKeymap,
} from './latex-formatting.commands';
export {
  wrapFormatting,
  changeCase,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
  latexFormattingKeymap,
};

/**
 * Generates an immutable Extension[] array for CodeMirror 6 EditorState creation.
 */
export function createCodeMirrorPreset(options: CodeMirrorPresetOptions = {}): Extension[] {
  const {
    readOnly = false,
    lineNumbers: showLineNumbersOption = true,
    lineWrapping = true,
    bracketMatching: enableBracketMatching = true,
    autoCloseBrackets: enableAutoCloseBrackets = true,
    highlightActiveLine: enableHighlightActive = true,
    vimMode = false,
    keybinding = 'standard',
    enableMathPreview = true,
    enableCitationHover = true,
    enableAutocomplete = true,
    enableLinter = true,
    enableInlineDiff = true,
    enableFolding = true,
    enableErrorLens = true,
    enableSpellCheck = true,
    enableSmartPaste = true,
    projectId,
    spellCheckLanguage = 'en_US',
    editorTheme = 'auto',
    fontSize = 14,
    fontFamily,
    lineHeight,
    enableVisualMode = false,
    compartments = createEditorCompartments(),
  } = options;

  const showLineNumbers = !enableVisualMode && Boolean(showLineNumbersOption);

  const extensions: Extension[] = [
    editorCompartmentsFacet.of(compartments),
    // 0. Base Editor Layout & Typography Theme
    editorBaseTheme,

    // 1. Core Document Editing, Multi-Cursor & History
    history(),
    EditorState.allowMultipleSelections.of(true),
    search({ top: false }),
    rectangularSelection(),
    crosshairCursor(),

    // 2. Syntax & Language
    latexLanguage,
    lineHighlightField,
    synctexHighlightTheme,

    // 3. Keybindings (Overleaf 1:1 Parity)
    keymap.of([
      ...latexFormattingKeymap,
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...closeBracketsKeymap,
    ]),

    // 4. Dynamic Compartments (Zero-cost per-instance reconfiguration)
    compartments.readOnly.of(EditorState.readOnly.of(readOnly)),
    compartments.keybinding.of(
      keybinding === 'vim' || (vimMode && keybinding !== 'emacs')
        ? vim()
        : keybinding === 'emacs'
        ? Prec.highest(keymap.of(emacsStyleKeymap))
        : []
    ),
    compartments.lineNumbers.of(
      showLineNumbers ? [createModernFoldGutter(), createConfiguredLineNumbers(), highlightActiveLineGutter()] : []
    ),
    compartments.lineWrapping.of(lineWrapping ? EditorView.lineWrapping : []),
    compartments.bracketMatching.of(
      enableBracketMatching
        ? enableAutoCloseBrackets
          ? [bracketMatching(), closeBrackets()]
          : [bracketMatching()]
        : []
    ),
    compartments.highlightActiveLine.of(
      enableHighlightActive ? highlightActiveLine() : []
    ),
    compartments.autocomplete.of(
      enableAutocomplete ? createLatexAutocompleteExtension() : []
    ),
    compartments.linter.of(
      enableLinter ? createLatexLinterExtension() : []
    ),
    compartments.mathPreview.of(
      enableMathPreview ? latexMathHoverTooltip : []
    ),
    compartments.citationHover.of(
      enableCitationHover ? latexCitationHoverTooltip : []
    ),
    compartments.inlineDiff.of(
      enableInlineDiff ? createInlineDiffExtension() : []
    ),
    compartments.folding.of(
      enableFolding ? createLatexFoldExtension() : []
    ),
    compartments.errorLens.of(
      enableErrorLens ? createLatexErrorLensExtension() : []
    ),
    compartments.spellCheck.of(
      enableSpellCheck
        ? createLatexSpellingExtension({ projectId, language: spellCheckLanguage, enabled: true })
        : []
    ),
    compartments.smartPaste.of(
      enableSmartPaste ? createLatexSmartPasteExtension({ projectId, enableSmartPaste: true }) : []
    ),
    compartments.theme.of(getThemeExtension(editorTheme)),
    compartments.typography.of(createTypographyExtension(fontSize, fontFamily, lineHeight)),
    compartments.visualMode.of(
      enableVisualMode ? createVisualModeExtensions() : []
    ),
  ];

  return extensions;
}

// ── Compartment Reconfiguration Helpers (0ms Runtime Mutations) ───────────────

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

export function reconfigureVisualMode(
  view: EditorView,
  enabled: boolean,
  compartments: EditorCompartmentMap = getViewCompartments(view),
): void {
  view.dispatch({
    effects: [
      compartments.visualMode.reconfigure(
        enabled ? createVisualModeExtensions() : []
      ),
      compartments.lineNumbers.reconfigure(
        enabled ? [] : [createModernFoldGutter(), createConfiguredLineNumbers(), highlightActiveLineGutter()]
      ),
    ],
  });
}

export function reconfigureTheme(
  view: EditorView,
  themeId: string,
  compartments: EditorCompartmentMap = getViewCompartments(view),
): void {
  view.dispatch({
    effects: compartments.theme.reconfigure(getThemeExtension(themeId)),
  });
}

export function reconfigureTypography(
  view: EditorView,
  fontSize: number,
  fontFamily?: string,
  lineHeight?: number,
  compartments: EditorCompartmentMap = getViewCompartments(view),
): void {
  view.dispatch({
    effects: compartments.typography.reconfigure(
      createTypographyExtension(fontSize, fontFamily, lineHeight)
    ),
  });
}

export function reconfigureErrorLens(
  view: EditorView,
  enabled: boolean,
  compartments: EditorCompartmentMap = getViewCompartments(view),
): void {
  view.dispatch({
    effects: compartments.errorLens.reconfigure(
      enabled ? createLatexErrorLensExtension() : []
    ),
  });
}

export interface EditorRuntimeConfig {
  readOnly: boolean;
  lineNumbers: boolean;
  lineWrapping: boolean;
  keybinding: 'standard' | 'vim' | 'emacs';
  spellCheck: boolean;
  spellCheckLanguage?: string;
  projectId?: string;
  editorTheme: string;
  fontSize: number;
  fontFamily?: string;
  lineHeight?: number;
  visualMode: boolean;
  errorLensEnabled: boolean;
  autoCloseBrackets?: boolean;
  enableMathPreview?: boolean;
  enableAutocomplete?: boolean;
  enableLinter?: boolean;
}

/**
 * Pure differential calculator for CodeMirror 6 Compartment reconfigurations (Deep Module).
 * Compares previous and next runtime configurations and returns only the StateEffects
 * required for compartments that actually changed.
 * Resolves cross-compartment interactions (e.g., visualMode suppressing lineNumbers)
 * without clobbering user preferences when exiting visualMode.
 */
export function computeCompartmentReconfigEffects(
  prev: EditorRuntimeConfig,
  next: EditorRuntimeConfig,
  compartments: EditorCompartmentMap = editorCompartments,
): StateEffect<unknown>[] {
  const effects: StateEffect<unknown>[] = [];

  if (prev.readOnly !== next.readOnly) {
    effects.push(
      compartments.readOnly.reconfigure(EditorState.readOnly.of(next.readOnly))
    );
  }

  const prevEffectiveLineNumbers = !prev.visualMode && prev.lineNumbers;
  const nextEffectiveLineNumbers = !next.visualMode && next.lineNumbers;

  if (prev.visualMode !== next.visualMode) {
    effects.push(
      compartments.visualMode.reconfigure(
        next.visualMode ? createVisualModeExtensions() : []
      )
    );
  }

  if (prevEffectiveLineNumbers !== nextEffectiveLineNumbers) {
    effects.push(
      compartments.lineNumbers.reconfigure(
        nextEffectiveLineNumbers ? [createModernFoldGutter(), createConfiguredLineNumbers(), highlightActiveLineGutter()] : []
      )
    );
  }

  if (prev.lineWrapping !== next.lineWrapping) {
    effects.push(
      compartments.lineWrapping.reconfigure(
        next.lineWrapping ? EditorView.lineWrapping : []
      )
    );
  }

  if (prev.keybinding !== next.keybinding) {
    const ext =
      next.keybinding === 'vim'
        ? vim()
        : next.keybinding === 'emacs'
          ? Prec.highest(keymap.of(emacsStyleKeymap))
          : [];
    effects.push(compartments.keybinding.reconfigure(ext));
  }

  if (
    prev.spellCheck !== next.spellCheck ||
    prev.spellCheckLanguage !== next.spellCheckLanguage ||
    prev.projectId !== next.projectId
  ) {
    effects.push(
      compartments.spellCheck.reconfigure(
        next.spellCheck
          ? createLatexSpellingExtension({
              projectId: next.projectId,
              language: next.spellCheckLanguage,
              enabled: true,
            })
          : []
      )
    );
  }

  if (prev.editorTheme !== next.editorTheme) {
    effects.push(compartments.theme.reconfigure(getThemeExtension(next.editorTheme)));
  }

  if (
    prev.fontSize !== next.fontSize ||
    prev.fontFamily !== next.fontFamily ||
    prev.lineHeight !== next.lineHeight
  ) {
    effects.push(
      compartments.typography.reconfigure(
        createTypographyExtension(next.fontSize, next.fontFamily, next.lineHeight)
      )
    );
  }

  if (prev.errorLensEnabled !== next.errorLensEnabled) {
    effects.push(
      compartments.errorLens.reconfigure(
        next.errorLensEnabled ? createLatexErrorLensExtension() : []
      )
    );
  }

  if ((prev.autoCloseBrackets ?? true) !== (next.autoCloseBrackets ?? true)) {
    effects.push(
      compartments.bracketMatching.reconfigure(
        next.autoCloseBrackets ?? true ? [bracketMatching(), closeBrackets()] : [bracketMatching()]
      )
    );
  }

  if ((prev.enableMathPreview ?? true) !== (next.enableMathPreview ?? true)) {
    effects.push(
      compartments.mathPreview.reconfigure(
        next.enableMathPreview ?? true ? latexMathHoverTooltip : []
      )
    );
  }

  if ((prev.enableAutocomplete ?? true) !== (next.enableAutocomplete ?? true)) {
    effects.push(
      compartments.autocomplete.reconfigure(
        next.enableAutocomplete ?? true ? createLatexAutocompleteExtension() : []
      )
    );
  }

  if ((prev.enableLinter ?? true) !== (next.enableLinter ?? true)) {
    effects.push(
      compartments.linter.reconfigure(
        next.enableLinter ?? true ? createLatexLinterExtension() : []
      )
    );
  }

  return effects;
}

/**
 * Atomic Batched Compartment Reconfiguration Seam (Deep Module).
 * Computes differential compartment effects between `prev` and `next` using the
 * EditorView's per-instance compartments, merges any `additionalEffects`, and dispatches
 * at most ONE CodeMirror transaction.
 * Returns the total number of StateEffects dispatched (0 if no changes).
 */
export function reconfigureEditorCompartments(
  view: EditorView,
  prev: EditorRuntimeConfig,
  next: EditorRuntimeConfig,
  additionalEffects: StateEffect<unknown>[] = [],
  compartments: EditorCompartmentMap = getViewCompartments(view),
): number {
  const effects = [
    ...computeCompartmentReconfigEffects(prev, next, compartments),
    ...additionalEffects,
  ];
  if (effects.length === 0) {
    return 0;
  }
  view.dispatch({ effects });
  return effects.length;
}



