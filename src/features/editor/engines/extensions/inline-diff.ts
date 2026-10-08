/**
 * inline-diff.ts
 *
 * CodeMirror 6 Inline Diff & Review Extension (Block 4: Engines Layer).
 * Location: `features/editor/engines/inline-diff.ts`
 *
 * Architecture inspired by Void & Cursor:
 * - When AI proposes an edit, instead of overwriting the document directly,
 *   it creates an interactive DiffZone in CodeMirror 6.
 * - Original text is marked with a red strike-through highlight.
 * - Proposed replacement is shown in an inline preview widget (green diff block).
 * - Floating action header with [Accept (Mod-Enter)] and [Reject (Esc)] buttons.
 * - Only upon Accept is the buffer modified and propagated through Yjs and auto-save.
 */

import {
  StateField,
  StateEffect,
  type Extension,
  type Transaction,
  type EditorState,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  WidgetType,
  keymap,
} from '@codemirror/view';
import { editorCommandBus } from '../../coordinators/command-bus';
import type { DiffProposal } from '../../domain/types/ports/editor-engine.port';

export type { DiffProposal };

// ─── STATE EFFECTS ───────────────────────────────────────────────────────────

export const proposeDiffEffect = StateEffect.define<DiffProposal>();
export const acceptDiffEffect = StateEffect.define<string>(); // diffId
export const rejectDiffEffect = StateEffect.define<string>(); // diffId
export const clearDiffEffect = StateEffect.define<void>();

// ─── WIDGET IMPLEMENTATION ───────────────────────────────────────────────────

class InlineDiffWidget extends WidgetType {
  constructor(private readonly proposal: DiffProposal) {
    super();
  }

  override eq(other: InlineDiffWidget): boolean {
    return (
      this.proposal.id === other.proposal.id &&
      this.proposal.replacementText === other.proposal.replacementText
    );
  }

