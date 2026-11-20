/**
 * latex-error-lens.ts
 *
 * VS Code-style Inline Error Lens Extension (Block 4: Engines Layer).
 * Location: `features/editor/engines/extensions/latex-error-lens.ts`
 *
 * Capabilities:
 * - Projects compiler and linter diagnostics directly at the end of the erroneous code line.
 * - Color-coded indicators (Red for error, Amber for warning, Blue for info).
 * - Soft line highlight tinting to guide the user's focus without distraction.
 * - Opt-in via Settings while compile error Fix with AI stays consolidated in Logs and output files.
 */

import {
  StateField,
  StateEffect,
  RangeSetBuilder,
  type Extension,
  type Transaction,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  WidgetType,
} from '@codemirror/view';
import type { EditorDiagnosticItem } from '@/features/editor/domain/types/diagnostics.types';

export type IndexedDiagnosticItem = EditorDiagnosticItem;

export interface ErrorLensPayload {
  diagnostics: IndexedDiagnosticItem[];
  filePath?: string;
}

export const setErrorLensDiagnosticsEffect = StateEffect.define<IndexedDiagnosticItem[] | ErrorLensPayload>();
export const clearErrorLensDiagnosticsEffect = StateEffect.define<void>();

// ── Error Lens Widget ─────────────────────────────────────────────────────────

export class ErrorLensWidget extends WidgetType {
  public readonly line: number;

  constructor(
    public readonly diagnostic: IndexedDiagnosticItem,
    public readonly filePath: string,
  ) {
    super();
    this.line = diagnostic.line;
  }

  override eq(other: ErrorLensWidget): boolean {
    return (
      this.diagnostic.id === other.diagnostic.id &&
      this.line === other.line &&
      this.diagnostic.message === other.diagnostic.message &&
      this.diagnostic.severity === other.diagnostic.severity &&
      Boolean(this.diagnostic.stale) === Boolean(other.diagnostic.stale)
    );
  }

  override ignoreEvent(): boolean {
    return true;
  }

