import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fromPartial } from '@total-typescript/shoehorn';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  editorCommandBus,
  registerDefaultBridges,
  setActiveEditorEngine,
  getActiveEditorEngine,
  type IEditorEngine,
  type EditorCommand,
  type CommandBusMiddleware,
} from '@/features/editor/core';
import { CodeMirrorEngineAdapter } from '@/features/editor/core/engine/adapters/codemirror.adapter';

describe('EditorCommandBus (Dispatch, Executors, Middleware, Tracing & Engine Bridges)', () => {
  beforeEach(() => {
    editorCommandBus.clear();
    editorCommandBus.clearTraceHistory();
    editorCommandBus.enableTracing(true);
    setActiveEditorEngine(null);
  });

  afterEach(() => {
    setActiveEditorEngine(null);
    vi.clearAllMocks();
  });

  describe('1. Dispatch, Subscriptions & Error Isolation', () => {
    it('routes commands to typed and global subscribers and isolates subscriber exceptions', () => {
      const received: EditorCommand[] = [];
      const globalReceived: EditorCommand[] = [];

      const unsub = editorCommandBus.subscribe('editor:set-content', (cmd) => {
        received.push(cmd);
      });
      const unsubAll = editorCommandBus.subscribeAll((cmd) => {
        globalReceived.push(cmd);
      });

      editorCommandBus.dispatch({ type: 'editor:set-content', content: 'hello world' });
      editorCommandBus.dispatch({ type: 'editor:undo' });

      expect(received).toEqual([{ type: 'editor:set-content', content: 'hello world' }]);
      expect(globalReceived.map((c) => c.type)).toEqual(['editor:set-content', 'editor:undo']);

      unsub();
      unsubAll();
      editorCommandBus.dispatch({ type: 'editor:focus' });
      expect(received).toHaveLength(1);
      expect(globalReceived).toHaveLength(2);

      const errors: unknown[] = [];
      editorCommandBus.setErrorReporter((err) => errors.push(err));
      const healthySubscriber = vi.fn();
      editorCommandBus.subscribe('editor:focus', () => {
        throw new Error('Explosion in subscriber');
      });
      editorCommandBus.subscribe('editor:focus', healthySubscriber);

      expect(() => editorCommandBus.dispatch({ type: 'editor:focus' })).not.toThrow();
      expect((errors[0] as Error).message).toBe('Explosion in subscriber');
      expect(healthySubscriber).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Async Executors, Onion Middleware & Ring-Buffer Tracing', () => {
    it('executes commands, runs onion middleware, and records error/duration traces', async () => {
      const observed: EditorCommand[] = [];
      editorCommandBus.subscribe('workspace:create-file', (cmd) => observed.push(cmd));
      const unreg = editorCommandBus.registerExecutor('workspace:create-file', async (cmd) => ({
        fileId: 'new-123',
        name: cmd.name,
      }));

      const result = await editorCommandBus.execute<{ fileId: string; name: string }>({
        type: 'workspace:create-file',
        name: 'test.tex',
      });
      expect(result).toEqual({ fileId: 'new-123', name: 'test.tex' });
      expect(observed).toHaveLength(1);
      unreg();

      editorCommandBus.registerExecutor('workspace:set-main-file', async () => {
        throw new Error('File not found');
      });
      await expect(
        editorCommandBus.execute({ type: 'workspace:set-main-file', fileId: 'missing' }),
      ).rejects.toThrow('File not found');
      const errTrace = editorCommandBus.getTraceHistory().at(-1)!;
      expect(errTrace.isExecute).toBe(true);
      expect((errTrace.error as Error).message).toBe('File not found');

      // Onion middleware + blocking
      const logs: string[] = [];
      const u1 = editorCommandBus.use({
        onDispatch: (cmd, next) => {
          logs.push(`mw1:before:${cmd.type}`);
          next(cmd);
          logs.push(`mw1:after:${cmd.type}`);
        },
      });
      const u2 = editorCommandBus.use({
        onDispatch: (cmd, next) => {
          if (cmd.type === 'editor:insert-text' && cmd.text === 'BLOCKED') return;
          logs.push(`mw2:${cmd.type}`);
          next(cmd);
        },
      });
      const insertSpy = vi.fn();
      editorCommandBus.subscribe('editor:insert-text', insertSpy);

      editorCommandBus.dispatch({ type: 'editor:insert-text', text: 'BLOCKED' });
      expect(insertSpy).not.toHaveBeenCalled();

      logs.length = 0;
      editorCommandBus.dispatch({ type: 'editor:undo' });
      expect(logs).toEqual(['mw1:before:editor:undo', 'mw2:editor:undo', 'mw1:after:editor:undo']);
      u1();
      u2();

      // Execute timing middleware & trace controls
      editorCommandBus.clearTraceHistory();
      const timings: number[] = [];
      const uExec = editorCommandBus.use({
        onExecute: async (cmd, next) => {
          const t0 = performance.now();
          const res = await next(cmd);
          timings.push(performance.now() - t0);
          return res;
        },
      } as CommandBusMiddleware);
      editorCommandBus.registerExecutor('workspace:rename-file', async () => true);
      expect(
        await editorCommandBus.execute({
          type: 'workspace:rename-file',
          fileId: 'f-1',
          oldPath: 'old.tex',
          newPath: 'new.tex',
        }),
      ).toBe(true);
      expect(timings).toHaveLength(1);
      uExec();

      editorCommandBus.enableTracing(false);
      editorCommandBus.clearTraceHistory();
      editorCommandBus.dispatch({ type: 'editor:focus' });
      expect(editorCommandBus.getTraceHistory()).toHaveLength(0);
    });
  });

  describe('3. Default Engine Bridges, Formatting Single-Execution & Dual-Pane Isolation', () => {
    it('routes engine bridge commands and yields editor:set-content to surface diff subscribers', () => {
      registerDefaultBridges();
      const mockEngine = fromPartial<IEditorEngine>({
        selectAll: vi.fn(),
        indent: vi.fn(),
        outdent: vi.fn(),
        toggleComment: vi.fn(),
        insertText: vi.fn(),
        setContent: vi.fn(),
        focus: vi.fn(),
      });
      setActiveEditorEngine(mockEngine);

      editorCommandBus.dispatch({ type: 'editor:select-all' });
      editorCommandBus.dispatch({ type: 'editor:indent' });
      editorCommandBus.dispatch({ type: 'editor:outdent' });
      editorCommandBus.dispatch({ type: 'editor:toggle-comment' });
      editorCommandBus.dispatch({ type: 'editor:delete-selection' });

      expect(mockEngine.selectAll).toHaveBeenCalledTimes(1);
      expect(mockEngine.indent).toHaveBeenCalledTimes(1);
      expect(mockEngine.outdent).toHaveBeenCalledTimes(1);
      expect(mockEngine.toggleComment).toHaveBeenCalledTimes(1);
      expect(mockEngine.insertText).toHaveBeenCalledWith('');

      editorCommandBus.dispatch({ type: 'editor:set-content', content: 'fallback' });
      expect(mockEngine.setContent).toHaveBeenCalledWith('fallback');
      vi.mocked(mockEngine.setContent).mockClear();

      const surfaceDiffSpy = vi.fn();
      const unsub = editorCommandBus.subscribe('editor:set-content', surfaceDiffSpy);
      editorCommandBus.dispatch({ type: 'editor:set-content', content: 'yjs-diff-safe' });
      expect(surfaceDiffSpy).toHaveBeenCalledTimes(1);
      expect(mockEngine.setContent).not.toHaveBeenCalled();
      unsub();
    });

    it('executes CM6 formatting/visual commands once and isolates dual-pane active engines', () => {
      registerDefaultBridges();
      const container = document.createElement('div');
      document.body.appendChild(container);

      const view1 = new EditorView({
        state: EditorState.create({ doc: 'Hello World' }),
        parent: container,
      });
      const view2 = new EditorView({
        state: EditorState.create({ doc: 'Pane 2 Content' }),
        parent: container,
      });

      try {
        const adapter1 = new CodeMirrorEngineAdapter(view1);
        const adapter2 = new CodeMirrorEngineAdapter(view2);

        setActiveEditorEngine(adapter1);
        expect(getActiveEditorEngine()).toBe(adapter1);

        view1.dispatch({ selection: { anchor: 6, head: 11 } });
        editorCommandBus.dispatch({ type: 'editor:format', format: 'bold' });
        expect(view1.state.doc.toString()).toBe('Hello \\textbf{World}');
        expect(view2.state.doc.toString()).toBe('Pane 2 Content');

        setActiveEditorEngine(adapter2);
        view2.dispatch({ selection: { anchor: 0, head: 6 } });
        editorCommandBus.dispatch({ type: 'editor:format', format: 'italic' });
        expect(view1.state.doc.toString()).toBe('Hello \\textbf{World}');
        expect(view2.state.doc.toString()).toBe('\\textit{Pane 2} Content');

        view2.dispatch({ selection: { anchor: view2.state.doc.length } });
        editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'bulletList' });
        expect(view2.state.doc.toString()).toContain('\\begin{itemize}');
      } finally {
        view1.destroy();
        view2.destroy();
        container.remove();
      }
    });
  });
});
