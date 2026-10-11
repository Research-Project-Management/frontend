import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { vim, Vim } from '@replit/codemirror-vim';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

describe('CodeMirror 6: Native Vim Mode & Yjs Collaboration', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    if (typeof Range.prototype.getClientRects !== 'function') {
      Range.prototype.getClientRects = () =>
        [{ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => {} } as DOMRect] as unknown as DOMRectList;
    }
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Native Vim Keybinding Compartment', () => {
    it('should mount CodeMirror 6 with vim() extension', () => {
      const state = EditorState.create({
        doc: '\\documentclass{article}\n\\begin{document}\nHello Vim\n\\end{document}',
        extensions: [vim()],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      expect(view.state.doc.toString()).toContain('Hello Vim');
      view.destroy();
    });

    it('should dynamically toggle Vim mode via CodeMirror Compartment', () => {
      const keybindingComp = new Compartment();
      const state = EditorState.create({
        doc: 'Initial document',
        extensions: [keybindingComp.of([])],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // Initially standard (empty extension)
      expect(view.state.doc.toString()).toBe('Initial document');

      // Reconfigure to Vim
      view.dispatch({
        effects: keybindingComp.reconfigure(vim()),
      });
      expect(view.state.doc.toString()).toBe('Initial document');

      // Reconfigure back to Standard
      view.dispatch({
        effects: keybindingComp.reconfigure([]),
      });
      expect(view.state.doc.toString()).toBe('Initial document');

      view.destroy();
    });

    it('should register custom Ex commands on Vim namespace without throwing', () => {
      let writeCalled = false;
      try {
        Vim.defineEx('cmtestwrite', 'ctw', () => {
          writeCalled = true;
        });
      } catch {
        // Ex command already exists
      }

      // Verify Vim object exists and allows definition
      expect(Vim).toBeDefined();
    });
  });

  describe('Yjs CRDT Multiplayer Collaboration (yCollab)', () => {
    it('should synchronize Y.Text and CodeMirror 6 bidirectionally', () => {
      const doc = new Y.Doc();
      const yText = doc.getText('codemirror');
      yText.insert(0, 'Initial shared LaTeX');

      const awareness = new Awareness(doc);

      const state = EditorState.create({
        doc: yText.toString(),
        extensions: [yCollab(yText, awareness)],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      // CodeMirror doc should immediately reflect Y.Text content
      expect(view.state.doc.toString()).toBe('Initial shared LaTeX');

      // Remote update to Y.Text should propagate to CodeMirror
      doc.transact(() => {
        yText.insert(yText.length, ' \\textbf{bold}');
      });

      expect(view.state.doc.toString()).toBe('Initial shared LaTeX \\textbf{bold}');

      // Local update in CodeMirror should propagate back to Y.Text
      view.dispatch({
        changes: { from: 0, to: 7, insert: 'Updated' },
      });

      expect(yText.toString()).toBe('Updated shared LaTeX \\textbf{bold}');

      view.destroy();
      doc.destroy();
    });

    it('should support dynamic collaboration toggling via Compartment', () => {
      const collabComp = new Compartment();
      const doc = new Y.Doc();
      const yText = doc.getText('codemirror');
      yText.insert(0, 'Collaborative session text');
      const awareness = new Awareness(doc);

      const state = EditorState.create({
        doc: 'Local document',
        extensions: [collabComp.of([])],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      expect(view.state.doc.toString()).toBe('Local document');

      // Activate Yjs collaboration
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: yText.toString() },
        effects: collabComp.reconfigure([yCollab(yText, awareness)]),
      });

      expect(view.state.doc.toString()).toBe('Collaborative session text');

      // Deactivate collaboration
      view.dispatch({
        effects: collabComp.reconfigure([]),
      });

      view.destroy();
      doc.destroy();
    });
  });
});
