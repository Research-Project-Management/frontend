/**
 * diagnostics-gutter.ts
 *
 * CodeMirror 6 Push-Based Compiler Diagnostics Bridge & Gutter Integration.
 * Decouples server/compiler diagnostics from @codemirror/lint Pull scheduling so
 * compile errors update via explicit StateEffect transactions, highlight exact
 * command tokens, remap smoothly via ChangeSet, and render stale indicators on edit.
 */

import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
  type Text,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  type DecorationSet,
} from '@codemirror/view';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import type { EditorDiagnosticItem } from '@/features/editor/domain/types/diagnostics.types';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';

export interface DiagnosticsGutterOptions {
  filePath?: string;
  enabled?: boolean;
  getDiagnostics?: (filePath: string) => EditorDiagnosticItem[];
}

interface CompilerDiagnosticRange {
  from: number;
  to: number;
  item: EditorDiagnosticItem;
}

export interface CompilerDiagnosticsState {
  decorations: DecorationSet;
  items: CompilerDiagnosticRange[];
}

export const setCompilerDiagnosticsEffect = StateEffect.define<EditorDiagnosticItem[]>();
export const clearCompilerDiagnosticsEffect = StateEffect.define<void>();

const LOCAL_LINTER_SOURCES = new Set([
  'LaTeX Linter',
  'Retraction Watch Guard',
  'linter',
]);

function isCompilerDiagnosticItem(item: EditorDiagnosticItem): boolean {
  return !item.source || !LOCAL_LINTER_SOURCES.has(item.source);
}

function severityRank(severity: EditorDiagnosticItem['severity']): number {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function resolveDiagnosticSpan(
  doc: Text,
  item: EditorDiagnosticItem
): { from: number; to: number } {
  const lineNum = Math.max(1, Math.min(item.line || 1, doc.lines));
  const line = doc.line(lineNum);

  if (line.length === 0) {
    return { from: line.from, to: line.from };
  }

  if (item.highlightCommand) {
    const idx = line.text.indexOf(item.highlightCommand);
    if (idx >= 0) {
      const from = line.from + idx;
      const to = Math.min(line.to, from + item.highlightCommand.length);
      if (to > from) {
        return { from, to };
      }
    }
  }

  if (item.column && item.column > 0) {
    const clampedOffset = Math.min(item.column - 1, Math.max(0, line.length - 1));
    const from = line.from + clampedOffset;
    const to = Math.min(line.to, Math.max(from + 1, from + 8));
    if (to > from) {
      return { from, to };
    }
  }

  const leadingWhitespace = line.text.search(/\S/);
  const from =
    leadingWhitespace >= 0
      ? Math.min(line.from + leadingWhitespace, Math.max(line.from, line.to - 1))
      : line.from;
  const to = Math.min(line.to, Math.max(from + 1, from + 60));
  return { from, to };
}

function buildDecorationsFromRanges(ranges: CompilerDiagnosticRange[]): DecorationSet {
  if (ranges.length === 0) {
    return Decoration.none;
  }

  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();

  for (const entry of sorted) {
    if (entry.to <= entry.from) {
      continue;
    }
    const severityClass =
      entry.item.severity === 'error'
        ? 'cm-compiler-diag-error'
        : entry.item.severity === 'warning'
          ? 'cm-compiler-diag-warning'
          : 'cm-compiler-diag-info';
    const staleClass = entry.item.stale ? ' cm-compiler-diag-stale' : '';
    const attrs: Record<string, string> = {
      class: `${severityClass}${staleClass}`,
    };
    if (entry.item.stale) {
      attrs.title = 'Line modified — recompile to verify';
    }
    builder.add(entry.from, entry.to, Decoration.mark({ attributes: attrs }));
  }

  return builder.finish();
}

function buildCompilerDiagnosticsState(
  doc: Text,
  rawItems: EditorDiagnosticItem[]
): CompilerDiagnosticsState {
  const compilerItems = rawItems.filter(isCompilerDiagnosticItem);
  if (compilerItems.length === 0) {
    return { decorations: Decoration.none, items: [] };
  }

  const items: CompilerDiagnosticRange[] = compilerItems.map((item) => {
    const { from, to } = resolveDiagnosticSpan(doc, item);
    return { from, to, item };
  });

  return {
    decorations: buildDecorationsFromRanges(items),
    items,
  };
}

export const compilerDiagnosticsField = StateField.define<CompilerDiagnosticsState>({
  create() {
    return { decorations: Decoration.none, items: [] };
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(clearCompilerDiagnosticsEffect)) {
        return { decorations: Decoration.none, items: [] };
      }
      if (effect.is(setCompilerDiagnosticsEffect)) {
        return buildCompilerDiagnosticsState(tr.newDoc, effect.value);
      }
    }

    if (tr.docChanged && value.items.length > 0) {
      const touchedRanges: Array<{ fromB: number; toB: number }> = [];
      tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
        touchedRanges.push({ fromB, toB });
      });

      const docLength = tr.newDoc.length;
      const mappedItems: CompilerDiagnosticRange[] = value.items.map(({ from, to, item }) => {
        const mappedFrom = Math.max(0, Math.min(docLength, tr.changes.mapPos(from, 1)));
        const mappedToRaw =
          to > from
            ? Math.max(mappedFrom, Math.min(docLength, tr.changes.mapPos(to, -1)))
            : mappedFrom;
        const line = tr.newDoc.lineAt(mappedFrom);
        const mappedTo =
          to > from && mappedToRaw <= mappedFrom && line.length > 0
            ? Math.min(line.to, mappedFrom + 1)
            : mappedToRaw;

        const wasTouched = touchedRanges.some(
          ({ fromB, toB }) => fromB <= line.to && toB >= line.from
        );

        const nextItem: EditorDiagnosticItem = {
          ...item,
          line: line.number,
          stale: item.stale || wasTouched,
        };

        return {
          from: mappedFrom,
          to: mappedTo,
          item: nextItem,
        };
      });

      return {
        decorations: buildDecorationsFromRanges(mappedItems),
        items: mappedItems,
      };
    }

    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field, (state) => state.decorations);
  },
});

