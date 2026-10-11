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
  addCursorAbove,
  addCursorBelow,
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
import { latexLanguage, lineHighlightField, synctexHighlightTheme } from '../extensions/latex-language';
import { createLatexAutocompleteExtension } from '../extensions/latex-autocomplete';
import { createLatexSmartPasteExtension } from '../extensions/latex-smart-paste';
import { createLatexLinterExtension } from '../extensions/latex-linter';
import { latexMathHoverTooltip } from '../extensions/latex-math-preview';
import { latexCitationHoverTooltip } from '../extensions/latex-citation-hover';
import { createInlineDiffExtension } from '../extensions/inline-diff';
import { createLatexFoldExtension } from '../extensions/latex-folding';
import { createLatexErrorLensExtension } from '../extensions/latex-error-lens';
import { createLatexSpellingExtension } from '../extensions/latex-spelling';
import { editorCommandBus } from '../../coordinators/command-bus';
import { useDocumentCollaborationStore, useLayoutStore, useSettingsStore } from '../../store';
import { getThemeExtension } from './editor-themes';

export const editorBaseTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '0 0 32px 0',
  },
  '.cm-line': {
    padding: '3px 0',
  },
  '&.cm-editor .cm-activeLine, .cm-activeLine': {
    padding: '3px 0',
  },
  '.cm-gutters': {
    borderRight: '1px solid var(--border)',
    backgroundColor: 'transparent',
  },
});

