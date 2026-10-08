/**
 * latex-error-lens.ts
 *
 * VS Code-style Inline Error Lens & 1-Click AI AutoFix Extension (Block 4: Engines Layer).
 * Location: `features/editor/engines/latex-error-lens.ts`
 *
 * Capabilities:
 * - Projects compiler and linter diagnostics directly at the end of the erroneous code line.
 * - Color-coded indicators (Red for error, Amber for warning, Blue for info).
 * - Soft line highlight tinting to guide the user's focus without distraction.
 * - Interactive "✨ Fix with AI" button embedded in the Error Lens widget:
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
import type { IndexedDiagnosticItem } from '../../coordinators/diagnostics.coordinator';
import { editorCommandBus } from '../../coordinators/command-bus';

// ── State Effects ─────────────────────────────────────────────────────────────

export const setErrorLensDiagnosticsEffect = StateEffect.define<IndexedDiagnosticItem[]>();
export const clearErrorLensDiagnosticsEffect = StateEffect.define<void>();

// ── Error Lens Widget ─────────────────────────────────────────────────────────

export class ErrorLensWidget extends WidgetType {
  constructor(
    public readonly diagnostic: IndexedDiagnosticItem,
    public readonly filePath: string,
  ) {
    super();
  }

  override eq(other: ErrorLensWidget): boolean {
    return (
      this.diagnostic.id === other.diagnostic.id &&
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

    // 1. Icon Indicator
    const iconSpan = document.createElement('span');
    iconSpan.className = 'cm-error-lens-icon';
    if (sev === 'error') {
      iconSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      `;
    } else {
      iconSpan.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
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

    // 3. "Fix with AI" 1-Click Action Button
    const fixBtn = document.createElement('button');
    fixBtn.type = 'button';
    fixBtn.className = 'cm-error-lens-btn cm-error-lens-btn-fix';
    fixBtn.title = 'AI AutoFix: Generate instant inline diff for this line (Mod-Enter to accept)';
    fixBtn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span>Fix with AI</span>
    `;
    fixBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      editorCommandBus.dispatch({
        type: 'ai:autofix-diagnostic',
        diagnostic: this.diagnostic,
      });
    };
    wrap.appendChild(fixBtn);

    // 4. "Ask AI" in Sidebar Action Button
    const askBtn = document.createElement('button');
    askBtn.type = 'button';
    askBtn.className = 'cm-error-lens-btn cm-error-lens-btn-chat';
    askBtn.title = 'Open AI Assistant in left sidebar with full error context';
    askBtn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    `;
    askBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      editorCommandBus.dispatch({
        type: 'editor:suggest-fix',
        error: {
          message: this.diagnostic.message,
          line: this.diagnostic.line,
          file: this.diagnostic.file || this.filePath,
          context: this.diagnostic.context,
        },
      });
    };
    wrap.appendChild(askBtn);

    return wrap;
  }
}

// ── StateField for Error Lens Decorations ─────────────────────────────────────

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
        return buildDecorations(effect.value, tr.state.doc, '');
      }
      if (effect.is(clearErrorLensDiagnosticsEffect)) {
        return Decoration.none;
      }
    }

    return nextDecorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Error Lens Theme & Styles ─────────────────────────────────────────────────

export const errorLensTheme = EditorView.baseTheme({
  '.cm-error-lens': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: '24px',
    padding: '1px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    lineHeight: '1.4',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    pointerEvents: 'auto',
    userSelect: 'none',
    verticalAlign: 'baseline',
    maxWidth: 'calc(100% - 40px)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    zIndex: '10',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  },
  '.cm-error-lens-error': {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.25)',
  },
  '.cm-error-lens-warning': {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    color: '#d97706',
    border: '1px solid rgba(245, 158, 11, 0.25)',
  },
  '.cm-error-lens-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: '0',
  },
  '.cm-error-lens-msg': {
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '420px',
  },
  '.cm-error-lens-btn': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '1.5px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  '.cm-error-lens-btn-fix': {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    color: 'inherit',
    '&:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.32)',
      transform: 'scale(1.02)',
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
  },
  '.cm-error-lens-btn-chat': {
    backgroundColor: 'transparent',
    color: 'inherit',
    opacity: '0.7',
    padding: '1.5px 4px',
    '&:hover': {
      opacity: '1',
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
  },
  // Line highlighting
  '.cm-error-lens-line-error': {
    backgroundColor: 'rgba(239, 68, 68, 0.05) !important',
    borderLeft: '2px solid #ef4444 !important',
  },
  '.cm-error-lens-line-warning': {
    backgroundColor: 'rgba(245, 158, 11, 0.05) !important',
    borderLeft: '2px solid #f59e0b !important',
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
