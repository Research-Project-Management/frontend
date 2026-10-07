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

import { type Extension } from '@codemirror/state';
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
import { latexLanguage, lineHighlightField } from './latex-language';
import { createLatexAutocompleteExtension } from './latex-macros';
import { createLatexLinterExtension } from './latex-linter';
import { latexMathHoverTooltip } from './latex-math-preview';
import { createInlineDiffExtension } from './inline-diff';
import { createLatexFoldExtension } from './latex-folding';
import { createLatexErrorLensExtension } from './latex-error-lens';
import { editorCommandBus } from '../coordinators/command-bus';

export interface CodeMirrorPresetOptions {
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  readOnly?: boolean;
  bracketMatching?: boolean;
  highlightActiveLine?: boolean;
  vimMode?: boolean;
  enableMathPreview?: boolean;
  enableAutocomplete?: boolean;
  enableLinter?: boolean;
  enableInlineDiff?: boolean;
  enableFolding?: boolean;
  enableErrorLens?: boolean;
}

/**
 * Generates an immutable Extension[] array for CodeMirror 6 EditorState creation.
 */
export function createCodeMirrorPreset(options: CodeMirrorPresetOptions = {}): Extension[] {
  const {
    lineNumbers: showLineNumbers = true,
    lineWrapping = true,
    bracketMatching: enableBracketMatching = true,
    highlightActiveLine: enableHighlightActive = true,
    vimMode = false,
    enableMathPreview = true,
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
  ];

  // Optional extensions based on options
  if (vimMode) {
    extensions.unshift(vim());
  }

  if (enableAutocomplete) {
    extensions.push(createLatexAutocompleteExtension());
  }

  if (enableLinter) {
    extensions.push(createLatexLinterExtension());
  }

  if (enableMathPreview) {
    extensions.push(latexMathHoverTooltip);
  }

  if (enableInlineDiff) {
    extensions.push(...createInlineDiffExtension());
  }

  if (enableFolding) {
    extensions.push(createLatexFoldExtension());
  }

  if (enableErrorLens) {
    extensions.push(...createLatexErrorLensExtension());
  }

  if (showLineNumbers) {
    extensions.push(lineNumbers(), highlightActiveLineGutter(), foldGutter());
  }

  if (enableHighlightActive) {
    extensions.push(highlightActiveLine());
  }

  if (enableBracketMatching) {
    extensions.push(bracketMatching(), closeBrackets());
  }

  if (lineWrapping) {
    extensions.push(EditorView.lineWrapping);
  }

  return extensions;
}
