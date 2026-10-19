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

import { type Extension, type StateEffect, Compartment, EditorState, EditorSelection, Prec } from '@codemirror/state';
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
import { editorCommandBus } from '@/features/editor/core';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { getThemeExtension } from './editor-themes';

export const editorBaseTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '8px 0 32px 0',
  },
  '.cm-line': {
    padding: '0 12px',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    padding: '0 12px',
  },
  '.cm-gutters': {
    borderRight: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground, #57606a)',
    fontFamily: 'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    padding: '8px 0 0 0',
  },
  '.cm-gutterElement': {
    padding: '0 6px 0 10px',
    color: 'var(--muted-foreground, #57606a)',
    fontFamily: 'inherit',
  },
  '.cm-gutterElement.cm-foldGutter': {
    padding: '0 6px 0 2px',
    cursor: 'pointer',
  },
  '.cm-foldGutter span': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '12px',
    height: '100%',
    lineHeight: '1',
    userSelect: 'none',
    opacity: '0.6',
    transition: 'opacity 0.15s ease',
  },
  '.cm-foldGutter span:hover': {
    opacity: '1',
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
  fontSize: number = 14,
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
 */
export const editorCompartments = {
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
  } = options;

  const showLineNumbers = !enableVisualMode && Boolean(showLineNumbersOption);

  const extensions: Extension[] = [
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

    // 4. Dynamic Compartments (Zero-cost reconfiguration)
    editorCompartments.readOnly.of(EditorState.readOnly.of(readOnly)),
    editorCompartments.keybinding.of(
      keybinding === 'vim' || (vimMode && keybinding !== 'emacs')
        ? vim()
        : keybinding === 'emacs'
        ? Prec.highest(keymap.of(emacsStyleKeymap))
        : []
    ),
    editorCompartments.lineNumbers.of(
      showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []
    ),
    editorCompartments.lineWrapping.of(lineWrapping ? EditorView.lineWrapping : []),
    editorCompartments.bracketMatching.of(
      enableBracketMatching
        ? enableAutoCloseBrackets
          ? [bracketMatching(), closeBrackets()]
          : [bracketMatching()]
        : []
    ),
    editorCompartments.highlightActiveLine.of(
      enableHighlightActive ? highlightActiveLine() : []
    ),
    editorCompartments.autocomplete.of(
      enableAutocomplete ? createLatexAutocompleteExtension() : []
    ),
    editorCompartments.linter.of(
      enableLinter ? createLatexLinterExtension() : []
    ),
    editorCompartments.mathPreview.of(
      enableMathPreview ? latexMathHoverTooltip : []
    ),
    editorCompartments.citationHover.of(
      enableCitationHover ? latexCitationHoverTooltip : []
    ),
    editorCompartments.inlineDiff.of(
      enableInlineDiff ? createInlineDiffExtension() : []
    ),
    editorCompartments.folding.of(
      enableFolding ? createLatexFoldExtension() : []
    ),
    editorCompartments.errorLens.of(
      enableErrorLens ? createLatexErrorLensExtension() : []
    ),
    editorCompartments.spellCheck.of(
      enableSpellCheck
        ? createLatexSpellingExtension({ projectId, language: spellCheckLanguage, enabled: true })
        : []
    ),
    editorCompartments.smartPaste.of(
      enableSmartPaste ? createLatexSmartPasteExtension({ projectId, enableSmartPaste: true }) : []
    ),
    editorCompartments.theme.of(getThemeExtension(editorTheme)),
    editorCompartments.typography.of(createTypographyExtension(fontSize, fontFamily, lineHeight)),
    editorCompartments.visualMode.of(
      enableVisualMode ? createVisualModeExtensions() : []
    ),
  ];

  return extensions;
}

// ── Compartment Reconfiguration Helpers (0ms Runtime Mutations) ───────────────

export function createVisualModeExtensions(): Extension[] {
  return [
    latexVisualHeadings(),
    latexVisualMath(),
    latexVisualCitations(),
  ];
}

export function reconfigureVisualMode(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: [
      editorCompartments.visualMode.reconfigure(
        enabled ? createVisualModeExtensions() : []
      ),
      editorCompartments.lineNumbers.reconfigure(
        enabled ? [] : [lineNumbers(), highlightActiveLineGutter(), foldGutter()]
      ),
    ],
  });
}

export function reconfigureTheme(view: EditorView, themeId: string): void {
  view.dispatch({
    effects: editorCompartments.theme.reconfigure(getThemeExtension(themeId)),
  });
}

