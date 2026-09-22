/**
 * latex-language.ts
 *
 * CodeMirror 6 LaTeX language configuration:
 * - Uses @codemirror/legacy-modes/mode/stex for fast, robust LaTeX tokenization.
 * - Line highlight StateField for SyncTeX jumps and compiler error markings.
 */

import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { StateField, RangeSet } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { highlightLineEffect } from '../../../adapters/codemirror/codemirror.adapter';

export const latexLanguage = StreamLanguage.define(stex);

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
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});
