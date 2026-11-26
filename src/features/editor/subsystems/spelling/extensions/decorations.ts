/**
 * subsystems/spelling/extensions/decorations.ts
 *
 * Pure CodeMirror 6 spelling StateField (decorations + per-editor ignored words),
 * atomic StateEffects, range lookup, and underline theme.
 */

import {
  StateField,
  StateEffect,
  RangeSetBuilder,
  type Transaction,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
} from '@codemirror/view';

export interface SpellErrorRange {
  from: number;
  to: number;
  word: string;
  suggestions: string[];
}

interface SpellMarkSpec {
  class: string;
  word: string;
  suggestions: string[];
}

interface SpellingFieldState {
  decorations: DecorationSet;
  ignoredWords: ReadonlySet<string>;
}

export const setErrorsEffect = StateEffect.define<SpellErrorRange[]>();
export const ignoreWordEffect = StateEffect.define<string>();
export const unignoreWordEffect = StateEffect.define<string>();
export const clearErrorsEffect = StateEffect.define<void>();

const createErrorMark = (word: string, suggestions: string[]) =>
  Decoration.mark({
    class: 'cm-spell-error',
    word,
    suggestions,
  });

export const spellingStateField = StateField.define<SpellingFieldState>({
  create() {
    return {
      decorations: Decoration.none,
      ignoredWords: new Set<string>(),
    };
  },
  update(state, tr: Transaction): SpellingFieldState {
    let decorations = tr.isUserEvent('input.complete.spelling')
      ? state.decorations
          .update({ filter: (from, to) => !tr.changes.touchesRange(from, to) })
          .map(tr.changes)
      : state.decorations.map(tr.changes);
    let ignoredWords = state.ignoredWords;

    for (const effect of tr.effects) {
      if (effect.is(setErrorsEffect)) {
        const builder = new RangeSetBuilder<Decoration>();
        const items = effect.value;
        let isSorted = true;
        for (let i = 1; i < items.length; i++) {
          if (items[i].from < items[i - 1].from) {
            isSorted = false;
            break;
          }
        }
        const ordered = isSorted ? items : [...items].sort((a, b) => a.from - b.from);
        for (const item of ordered) {
          if (
            item.from < item.to &&
            item.to <= tr.newDoc.length &&
            !ignoredWords.has(item.word.toLowerCase())
          ) {
            builder.add(item.from, item.to, createErrorMark(item.word, item.suggestions));
          }
        }
        decorations = builder.finish();
      } else if (effect.is(ignoreWordEffect)) {
        const target = effect.value.toLowerCase();
        const nextIgnored = new Set(ignoredWords);
        nextIgnored.add(target);
        ignoredWords = nextIgnored;

        const builder = new RangeSetBuilder<Decoration>();
        const iter = decorations.iter();
        while (iter.value !== null) {
          const spec = iter.value.spec as Partial<SpellMarkSpec>;
          if (spec.word && spec.word.toLowerCase() !== target) {
            builder.add(iter.from, iter.to, iter.value);
          }
          iter.next();
        }
        decorations = builder.finish();
      } else if (effect.is(unignoreWordEffect)) {
        const target = effect.value.toLowerCase();
        if (ignoredWords.has(target)) {
          const nextIgnored = new Set(ignoredWords);
          nextIgnored.delete(target);
          ignoredWords = nextIgnored;
        }
      } else if (effect.is(clearErrorsEffect)) {
        decorations = Decoration.none;
      }
    }

    return { decorations, ignoredWords };
  },
  provide: (field) => EditorView.decorations.from(field, (s) => s.decorations),
});

export function findErrorAt(view: EditorView, pos: number): SpellErrorRange | null {
  const fieldState = view.state.field(spellingStateField, false);
  if (!fieldState) return null;

  let found: SpellErrorRange | null = null;
  fieldState.decorations.between(pos, pos, (from, to, value) => {
    const spec = value.spec as Partial<SpellMarkSpec>;
    if (spec.word && pos >= from && pos <= to) {
      found = {
        from,
        to,
        word: spec.word,
        suggestions: spec.suggestions ?? [],
      };
      return false;
    }
  });

  return found;
}

export const spellingTheme = EditorView.baseTheme({
  '.cm-spell-error': {
    textDecoration: 'underline wavy #ef4444',
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '2.5px',
    cursor: 'text',
  },
});