export function reconfigureTypography(
  view: EditorView,
  fontSize: number,
  fontFamily?: string,
  lineHeight?: number
): void {
  view.dispatch({
    effects: editorCompartments.typography.reconfigure(
      createTypographyExtension(fontSize, fontFamily, lineHeight)
    ),
  });
}

export function reconfigureErrorLens(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: editorCompartments.errorLens.reconfigure(
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
  next: EditorRuntimeConfig
): StateEffect<unknown>[] {
  const effects: StateEffect<unknown>[] = [];

  if (prev.readOnly !== next.readOnly) {
    effects.push(
      editorCompartments.readOnly.reconfigure(EditorState.readOnly.of(next.readOnly))
    );
  }

  const prevEffectiveLineNumbers = !prev.visualMode && prev.lineNumbers;
  const nextEffectiveLineNumbers = !next.visualMode && next.lineNumbers;

  if (prev.visualMode !== next.visualMode) {
    effects.push(
      editorCompartments.visualMode.reconfigure(
        next.visualMode ? createVisualModeExtensions() : []
      )
    );
  }

  if (prevEffectiveLineNumbers !== nextEffectiveLineNumbers) {
    effects.push(
      editorCompartments.lineNumbers.reconfigure(
        nextEffectiveLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []
      )
    );
  }

  if (prev.lineWrapping !== next.lineWrapping) {
    effects.push(
      editorCompartments.lineWrapping.reconfigure(
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
    effects.push(editorCompartments.keybinding.reconfigure(ext));
  }

  if (
    prev.spellCheck !== next.spellCheck ||
    prev.spellCheckLanguage !== next.spellCheckLanguage ||
    prev.projectId !== next.projectId
  ) {
    effects.push(
      editorCompartments.spellCheck.reconfigure(
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
    effects.push(editorCompartments.theme.reconfigure(getThemeExtension(next.editorTheme)));
  }

  if (
    prev.fontSize !== next.fontSize ||
    prev.fontFamily !== next.fontFamily ||
    prev.lineHeight !== next.lineHeight
  ) {
    effects.push(
      editorCompartments.typography.reconfigure(
        createTypographyExtension(next.fontSize, next.fontFamily, next.lineHeight)
      )
    );
  }

  if (prev.errorLensEnabled !== next.errorLensEnabled) {
    effects.push(
      editorCompartments.errorLens.reconfigure(
        next.errorLensEnabled ? createLatexErrorLensExtension() : []
      )
    );
  }

  if ((prev.autoCloseBrackets ?? true) !== (next.autoCloseBrackets ?? true)) {
    effects.push(
      editorCompartments.bracketMatching.reconfigure(
        next.autoCloseBrackets ?? true ? [bracketMatching(), closeBrackets()] : [bracketMatching()]
      )
    );
  }

  if ((prev.enableMathPreview ?? true) !== (next.enableMathPreview ?? true)) {
    effects.push(
      editorCompartments.mathPreview.reconfigure(
        next.enableMathPreview ?? true ? latexMathHoverTooltip : []
      )
    );
  }

  if ((prev.enableAutocomplete ?? true) !== (next.enableAutocomplete ?? true)) {
    effects.push(
      editorCompartments.autocomplete.reconfigure(
        next.enableAutocomplete ?? true ? createLatexAutocompleteExtension() : []
      )
    );
  }

  if ((prev.enableLinter ?? true) !== (next.enableLinter ?? true)) {
    effects.push(
      editorCompartments.linter.reconfigure(
        next.enableLinter ?? true ? createLatexLinterExtension() : []
      )
    );
  }

  return effects;
}

/**
 * Atomic Batched Compartment Reconfiguration Seam (Deep Module).
 * Computes differential compartment effects between `prev` and `next`, merges any
 * `additionalEffects`, and dispatches at most ONE CodeMirror transaction.
 * Returns the total number of StateEffects dispatched (0 if no changes).
 */
export function reconfigureEditorCompartments(
  view: EditorView,
  prev: EditorRuntimeConfig,
  next: EditorRuntimeConfig,
  additionalEffects: StateEffect<unknown>[] = []
): number {
  const effects = [
    ...computeCompartmentReconfigEffects(prev, next),
    ...additionalEffects,
  ];
  if (effects.length === 0) {
    return 0;
  }
  view.dispatch({ effects });
  return effects.length;
}



