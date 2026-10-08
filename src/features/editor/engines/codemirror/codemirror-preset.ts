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

import { type Extension, Compartment, EditorState } from '@codemirror/state';
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
} from '@codemirror/commands';
import { foldGutter, foldKeymap, bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { search, searchKeymap, gotoLine } from '@codemirror/search';
import { vim } from '@replit/codemirror-vim';
import { latexLanguage, lineHighlightField, synctexHighlightTheme } from '../extensions/latex-language';
import { createLatexAutocompleteExtension } from '../extensions/latex-autocomplete';
import { createLatexLinterExtension } from '../extensions/latex-linter';
import { latexMathHoverTooltip } from '../extensions/latex-math-preview';
import { latexCitationHoverTooltip } from '../extensions/latex-citation-hover';
import { createInlineDiffExtension } from '../extensions/inline-diff';
import { createLatexFoldExtension } from '../extensions/latex-folding';
import { createLatexErrorLensExtension } from '../extensions/latex-error-lens';
import { editorCommandBus } from '../../coordinators/command-bus';

export interface CodeMirrorPresetOptions {
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  readOnly?: boolean;
  bracketMatching?: boolean;
  highlightActiveLine?: boolean;
  vimMode?: boolean;
  enableMathPreview?: boolean;
  enableCitationHover?: boolean;
  enableAutocomplete?: boolean;
  enableLinter?: boolean;
  enableInlineDiff?: boolean;
  enableFolding?: boolean;
  enableErrorLens?: boolean;
}

/**
 * Isolated Compartments for 0ms Dynamic Reconfiguration.
 * Allows toggling editor features without unmounting EditorView or losing undo history.
 */
export const editorCompartments = {
  readOnly: new Compartment(),
  lineNumbers: new Compartment(),
  lineWrapping: new Compartment(),
  vimMode: new Compartment(),
  bracketMatching: new Compartment(),
  highlightActiveLine: new Compartment(),
  autocomplete: new Compartment(),
  linter: new Compartment(),
  mathPreview: new Compartment(),
  citationHover: new Compartment(),
  inlineDiff: new Compartment(),
  folding: new Compartment(),
  errorLens: new Compartment(),
};

/**
 * Generates an immutable Extension[] array for CodeMirror 6 EditorState creation.
 */
export function createCodeMirrorPreset(options: CodeMirrorPresetOptions = {}): Extension[] {
  const {
    readOnly = false,
    lineNumbers: showLineNumbers = true,
    lineWrapping = true,
    bracketMatching: enableBracketMatching = true,
    highlightActiveLine: enableHighlightActive = true,
    vimMode = false,
    enableMathPreview = true,
    enableCitationHover = true,
    enableAutocomplete = true,
    enableLinter = true,
    enableInlineDiff = true,
    enableFolding = true,
    enableErrorLens = true,
  } = options;

  const extensions: Extension[] = [
    // 1. Core Document Editing & History
    history(),
    search({ top: false }),
    rectangularSelection(),
    crosshairCursor(),

    // 2. Syntax & Language
    latexLanguage,
    lineHighlightField,
    synctexHighlightTheme,

    // 3. Keybindings (Overleaf 1:1 Parity)
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...closeBracketsKeymap,
      { key: 'Mod-/', run: toggleComment },
      { key: 'Mod-Shift-l', run: gotoLine },
      { key: 'Mod-g', run: gotoLine },
      {
        key: 'Mod-Shift-k',
        run: () => {
          editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
          return true;
        },
      },
      {
        key: 'Mod-Alt-j',
        run: (view) => {
          const pos = view.state.selection.main.from;
          const lineObj = view.state.doc.lineAt(pos);
          editorCommandBus.dispatch({
            type: 'synctex:forward',
            line: lineObj.number,
            column: pos - lineObj.from,
          });
          return true;
        },
      },
      {
        key: 'Ctrl-Alt-j',
        run: (view) => {
          const pos = view.state.selection.main.from;
          const lineObj = view.state.doc.lineAt(pos);
          editorCommandBus.dispatch({
            type: 'synctex:forward',
            line: lineObj.number,
            column: pos - lineObj.from,
          });
          return true;
        },
      },
    ]),

    // 4. Dynamic Compartments (Zero-cost reconfiguration)
    editorCompartments.readOnly.of(EditorState.readOnly.of(readOnly)),
    editorCompartments.vimMode.of(vimMode ? vim() : []),
    editorCompartments.lineNumbers.of(
      showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []
    ),
    editorCompartments.lineWrapping.of(lineWrapping ? EditorView.lineWrapping : []),
    editorCompartments.bracketMatching.of(
      enableBracketMatching ? [bracketMatching(), closeBrackets()] : []
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
  ];

  return extensions;
}

// ── Compartment Reconfiguration Helpers (0ms Runtime Mutations) ───────────────

export function reconfigureCitationHover(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: editorCompartments.citationHover.reconfigure(
      enabled ? latexCitationHoverTooltip : []
    ),
  });
}

export function reconfigureLineNumbers(view: EditorView, show: boolean): void {
  view.dispatch({
    effects: editorCompartments.lineNumbers.reconfigure(
      show ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : []
    ),
  });
}

export function reconfigureLineWrapping(view: EditorView, wrap: boolean): void {
  view.dispatch({
    effects: editorCompartments.lineWrapping.reconfigure(
      wrap ? EditorView.lineWrapping : []
    ),
  });
}

export function reconfigureVimMode(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: editorCompartments.vimMode.reconfigure(enabled ? vim() : []),
  });
}

export function reconfigureReadOnly(view: EditorView, readOnly: boolean): void {
  view.dispatch({
    effects: editorCompartments.readOnly.reconfigure(EditorState.readOnly.of(readOnly)),
  });
}
