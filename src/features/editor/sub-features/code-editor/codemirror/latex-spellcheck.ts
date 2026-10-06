/**
 * latex-spellcheck.ts
 *
 * CodeMirror 6 Spell Check Extension (Overleaf 1:1 Parity):
 * - Underlines misspelled words with red squiggly line (.cm-spell-error).
 * - ZERO intrusive hover tooltips or diagnostics popping up on hover/focus.
 * - Stores misspelled items in a StateField for instant Context Menu lookup.
 * - Right-click / context menu triggers suggestions & dictionary additions.
 * - Instant cache update removes squiggly lines immediately upon adding to dictionary.
 */

import {
  EditorState,
  StateField,
  StateEffect,
  RangeSetBuilder,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  type PluginValue,
} from '@codemirror/view';
import { spellingService } from '@/features/editor/services/spelling.service';

export interface MisspelledItem {
  from: number;
  to: number;
  word: string;
  suggestions: string[];
}

// State effects for managing misspelled words & live dictionary additions
export const setMisspelledWordsEffect = StateEffect.define<MisspelledItem[]>();
export const removeLearnedWordEffect = StateEffect.define<string>();

// Mark decoration for misspelled words (wavy red underline)
const spellErrorMark = Decoration.mark({
  class: 'cm-spell-error',
  attributes: { 'data-spell-error': 'true' },
});

function buildSpellDecorations(items: MisspelledItem[]): DecorationSet {
  if (!items || items.length === 0) return Decoration.none;
  const sorted = [...items].sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  let lastTo = -1;

  for (const item of sorted) {
    if (item.from >= item.to) continue;
    if (item.from < lastTo) continue; // Prevent overlapping ranges
    builder.add(item.from, item.to, spellErrorMark);
    lastTo = item.to;
  }

  return builder.finish();
}

export const misspelledWordsField = StateField.define<{
  items: MisspelledItem[];
  decorations: DecorationSet;
}>({
  create() {
    return { items: [], decorations: Decoration.none };
  },
  update(value, tr) {
    let items = value.items
      .map((it) => ({
        ...it,
        from: tr.changes.mapPos(it.from),
        to: tr.changes.mapPos(it.to),
      }))
      .filter((it) => it.from < it.to);

    let decos = value.decorations.map(tr.changes);
    let needsRebuild = false;

    for (const effect of tr.effects) {
      if (effect.is(setMisspelledWordsEffect)) {
        items = effect.value;
        needsRebuild = true;
      } else if (effect.is(removeLearnedWordEffect)) {
        const target = effect.value.toLowerCase().trim();
        items = items.filter((it) => it.word.toLowerCase() !== target);
        needsRebuild = true;
      }
    }

    if (needsRebuild) {
      decos = buildSpellDecorations(items);
    }

    return { items, decorations: decos };
  },
  provide: (field) => EditorView.decorations.from(field, (val) => val.decorations),
});

/**
 * Returns misspelled word information at a specific document character offset.
 */
export function getMisspelledWordAtPos(
  state: EditorState,
  pos: number,
): MisspelledItem | null {
  const data = state.field(misspelledWordsField, false);
  if (!data || !data.items || data.items.length === 0) return null;
  for (const item of data.items) {
    if (pos >= item.from && pos <= item.to) {
      return item;
    }
  }
  return null;
}

// In-memory set of learned words in current session
const sessionLearnedWords = new Set<string>();
const activeSpellViews = new Set<EditorView>();

export function addSessionLearnedWord(word: string) {
  const clean = word.trim().toLowerCase();
  if (!clean) return;
  sessionLearnedWords.add(clean);
  for (const view of activeSpellViews) {
    try {
      view.dispatch({
        effects: removeLearnedWordEffect.of(clean),
      });
    } catch {
      // Ignore unmounted view
    }
  }
}

class SpellCheckPluginValue implements PluginValue {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private view: EditorView,
    private projectId?: string,
    private getLanguage: () => string = () => 'en_US',
  ) {
    activeSpellViews.add(this.view);
    this.scheduleCheck(400);
  }

  update(update: ViewUpdate) {
    if (update.docChanged) {
      this.scheduleCheck(1000);
    }
  }

  destroy() {
    activeSpellViews.delete(this.view);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleCheck(delayMs: number) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.performCheck();
    }, delayMs);
  }

  private async performCheck() {
    if (!this.projectId) return;
    const doc = this.view.state.doc;
    const text = doc.toString();
    if (!text || text.trim().length === 0) {
      this.view.dispatch({
        effects: setMisspelledWordsEffect.of([]),
      });
      return;
    }

    const language = this.getLanguage() || 'en_US';

    try {
      const report = await spellingService.checkSpelling(this.projectId, {
        text,
        language,
      });

      if (!report || !Array.isArray(report.errors)) {
        return;
      }

      const items: MisspelledItem[] = [];
      for (const err of report.errors) {
        const wordLower = err.word.toLowerCase();
        if (sessionLearnedWords.has(wordLower)) {
          continue;
        }

        const lineNum = Math.min(Math.max(1, err.line), doc.lines);
        const lineObj = doc.line(lineNum);
        const from = Math.min(lineObj.from + Math.max(0, err.col - 1), lineObj.to);
        const to = Math.min(from + (err.length || err.word.length), lineObj.to);

        if (from >= to) continue;

        items.push({
          from,
          to,
          word: err.word,
          suggestions: Array.isArray(err.suggestions) ? err.suggestions : [],
        });
      }

      this.view.dispatch({
        effects: setMisspelledWordsEffect.of(items),
      });
    } catch {
      // Graceful fallback if backend is offline
    }
  }
}

/**
 * Creates CodeMirror spellcheck extension without intrusive hover tooltips.
 */
export function createLatexSpellcheckExtension(
  projectId?: string,
  getLanguage: () => string = () => 'en_US',
): Extension[] {
  return [
    misspelledWordsField,
    ViewPlugin.define(
      (view) => new SpellCheckPluginValue(view, projectId, getLanguage),
    ),
  ];
}
