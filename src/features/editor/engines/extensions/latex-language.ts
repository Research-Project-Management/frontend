/**
 * latex-language.ts
 *
 * CodeMirror 6 LaTeX language configuration (Engines Layer).
 * Location: `features/editor/engines/extensions/latex-language.ts`
 *
 * Uses @codemirror/legacy-modes/mode/stex for fast, robust LaTeX tokenization.
 * Provides line highlight StateField & visual theme for SyncTeX jumps and compiler error markings.
 */

import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { StateField, RangeSet } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { highlightLineEffect, clearHighlightEffect } from '../adapters/codemirror/codemirror.adapter';

export const latexLanguage = StreamLanguage.define({
  ...stex,
  languageData: {
    commentTokens: { line: '%' },
  },
});

const synctexLineDecoration = Decoration.line({
  attributes: { class: 'cm-synctex-flash' },
});

const errorLineDecoration = Decoration.line({
  attributes: { class: 'cm-error-line' },
});

export const lineHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(highlightLineEffect)) {
        const { line, type } = effect.value;
        const totalLines = tr.state.doc.lines;
        if (line >= 1 && line <= totalLines) {
          const lineObj = tr.state.doc.line(line);
          const deco = type === 'synctex' ? synctexLineDecoration : errorLineDecoration;
          decorations = RangeSet.of([deco.range(lineObj.from)]);
        }
      } else if (effect.is(clearHighlightEffect)) {
        decorations = Decoration.none;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const synctexHighlightTheme = EditorView.baseTheme({
  '.cm-synctex-flash': {
    position: 'relative',
    animation: 'cm-synctex-pulse 2.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    borderRadius: '2px',
  },
  '.cm-error-line': {
    position: 'relative',
    animation: 'cm-error-pulse 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    borderRadius: '2px',
  },
});