class CompilerGutterMarker extends GutterMarker {
  constructor(
    private readonly severity: EditorDiagnosticItem['severity'],
    private readonly count: number,
    private readonly stale: boolean,
    private readonly summary: string
  ) {
    super();
  }

  override eq(other: CompilerGutterMarker): boolean {
    return (
      other instanceof CompilerGutterMarker &&
      other.severity === this.severity &&
      other.count === this.count &&
      other.stale === this.stale &&
      other.summary === this.summary
    );
  }

  override toDOM(): HTMLElement {
    const dot = document.createElement('span');
    dot.className = `cm-compiler-gutter-marker cm-compiler-gutter-${this.severity}${this.stale ? ' cm-compiler-gutter-stale' : ''}`;
    dot.textContent = this.count > 1 ? String(Math.min(this.count, 99)) : '';
    dot.title = this.stale
      ? `${this.summary} (Line modified — recompile to verify; click to open Logs)`
      : `${this.summary} (Click to open Logs)`;
    dot.setAttribute('aria-label', `${this.severity}: ${this.summary}`);
    return dot;
  }
}

function getDiagnosticsForLine(
  view: EditorView,
  line: { from: number; to: number },
): CompilerDiagnosticRange[] {
  const state = view.state.field(compilerDiagnosticsField, false);
  if (!state || state.items.length === 0) {
    return [];
  }

  const lineNumber = view.state.doc.lineAt(line.from).number;
  return state.items.filter((entry) => {
    if (entry.to > entry.from) {
      return entry.from <= line.to && entry.to >= line.from;
    }
    return entry.item.line === lineNumber;
  });
}

