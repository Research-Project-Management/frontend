/**
 * codemirror-preset.ts
 *
 * Core CodeMirror 6 Extension Preset (Engines Layer).
 */

import { type Extension, type StateEffect, Compartment, EditorState, Facet, Prec } from '@codemirror/state';
import {
  EditorView,
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
  indentWithTab,
  emacsStyleKeymap,
} from '@codemirror/commands';
import {
  foldKeymap,
  bracketMatching,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { search, searchKeymap } from '@codemirror/search';
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
import { getThemeExtension } from './editor-themes';
import {
  editorBaseTheme,
  createTypographyExtension,
  createFoldMarkerDOM,
  createFoldGutter,
  createConfiguredLineNumbers,
  visualModeTheme,
  createVisualModeExtensions,
} from './codemirror-base-theme';
import {
  wrapFormatting,
  changeCase,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
  latexFormattingKeymap,
} from './latex-formatting.commands';

export {
  editorBaseTheme,
  createTypographyExtension,
  createFoldMarkerDOM,
  createFoldGutter,
  createConfiguredLineNumbers,
  visualModeTheme,
  createVisualModeExtensions,
  wrapFormatting,
  changeCase,
  handleAutoCloseEnvironment,
  handleAutoCloseMath,
  handleBackspaceBetweenMath,
  latexFormattingKeymap,
};

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
    editorBaseTheme,
    history(),
    EditorState.allowMultipleSelections.of(true),
    search({ top: false }),
    rectangularSelection(),
    crosshairCursor(),
    latexLanguage,
    lineHighlightField,
    synctexHighlightTheme,
    keymap.of([
      ...latexFormattingKeymap,
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...closeBracketsKeymap,
    ]),
    compartments.readOnly.of(EditorState.readOnly.of(readOnly)),
    compartments.keybinding.of(
      keybinding === 'vim' || (vimMode && keybinding !== 'emacs')
        ? vim()
        : keybinding === 'emacs'
          ? Prec.highest(keymap.of(emacsStyleKeymap))
          : [],
    ),
    compartments.lineNumbers.of(
      showLineNumbers ? [createFoldGutter(), createConfiguredLineNumbers(), highlightActiveLineGutter()] : [],
    ),
    compartments.lineWrapping.of(lineWrapping ? EditorView.lineWrapping : []),
    compartments.bracketMatching.of(
      enableBracketMatching
        ? enableAutoCloseBrackets
          ? [bracketMatching(), closeBrackets()]
          : [bracketMatching()]
        : [],
    ),
    compartments.highlightActiveLine.of(
      enableHighlightActive ? highlightActiveLine() : [],
    ),
    compartments.autocomplete.of(
      enableAutocomplete ? createLatexAutocompleteExtension() : [],
    ),
    compartments.linter.of(
      enableLinter ? createLatexLinterExtension() : [],
    ),
    compartments.mathPreview.of(
      enableMathPreview ? latexMathHoverTooltip : [],
    ),
    compartments.citationHover.of(
      enableCitationHover ? latexCitationHoverTooltip : [],
    ),
    compartments.inlineDiff.of(
      enableInlineDiff ? createInlineDiffExtension() : [],
    ),
    compartments.folding.of(
      enableFolding ? createLatexFoldExtension() : [],
    ),
    compartments.errorLens.of(
      enableErrorLens ? createLatexErrorLensExtension() : [],
    ),
    compartments.spellCheck.of(
      enableSpellCheck
        ? createLatexSpellingExtension({ projectId, language: spellCheckLanguage, enabled: true })
        : [],
    ),
    compartments.smartPaste.of(
      enableSmartPaste ? createLatexSmartPasteExtension({ projectId, enableSmartPaste: true }) : [],
    ),
    compartments.theme.of(getThemeExtension(editorTheme)),
    compartments.typography.of(createTypographyExtension(fontSize, fontFamily, lineHeight)),
    compartments.visualMode.of(
      enableVisualMode ? createVisualModeExtensions() : [],
    ),
  ];

  return extensions;
}