  toDOM(view?: EditorView): HTMLElement {
    void view;
    const wrap = document.createElement('span');
    const severity = this.diagnostic.severity || 'error';
    const isStale = Boolean(this.diagnostic.stale);
    wrap.className = `cm-error-lens cm-error-lens-${severity}${isStale ? ' cm-error-lens-stale' : ''}`;
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-label', `${severity}: ${this.diagnostic.message}`);

    wrap.setAttribute('data-line', String(this.diagnostic.line));
    wrap.setAttribute('data-severity', severity);
    if (isStale) {
      wrap.setAttribute('data-stale', 'true');
      wrap.title = 'Line modified — recompile to verify';
    }

    // 1. Icon Indicator
    const iconSpan = document.createElement('span');
    iconSpan.className = 'cm-error-lens-icon';
    if (severity === 'error') {
      iconSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `;
    } else if (severity === 'warning') {
      iconSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      `;
    } else {
      iconSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      `;
    }
    wrap.appendChild(iconSpan);

    // 2. Message Text (cleaned up)
    const msgSpan = document.createElement('span');
    msgSpan.className = 'cm-error-lens-msg';
    const displayMessage = this.diagnostic.message
      .trim()
      .replace(/^LaTeX Error:\s*/i, '')
      .replace(/^Error on line \d+:\s*/i, '');
    msgSpan.textContent = displayMessage;
    wrap.appendChild(msgSpan);

    return wrap;
  }
}

// ── StateField for Error Lens Decorations ─────────────────────────────────────

const DECO_LINE_BY_SEVERITY: Record<string, Decoration> = {
  error: Decoration.line({ class: 'cm-error-lens-line cm-error-lens-line-error' }),
  warning: Decoration.line({ class: 'cm-error-lens-line cm-error-lens-line-warning' }),
  info: Decoration.line({ class: 'cm-error-lens-line cm-error-lens-line-info' }),
};

function buildDecorations(
  diagnostics: IndexedDiagnosticItem[],
  doc: { lines: number; line: (n: number) => { from: number; to: number } },
  filePath: string,
): DecorationSet {
  if (!diagnostics || diagnostics.length === 0) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();

  // Group diagnostics by line to avoid multiple widgets cluttering one line
  const lineMap = new Map<number, IndexedDiagnosticItem>();
  for (const d of diagnostics) {
    // Skip diagnostics without a valid source line (e.g. global compile warnings like "Reference undefined on page 2")
    // These belong in the Compiler Logs panel, not forced onto Line 1
    if (!d.line || typeof d.line !== 'number' || d.line < 1 || isNaN(d.line)) {
      continue;
    }
    const l = Math.min(d.line, doc.lines);
    // Prioritize errors over warnings
    const existing = lineMap.get(l);
    if (!existing || (existing.severity !== 'error' && d.severity === 'error')) {
      lineMap.set(l, d);
    }
  }

  // Sort line numbers ascending for RangeSetBuilder requirement
  const sortedLines = Array.from(lineMap.keys()).sort((a, b) => a - b);

  for (const lineNum of sortedLines) {
    const d = lineMap.get(lineNum)!;
    const line = doc.line(lineNum);
    const sev = d.severity || 'error';

    // 1. Line Background Tint Decoration
    builder.add(
      line.from,
      line.from,
      DECO_LINE_BY_SEVERITY[sev] ??
        Decoration.line({
          class: `cm-error-lens-line cm-error-lens-line-${sev}`,
        }),
    );

    // 2. End-of-line Inline Error Lens Widget
    builder.add(
      line.to,
      line.to,
      Decoration.widget({
        widget: new ErrorLensWidget(d, filePath),
        side: 1,
      }),
    );
  }

  return builder.finish();
}

export const errorLensField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr: Transaction) {
    // 1. Map existing decorations through doc edits
    const nextDecorations = decorations.map(tr.changes);

    // 2. Handle explicit diagnostic updates
    for (const effect of tr.effects) {
      if (effect.is(setErrorLensDiagnosticsEffect)) {
        const val = effect.value;
        if (Array.isArray(val)) {
          return buildDecorations(val, tr.state.doc, '');
        } else if (val && typeof val === 'object') {
          return buildDecorations(val.diagnostics, tr.state.doc, val.filePath || '');
        }
        return Decoration.none;
      }
      if (effect.is(clearErrorLensDiagnosticsEffect)) {
        return Decoration.none;
      }
    }

    return nextDecorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Error Lens Theme & Styles (Flux Design System Standard) ───────────────────

export const errorLensTheme = EditorView.baseTheme({
  '.cm-error-lens': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: '20px',
    padding: '0 6px 0 8px',
    height: '22px',
    borderRadius: '4px',
    fontSize: 'var(--text-12, 12px)',
    lineHeight: '1.35',
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    pointerEvents: 'auto',
    userSelect: 'none',
    verticalAlign: 'middle',
    maxWidth: 'calc(100% - 40px)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    zIndex: '10',
  },
  '.cm-error-lens-error': {
    backgroundColor: 'color-mix(in srgb, var(--destructive) 9%, var(--canvas, #FCFCFB))',
    color: 'var(--destructive)',
    border: '1px solid color-mix(in srgb, var(--destructive) 24%, transparent)',
  },
  '.cm-error-lens-warning': {
    backgroundColor: 'color-mix(in srgb, var(--warning) 9%, var(--canvas, #FCFCFB))',
    color: 'var(--warning)',
    border: '1px solid color-mix(in srgb, var(--warning) 24%, transparent)',
  },
  '.cm-error-lens-info': {
    backgroundColor: 'color-mix(in srgb, var(--primary) 9%, var(--canvas, #FCFCFB))',
    color: 'var(--primary)',
    border: '1px solid color-mix(in srgb, var(--primary) 24%, transparent)',
  },
  '.cm-error-lens-stale': {
    opacity: '0.6',
    borderStyle: 'dashed',
  },
  '.cm-error-lens-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: '0',
  },
  '.cm-error-lens-msg': {
    fontSize: 'var(--text-12, 12px)',
    lineHeight: '1.35',
    fontWeight: '500',
    color: 'var(--foreground)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '460px',
    letterSpacing: '-0.01em',
  },
  // Line highlighting with subtle 1px hairline indicator (Craft Floor compliant)
  '.cm-error-lens-line-error': {
    backgroundColor: 'color-mix(in srgb, var(--destructive) 4.5%, transparent) !important',
    boxShadow: 'inset 1px 0 0 0 var(--destructive)',
    borderLeft: 'none !important',
  },
  '.cm-error-lens-line-warning': {
    backgroundColor: 'color-mix(in srgb, var(--warning) 4.5%, transparent) !important',
    boxShadow: 'inset 1px 0 0 0 var(--warning)',
    borderLeft: 'none !important',
  },
});

// ── Extension Factory ─────────────────────────────────────────────────────────

export interface ErrorLensOptions {
  enabled?: boolean;
}

export function createLatexErrorLensExtension(options: ErrorLensOptions = {}): Extension[] {
  const { enabled = true } = options;
  if (!enabled) return [];

  return [
    errorLensField,
    errorLensTheme,
  ];
}