export function createTypographyExtension(
  fontSize: number = 14,
  fontFamily?: string,
  lineHeight?: number
): Extension {
  const fontStack =
    fontFamily && fontFamily.trim().length > 0
      ? `"${fontFamily}", var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      : 'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  return EditorView.theme({
    '&': {
      fontSize: `${fontSize}px`,
    },
    '.cm-scroller': {
      fontFamily: fontStack,
    },
    '.cm-content, .cm-gutter': {
      fontSize: `${fontSize}px`,
      lineHeight: lineHeight ? `${lineHeight}` : '1.54',
    },
    '.cm-line': {
      lineHeight: lineHeight ? `${lineHeight}` : '1.54',
    },
  });
}

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
  enableSpellCheck?: boolean;
  enableSmartPaste?: boolean;
  projectId?: string;
  spellCheckLanguage?: string;
  editorTheme?: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
}

// Expose Vim for custom vimrc / user keybindings (Overleaf parity)
if (typeof window !== 'undefined') {
  (window as any).CodeMirrorVim = { Vim };
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
  spellCheck: new Compartment(),
  smartPaste: new Compartment(),
  theme: new Compartment(),
  typography: new Compartment(),
};

import {
  wrapFormatting,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
} from './latex-formatting.util';
export {
  wrapFormatting,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
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
    enableErrorLens = false,
    enableSpellCheck = true,
    enableSmartPaste = true,
    projectId,
    spellCheckLanguage = 'en_US',
    editorTheme = 'auto',
    fontSize = 14,
    fontFamily,
    lineHeight,
  } = options;

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
      // Priority 1: Overleaf Core LaTeX Shortcuts
      {
        key: 'Mod-Enter',
        run: () => {
          editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' });
          return true;
        },
      },
      {
        key: 'Mod-b',
        run: (view) => wrapFormatting(view, '\\textbf{', '}'),
      },
      {
        key: 'Mod-i',
        run: (view) => wrapFormatting(view, '\\textit{', '}'),
      },
      {
        key: 'Mod-u',
        run: (view) => wrapFormatting(view, '\\underline{', '}'),
      },
      {
        key: 'Enter',
        run: (view) => handleAutoCloseEnvironment(view),
      },
      {
        key: '$',
        run: (view) => handleAutoCloseMath(view),
      },
      {
        key: 'Backspace',
        run: (view) => handleBackspaceBetweenMath(view),
      },
      // Overleaf Table / Matrix Wizard Parity (Ctrl+Shift+T)
      {
        key: 'Mod-Shift-t',
        run: () => {
          editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' });
          return true;
        },
      },
      // Overleaf Source/Visual Mode Switcher Parity (Ctrl+Shift+V)
      {
        key: 'Mod-Shift-v',
        run: () => {
          useSettingsStore.getState().toggleEditorMode();
          return true;
        },
      },
      // Overleaf Word Count Parity (Ctrl+Shift+W)
      {
        key: 'Mod-Shift-w',
        run: () => {
          editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
          return true;
        },
      },
      {
        key: 'F8',
        run: () => {
          editorCommandBus.dispatch({ type: 'navigation:next-error' });
          return true;
        },
      },
      {
        key: 'Shift-F8',
        run: () => {
          editorCommandBus.dispatch({ type: 'navigation:prev-error' });
          return true;
        },
      },
      {
        key: 'Mod-Shift-f',
        run: (view) => {
          const { from, to } = view.state.selection.main;
          const selectedText = from < to ? view.state.sliceDoc(from, to) : undefined;
          useLayoutStore.getState().setSidebarLeftOpen(true);
          useLayoutStore.getState().setActiveSidebarTab('search');
          editorCommandBus.dispatch({
            type: 'sidebar:open-panel',
            panel: 'Search',
            query: selectedText,
          });
          return true;
        },
      },
      // Overleaf Parity: Mod-Shift-h (Ctrl+Shift+H / Cmd+Shift+H) to open Project Replace
      {
        key: 'Mod-Shift-h',
        run: (view) => {
          const { from, to } = view.state.selection.main;
          const selectedText = from < to ? view.state.sliceDoc(from, to) : undefined;
          useLayoutStore.getState().setSidebarLeftOpen(true);
          useLayoutStore.getState().setActiveSidebarTab('search');
          editorCommandBus.dispatch({
            type: 'sidebar:open-panel',
            panel: 'Search',
            query: selectedText,
            showReplace: true,
          });
          return true;
        },
      },
      // Overleaf Parity: Mod-Alt-m (Ctrl+Alt+M / Cmd+Opt+M) to Add Comment on selection or line
      {
        key: 'Mod-Alt-m',
        run: (view) => {
          const { from, to } = view.state.selection.main;
          const selectedText = view.state.sliceDoc(from, to);
          const startLine = view.state.doc.lineAt(from).number;
          const endLine = view.state.doc.lineAt(to).number;

          useDocumentCollaborationStore.getState().setPendingComment({
            startLine,
            endLine,
            selectedText: selectedText || '',
          });

          useLayoutStore.getState().setSidebarLeftOpen(true);
          useLayoutStore.getState().setActiveSidebarTab('review');
          editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
          return true;
        },
      },
      // Backward-compatible alias: Mod-Alt-c
      {
        key: 'Mod-Alt-c',
        run: (view) => {
          const { from, to } = view.state.selection.main;
          const selectedText = view.state.sliceDoc(from, to);
          const startLine = view.state.doc.lineAt(from).number;
          const endLine = view.state.doc.lineAt(to).number;

          useDocumentCollaborationStore.getState().setPendingComment({
            startLine,
            endLine,
            selectedText: selectedText || '',
          });

          useLayoutStore.getState().setSidebarLeftOpen(true);
          useLayoutStore.getState().setActiveSidebarTab('review');
          editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
          return true;
        },
      },
      { key: 'Mod-/', run: toggleComment },
      { key: 'Mod-Shift-l', run: gotoLine },
      { key: 'Mod-g', run: gotoLine },
      // Overleaf Code Folding Parity
      { key: 'Mod-Alt-[', run: foldCode },
      { key: 'Mod-Alt-]', run: unfoldCode },
      { key: 'Mod-Alt-Shift-[', run: foldAll },
      { key: 'Mod-Alt-Shift-]', run: unfoldAll },
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

      // Overleaf Multi-cursor Parity: Select Next Occurrence (Mod-d) and Add Cursor Above/Below
      {
        key: 'Mod-d',
        run: selectNextOccurrence,
        preventDefault: true,
      },
      {
        key: 'Alt-Shift-ArrowUp',
        run: addCursorAbove,
      },
      {
        key: 'Alt-Shift-ArrowDown',
        run: addCursorBelow,
      },
      {
        key: 'Ctrl-Alt-ArrowUp',
        run: addCursorAbove,
      },
      {
        key: 'Ctrl-Alt-ArrowDown',
        run: addCursorBelow,
      },

      // Priority 2: Standard Editor & Language Keymaps
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...closeBracketsKeymap,
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
  ];

  return extensions;
}

// ── Compartment Reconfiguration Helpers (0ms Runtime Mutations) ───────────────

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

export function reconfigureSpellCheck(
  view: EditorView,
  enabled: boolean,
  projectId?: string,
  language?: string,
): void {
  view.dispatch({
    effects: editorCompartments.spellCheck.reconfigure(
      enabled ? createLatexSpellingExtension({ projectId, language, enabled: true }) : []
    ),
  });
}

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

export function reconfigureSmartPaste(view: EditorView, enabled: boolean, projectId?: string): void {
  view.dispatch({
    effects: editorCompartments.smartPaste.reconfigure(
      enabled ? createLatexSmartPasteExtension({ projectId, enableSmartPaste: true }) : []
    ),
  });
}