export function reconfigureVisualMode(
  view: EditorView,
  enabled: boolean,
  compartments: EditorCompartmentMap = getViewCompartments(view),
  showLineNumbers = true,
): void {
  view.dispatch({
    effects: [
      compartments.visualMode.reconfigure(
        enabled ? createVisualModeExtensions() : [],
      ),
      compartments.lineNumbers.reconfigure(
        !enabled && showLineNumbers
          ? [createFoldGutter(), createConfiguredLineNumbers(), highlightActiveLineGutter()]
          : [],
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
      createTypographyExtension(fontSize, fontFamily, lineHeight),
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
      enabled ? createLatexErrorLensExtension() : [],
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
  spaceId?: string;
  projectId?: string;
  smartPaste?: boolean;
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

export function computeCompartmentReconfigEffects(
  prev: EditorRuntimeConfig,
  next: EditorRuntimeConfig,
  compartments: EditorCompartmentMap = editorCompartments,
): StateEffect<unknown>[] {
  const effects: StateEffect<unknown>[] = [];

  if (prev.readOnly !== next.readOnly) {
    effects.push(
      compartments.readOnly.reconfigure(EditorState.readOnly.of(next.readOnly)),
    );
  }

  const prevEffectiveLineNumbers = !prev.visualMode && prev.lineNumbers;
  const nextEffectiveLineNumbers = !next.visualMode && next.lineNumbers;

  if (prev.visualMode !== next.visualMode) {
    effects.push(
      compartments.visualMode.reconfigure(
        next.visualMode ? createVisualModeExtensions() : [],
      ),
    );
  }

  if (prevEffectiveLineNumbers !== nextEffectiveLineNumbers) {
    effects.push(
      compartments.lineNumbers.reconfigure(
        nextEffectiveLineNumbers
          ? [createFoldGutter(), createConfiguredLineNumbers(), highlightActiveLineGutter()]
          : [],
      ),
    );
  }

  if (prev.lineWrapping !== next.lineWrapping) {
    effects.push(
      compartments.lineWrapping.reconfigure(
        next.lineWrapping ? EditorView.lineWrapping : [],
      ),
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
          : [],
      ),
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
        createTypographyExtension(next.fontSize, next.fontFamily, next.lineHeight),
      ),
    );
  }

  if (prev.errorLensEnabled !== next.errorLensEnabled) {
    effects.push(
      compartments.errorLens.reconfigure(
        next.errorLensEnabled ? createLatexErrorLensExtension() : [],
      ),
    );
  }

  if ((prev.autoCloseBrackets ?? true) !== (next.autoCloseBrackets ?? true)) {
    effects.push(
      compartments.bracketMatching.reconfigure(
        next.autoCloseBrackets ?? true ? [bracketMatching(), closeBrackets()] : [bracketMatching()],
      ),
    );
  }

  if ((prev.enableMathPreview ?? true) !== (next.enableMathPreview ?? true)) {
    effects.push(
      compartments.mathPreview.reconfigure(
        next.enableMathPreview ?? true ? latexMathHoverTooltip : [],
      ),
    );
  }

  if ((prev.enableAutocomplete ?? true) !== (next.enableAutocomplete ?? true)) {
    effects.push(
      compartments.autocomplete.reconfigure(
        next.enableAutocomplete ?? true ? createLatexAutocompleteExtension() : [],
      ),
    );
  }

  if ((prev.enableLinter ?? true) !== (next.enableLinter ?? true)) {
    effects.push(
      compartments.linter.reconfigure(
        next.enableLinter ?? true ? createLatexLinterExtension() : [],
      ),
    );
  }

  const prevSmartPaste = prev.smartPaste ?? true;
  const nextSmartPaste = next.smartPaste ?? true;
  if (
    prevSmartPaste !== nextSmartPaste ||
    prev.spaceId !== next.spaceId ||
    (next.smartPaste !== undefined && prev.projectId !== next.projectId)
  ) {
    effects.push(
      compartments.smartPaste.reconfigure(
        nextSmartPaste
          ? createLatexSmartPasteExtension({
              spaceId: next.spaceId,
              projectId: next.projectId,
              enableSmartPaste: true,
            })
          : [],
      ),
    );
  }

  return effects;
}

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
