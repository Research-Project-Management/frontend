/**
 * latex-error-lens.ts
 *
 * VS Code-style Inline Error Lens & 1-Click AI AutoFix Extension (Block 4: Engines Layer).
 * Location: `features/editor/engines/extensions/latex-error-lens.ts`
 *
 * Capabilities:
 * - Projects compiler and linter diagnostics directly at the end of the erroneous code line.
 * - Color-coded indicators (Red for error, Amber for warning, Blue for info).
 * - Soft line highlight tinting to guide the user's focus without distraction.
 * - Interactive "Fix with AI" button embedded in the Error Lens widget:
 *   Calls `aiCoordinator.autoFixDiagnostic` to generate and mount an interactive Inline Diff
 *   at the exact line, allowing instant 1-click review and accept (Mod-Enter).
 * - "Ask AI" button to open the Primary Sidebar with full contextual diagnostic prompt.
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
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';

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
      this.diagnostic.severity === other.diagnostic.severity
    );
  }

  override ignoreEvent(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    const sev = this.diagnostic.severity || 'error';
    wrap.className = `cm-error-lens cm-error-lens-${sev}`;
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-label', `${sev}: ${this.diagnostic.message}`);

    wrap.setAttribute('data-line', String(this.diagnostic.line));
    wrap.setAttribute('data-severity', sev);

    // 1. Icon Indicator
    const iconSpan = document.createElement('span');
    iconSpan.className = 'cm-error-lens-icon';
    if (sev === 'error') {
      iconSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `;
    } else if (sev === 'warning') {
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
    let cleanMsg = this.diagnostic.message.trim();
    cleanMsg = cleanMsg.replace(/^LaTeX Error:\s*/i, '').replace(/^Error on line \d+:\s*/i, '');
    msgSpan.textContent = cleanMsg;
    wrap.appendChild(msgSpan);

    // Hairline Divider
    const divider = document.createElement('span');
    divider.className = 'cm-error-lens-divider';
    wrap.appendChild(divider);

    // 3. Single Action Button: Quick Fix or Fix with AI (if diagnostic has a resolved line)
    if (this.diagnostic.line && this.diagnostic.line >= 1) {
      const fixBtn = document.createElement('button');
      fixBtn.type = 'button';
      fixBtn.className = 'cm-error-lens-btn cm-error-lens-btn-fix';
      fixBtn.setAttribute('data-testid', 'error-lens-fix-btn');
      fixBtn.title = 'AI AutoFix: Generate instant inline diff for this line (Tab to accept, Esc to reject)';
      fixBtn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 8V4H8"/>
          <rect width="16" height="12" x="4" y="8" rx="2"/>
          <path d="M2 14h2"/>
          <path d="M20 14h2"/>
          <path d="M15 13v2"/>
          <path d="M9 13v2"/>
        </svg>
        <span>Fix with AI</span>
      `;
      const triggerFix = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        editorCommandBus.dispatch({
          type: 'ai:autofix-diagnostic',
          diagnostic: this.diagnostic,
        });
      };
      fixBtn.onmousedown = (e) => e.stopPropagation();
      fixBtn.onclick = triggerFix;
      wrap.appendChild(fixBtn);
    }

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
    const l = Math.max(1, Math.min(d.line, doc.lines));
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
    borderRadius: '9999px',
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
  '.cm-error-lens-divider': {
    width: '1px',
    height: '11px',
    backgroundColor: 'color-mix(in srgb, currentColor 20%, transparent)',
    margin: '0 2px',
    flexShrink: '0',
  },
  '.cm-error-lens-btn': {
    display: 'inline-flex',
    alignItems: 'center',
    border: 'none',
    cursor: 'pointer',
    outline: 'none',
    lineHeight: '1.35',
  },
  '.cm-error-lens-btn-fix': {
    gap: '3.5px',
    padding: '1px 7px',
    borderRadius: '9999px',
    fontSize: 'var(--text-12, 12px)',
    lineHeight: '1.35',
    fontWeight: '600',
    letterSpacing: '0.01em',
    border: '1px solid color-mix(in srgb, var(--ai, #8250DF) 30%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--ai, #8250DF) 12%, var(--canvas, #FCFCFB))',
    color: 'var(--ai, #8250DF)',
    '&:hover': {
      backgroundColor: 'var(--ai, #8250DF)',
      color: '#FFFFFF',
      borderColor: 'var(--ai, #8250DF)',
    },
  },
  '.cm-error-lens-btn-chat': {
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    padding: '0',
    borderRadius: '9999px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary, #595959)',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--ai, #8250DF) 15%, transparent)',
      borderColor: 'color-mix(in srgb, var(--ai, #8250DF) 30%, transparent)',
      color: 'var(--ai, #8250DF)',
    },
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