const compilerGutterExtension = gutter({
  class: 'cm-compiler-diag-gutter',
  lineMarker(view, line) {
    const matching = getDiagnosticsForLine(view, line);
    if (matching.length === 0) {
      return null;
    }

    let topSeverity: EditorDiagnosticItem['severity'] = 'info';
    let allStale = true;
    for (const entry of matching) {
      if (severityRank(entry.item.severity) > severityRank(topSeverity)) {
        topSeverity = entry.item.severity;
      }
      if (!entry.item.stale) {
        allStale = false;
      }
    }

    const summary = matching.map((entry) => entry.item.message).slice(0, 2).join(' | ');
    return new CompilerGutterMarker(topSeverity, matching.length, allStale, summary);
  },
  lineMarkerChange(update) {
    if (
      update.state.field(compilerDiagnosticsField, false) !==
      update.startState.field(compilerDiagnosticsField, false)
    ) {
      return true;
    }
    return update.transactions.some((tr) =>
      tr.effects.some(
        (e) => e.is(setCompilerDiagnosticsEffect) || e.is(clearCompilerDiagnosticsEffect)
      )
    );
  },
  domEventHandlers: {
    click(view, line) {
      const matching = getDiagnosticsForLine(view, line);
      if (matching.length === 0) {
        return false;
      }

      let topEntry = matching[0];
      for (const entry of matching) {
        if (severityRank(entry.item.severity) > severityRank(topEntry.item.severity)) {
          topEntry = entry;
        }
      }

      editorCommandBus.dispatch({
        type: 'compiler:open-logs',
        file: topEntry.item.file,
        line: topEntry.item.line,
        severity: topEntry.item.severity,
        message: topEntry.item.message,
      });
      return true;
    },
  },
});

const compilerDiagnosticsTheme = EditorView.baseTheme({
  '.cm-compiler-diag-error': {
    textDecoration: 'underline wavy #ef4444',
    textUnderlineOffset: '2px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  '.cm-compiler-diag-warning': {
    textDecoration: 'underline wavy #f59e0b',
    textUnderlineOffset: '2px',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  '.cm-compiler-diag-info': {
    textDecoration: 'underline dotted #3b82f6',
    textUnderlineOffset: '2px',
  },
  '.cm-compiler-diag-stale': {
    textDecorationStyle: 'dashed',
    opacity: '0.65',
  },
  '.cm-compiler-diag-gutter': {
    minWidth: '0',
  },
  '.cm-compiler-diag-gutter .cm-gutterElement': {
    padding: '0 3px 0 1px',
  },
  '.cm-compiler-gutter-marker': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '9px',
    height: '9px',
    marginTop: 'calc((var(--cm-line-height, 1.54) * 1em - 9px) / 2)',
    borderRadius: '9999px',
    fontSize: '8px',
    lineHeight: '1',
    fontWeight: '700',
    color: '#ffffff',
    cursor: 'pointer',
  },
  '.cm-compiler-gutter-error': {
    backgroundColor: '#ef4444',
  },
  '.cm-compiler-gutter-warning': {
    backgroundColor: '#f59e0b',
  },
  '.cm-compiler-gutter-info': {
    backgroundColor: '#3b82f6',
  },
  '.cm-compiler-gutter-stale': {
    opacity: '0.45',
  },
});

export function createDiagnosticsGutter(options: DiagnosticsGutterOptions = {}): Extension {
  const {
    filePath,
    enabled = true,
    getDiagnostics = (fp: string) => diagnosticsCoordinator.getFileDiagnostics(fp),
  } = options;

  if (!enabled || !filePath) {
    return [];
  }

  return [
    compilerDiagnosticsField.init((state) =>
      buildCompilerDiagnosticsState(state.doc, getDiagnostics(filePath))
    ),
    compilerGutterExtension,
    compilerDiagnosticsTheme,
  ];
}
