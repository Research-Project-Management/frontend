import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { CodeMirrorEngineAdapter } from '@/features/editor/adapters/codemirror/codemirror.adapter';

describe('CodeMirrorEngineAdapter (IEditorEngine Implementation for CM6)', () => {
  let view: EditorView;
  let adapter: CodeMirrorEngineAdapter;
  let container: HTMLDivElement;

  beforeEach(() => {
    // Polyfill getClientRects for JSDOM
    if (typeof Range.prototype.getClientRects !== 'function') {
      Range.prototype.getClientRects = () =>
        [{ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => {} } as DOMRect] as unknown as DOMRectList;
    }

    container = document.createElement('div');
    document.body.appendChild(container);

    const state = EditorState.create({
      doc: 'Hello World\n\\section{Introduction}\nSome LaTeX content.',
    });

    view = new EditorView({
      state,
      parent: container,
    });

    adapter = new CodeMirrorEngineAdapter(view);
  });

  afterEach(() => {
    view.destroy();
    container.remove();
  });

  it('should retrieve full document content via getContent()', () => {
    expect(adapter.getContent()).toBe('Hello World\n\\section{Introduction}\nSome LaTeX content.');
  });

  it('should set full document content via setContent()', () => {
    adapter.setContent('New LaTeX document content');
    expect(adapter.getContent()).toBe('New LaTeX document content');
  });

  it('should wrap selection with formatting prefix and suffix', () => {
    // Select "World"
    view.dispatch({ selection: { anchor: 6, head: 11 } });
    expect(adapter.getSelectedText()).toBe('World');

    adapter.wrapSelection('\\textbf{', '}');
    expect(adapter.getContent()).toContain('Hello \\textbf{World}\n');
  });

  it('should apply LaTeX semantic formatting for bold, math and sections', () => {
    view.dispatch({ selection: { anchor: 0, head: 5 } }); // "Hello"
    adapter.format('bold');
    expect(adapter.getContent()).toContain('\\textbf{Hello}');

    view.dispatch({ selection: { anchor: 0, head: 0 } });
    adapter.format('inlineMath');
    expect(adapter.getContent()).toContain('$$');
  });

  it('should notify content change listeners on updates', () => {
    let changed = '';
    const unsub = adapter.onContentChange((content) => {
      changed = content;
    });

    view.dispatch({
      changes: { from: 0, to: 0, insert: '% Header comment\n' },
    });
    adapter.handleViewUpdate({ docChanged: true, selectionSet: false });

    expect(changed).toContain('% Header comment');
    unsub();
  });

  it('should compute cursor position correctly (1-indexed)', () => {
    // Move to start of line 2
    const line2 = view.state.doc.line(2);
    view.dispatch({ selection: { anchor: line2.from } });

    const pos = adapter.getCursorPosition();
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(2);
    expect(pos?.column).toBe(1);
  });

  it('should jump to line and scroll into view', () => {
    adapter.jumpToLine(2, 'synctex');
    const pos = adapter.getCursorPosition();
    expect(pos?.line).toBe(2);
  });
});