  override ignoreEvent(_event: Event): boolean {
    // Let the widget handle its own mouse and keyboard interactions
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-inline-diff-widget';

    // 1. Header Toolbar
    const header = document.createElement('div');
    header.className = 'cm-inline-diff-header';

    const titleBox = document.createElement('div');
    titleBox.className = 'cm-inline-diff-title';
    titleBox.innerHTML = `
      <svg class="cm-inline-diff-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <span>${this.proposal.title || 'AI Suggested Edit'}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'cm-inline-diff-actions';

    // Accept Button
    const acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'cm-diff-btn cm-diff-btn-accept';
    acceptBtn.title = 'Accept suggestion (Tab or ⌘⏎)';
    acceptBtn.innerHTML = `<span>Accept</span> <kbd>Tab</kbd>`;
    acceptBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      executeAcceptDiff(view, this.proposal);
    };

    // Reject Button
    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'cm-diff-btn cm-diff-btn-reject';
    rejectBtn.title = 'Reject suggestion (Esc)';
    rejectBtn.innerHTML = `<span>Reject</span> <kbd>Esc</kbd>`;
    rejectBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      executeRejectDiff(view, this.proposal.id);
    };

    actions.appendChild(acceptBtn);
    actions.appendChild(rejectBtn);
    header.appendChild(titleBox);
    header.appendChild(actions);

    // 2. Diff Body (Green Insertion Preview)
    const body = document.createElement('div');
    body.className = 'cm-inline-diff-body';

    const codePre = document.createElement('pre');
    codePre.className = 'cm-inline-diff-code';
    codePre.textContent = this.proposal.replacementText;

    body.appendChild(codePre);

    wrap.appendChild(header);
    wrap.appendChild(body);

    return wrap;
  }
}

// ─── EXECUTION HELPERS ────────────────────────────────────────────────────────

function executeAcceptDiff(view: EditorView, proposal: DiffProposal) {
  // Apply changes to document and clear diff zone atomically
  view.dispatch({
    changes: {
      from: proposal.from,
      to: proposal.to,
      insert: proposal.replacementText,
    },
    effects: [acceptDiffEffect.of(proposal.id)],
    userEvent: 'ai.accept-diff',
  });

  editorCommandBus.dispatch({
    type: 'ai:diff-resolved',
    action: 'accept',
    proposal,
    payload: { action: 'accept', proposal },
  } as any);

  view.focus();
}

function executeRejectDiff(view: EditorView, proposalId: string) {
  view.dispatch({
    effects: [rejectDiffEffect.of(proposalId)],
    userEvent: 'ai.reject-diff',
  });

  editorCommandBus.dispatch({
    type: 'ai:diff-resolved',
    action: 'reject',
    proposalId,
    payload: { action: 'reject', proposalId },
  } as any);

  view.focus();
}

// ─── STATE FIELD ─────────────────────────────────────────────────────────────

export const diffProposalField = StateField.define<{
  proposal: DiffProposal | null;
  decorations: DecorationSet;
}>({
  create() {
    return { proposal: null, decorations: Decoration.none };
  },

  update(state, tr: Transaction) {
    let currentProposal = state.proposal;

    for (const effect of tr.effects) {
      if (effect.is(proposeDiffEffect)) {
        currentProposal = effect.value;
      } else if (effect.is(acceptDiffEffect) || effect.is(rejectDiffEffect) || effect.is(clearDiffEffect)) {
        currentProposal = null;
      }
    }

    if (!currentProposal) {
      return { proposal: null, decorations: Decoration.none };
    }

    // Map positions if document was modified while proposal was pending
    const docLen = tr.newDoc.length;
    const rawFrom = tr.changes.mapPos(currentProposal.from);
    const rawTo = tr.changes.mapPos(currentProposal.to);
    const from = Math.max(0, Math.min(rawFrom, docLen));
    const to = Math.max(from, Math.min(rawTo, docLen));

    const updatedProposal: DiffProposal = {
      ...currentProposal,
      from,
      to,
    };

    // Build decorations: Red mark for original text + Green widget for replacement
    const decos = [];

    // Red highlight for removed/original text if range > 0
    if (to > from) {
      decos.push(
        Decoration.mark({
          class: 'cm-diff-removed-range',
        }).range(from, to)
      );
    }

    // Widget displaying replacement and Accept/Reject buttons
    decos.push(
      Decoration.widget({
        widget: new InlineDiffWidget(updatedProposal),
        side: 1,
        block: true,
      }).range(to)
    );

    return {
      proposal: updatedProposal,
      decorations: Decoration.set(decos, true),
    };
  },

  provide: (f) => EditorView.decorations.from(f, (val) => val.decorations),
});

// ─── KEYBINDINGS ─────────────────────────────────────────────────────────────

const inlineDiffKeymap = keymap.of([
  {
    key: 'Tab',
    run(view: EditorView) {
      const current = view.state.field(diffProposalField, false);
      if (current?.proposal) {
        executeAcceptDiff(view, current.proposal);
        return true;
      }
      return false;
    },
  },
  {
    key: 'Mod-Enter',
    run(view: EditorView) {
      const current = view.state.field(diffProposalField, false);
      if (current?.proposal) {
        executeAcceptDiff(view, current.proposal);
        return true;
      }
      return false;
    },
  },
  {
    key: 'Escape',
    run(view: EditorView) {
      const current = view.state.field(diffProposalField, false);
      if (current?.proposal) {
        executeRejectDiff(view, current.proposal.id);
        return true;
      }
      return false;
    },
  },
]);

// ─── THEME STYLES ────────────────────────────────────────────────────────────

const inlineDiffTheme = EditorView.baseTheme({
  '.cm-diff-removed-range': {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    textDecoration: 'line-through',
    textDecorationColor: '#ef4444',
  },

  '.cm-inline-diff-widget': {
    margin: '6px 0',
    borderRadius: '6px',
    border: '1px solid rgba(139, 92, 246, 0.4)',
    backgroundColor: 'var(--card, #18181b)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(139, 92, 246, 0.15)',
    overflow: 'hidden',
    fontSize: '12px',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    animation: 'cmDiffFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  },

  '@keyframes cmDiffFadeIn': {
    '0%': { opacity: '0', transform: 'translateY(-4px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },

  '.cm-inline-diff-header': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
  },

  '.cm-inline-diff-title': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: '600',
    color: '#a78bfa',
    fontSize: '11px',
    letterSpacing: '0.02em',
  },

  '.cm-inline-diff-icon': {
    color: '#8b5cf6',
  },

  '.cm-inline-diff-actions': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  '.cm-diff-btn': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
  },

  '.cm-diff-btn kbd': {
    fontSize: '9px',
    padding: '1px 3px',
    borderRadius: '3px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    fontFamily: 'inherit',
  },

  '.cm-diff-btn-accept': {
    backgroundColor: '#10b981',
    color: '#ffffff',
    borderColor: '#059669',
  },
  '.cm-diff-btn-accept:hover': {
    backgroundColor: '#059669',
  },

  '.cm-diff-btn-reject': {
    backgroundColor: 'transparent',
    color: '#a1a1aa',
    borderColor: '#3f3f46',
  },
  '.cm-diff-btn-reject:hover': {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },

  '.cm-inline-diff-body': {
    padding: '8px 12px',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderLeft: '3px solid #10b981',
  },

  '.cm-inline-diff-code': {
    margin: '0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    color: '#34d399',
    fontSize: '12px',
    lineHeight: '1.5',
  },
});

/**
 * Creates the CodeMirror 6 Inline Diff Extension
 */
export function createInlineDiffExtension(): Extension[] {
  return [diffProposalField, inlineDiffKeymap, inlineDiffTheme];
}
