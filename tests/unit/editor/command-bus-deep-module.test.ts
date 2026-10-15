/**
 * command-bus-deep-module.test.ts
 *
 * Verification suite for EditorCommandBus as a Deep Module (Matt Pocock design pattern):
 * - Strongly typed dispatch and async execution.
 * - Middleware pipeline (dispatch & execute interception, mutation, onion composition).
 * - Telemetry & trace history ring buffer.
 * - Resilient error reporting and isolation across subscribers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  editorCommandBus,
  type EditorCommand,
  type CommandBusMiddleware,
} from '@/features/editor/core';

describe('EditorCommandBus Deep Module (Middleware, Tracing & Execution)', () => {
  beforeEach(() => {
    editorCommandBus.clear();
    editorCommandBus.clearTraceHistory();
    editorCommandBus.enableTracing(true);
  });

  describe('dispatch & subscriptions', () => {
    it('dispatches command to type-specific subscriber', () => {
      const received: EditorCommand[] = [];
      const unsub = editorCommandBus.subscribe('editor:set-content', (cmd) => {
        received.push(cmd);
      });

      editorCommandBus.dispatch({ type: 'editor:set-content', content: 'hello world' });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ type: 'editor:set-content', content: 'hello world' });

      unsub();
      editorCommandBus.dispatch({ type: 'editor:set-content', content: 'second' });
      expect(received).toHaveLength(1);
    });

    it('dispatches to global observers registered via subscribeAll', () => {
      const globalReceived: EditorCommand[] = [];
      const unsub = editorCommandBus.subscribeAll((cmd) => {
        globalReceived.push(cmd);
      });

      editorCommandBus.dispatch({ type: 'editor:undo' });
      editorCommandBus.dispatch({ type: 'editor:redo' });

      expect(globalReceived).toHaveLength(2);
      expect(globalReceived[0].type).toBe('editor:undo');
      expect(globalReceived[1].type).toBe('editor:redo');

      unsub();
      editorCommandBus.dispatch({ type: 'editor:focus' });
      expect(globalReceived).toHaveLength(2);
    });

    it('isolates errors in subscribers and invokes error reporter', () => {
      const errors: unknown[] = [];
      editorCommandBus.setErrorReporter((err) => {
        errors.push(err);
      });

      const healthySubscriber = vi.fn();

      editorCommandBus.subscribe('editor:focus', () => {
        throw new Error('Explosion in subscriber');
      });
      editorCommandBus.subscribe('editor:focus', healthySubscriber);

      // Should not throw to caller
      expect(() => {
        editorCommandBus.dispatch({ type: 'editor:focus' });
      }).not.toThrow();

      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toBe('Explosion in subscriber');
      expect(healthySubscriber).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute & executors', () => {
    it('executes command via registered executor and returns result', async () => {
      const unreg = editorCommandBus.registerExecutor('workspace:create-file', async (cmd) => {
        return { fileId: 'new-123', name: cmd.name };
      });

      const result = await editorCommandBus.execute<{ fileId: string; name: string }>({
        type: 'workspace:create-file',
        name: 'test.tex',
      });

      expect(result).toEqual({ fileId: 'new-123', name: 'test.tex' });

      unreg();
    });

    it('dispatches executed command to event listeners', async () => {
      const observed: EditorCommand[] = [];
      const unsub = editorCommandBus.subscribe('workspace:delete-file', (cmd) => {
        observed.push(cmd);
      });

      editorCommandBus.registerExecutor('workspace:delete-file', async () => {
        return true;
      });

      await editorCommandBus.execute({
        type: 'workspace:delete-file',
        fileId: 'file-xyz',
      });

      expect(observed).toHaveLength(1);
      expect(observed[0]).toMatchObject({ type: 'workspace:delete-file', fileId: 'file-xyz' });

      unsub();
    });

    it('propagates error from executor and logs to trace', async () => {
      editorCommandBus.registerExecutor('workspace:set-main-file', async () => {
        throw new Error('File not found');
      });

      await expect(
        editorCommandBus.execute({
          type: 'workspace:set-main-file',
          fileId: 'non-existent',
        })
      ).rejects.toThrow('File not found');

      const traces = editorCommandBus.getTraceHistory();
      const lastTrace = traces[traces.length - 1];
      expect(lastTrace.isExecute).toBe(true);
      expect((lastTrace.error as Error).message).toBe('File not found');
    });
  });

  describe('middleware pipeline', () => {
    it('intercepts dispatch commands, mutates or adds metadata', () => {
      const logs: string[] = [];

      const mw1: CommandBusMiddleware = {
        onDispatch: (cmd: EditorCommand, next: (c: EditorCommand) => void) => {
          logs.push(`mw1:before:${cmd.type}`);
          next(cmd);
          logs.push(`mw1:after:${cmd.type}`);
        },
      };

      const mw2: CommandBusMiddleware = {
        onDispatch: (cmd: EditorCommand, next: (c: EditorCommand) => void) => {
          logs.push(`mw2:${cmd.type}`);
          next(cmd);
        },
      };

      const unregister1 = editorCommandBus.use(mw1);
      const unregister2 = editorCommandBus.use(mw2);

      editorCommandBus.dispatch({ type: 'editor:undo' });

      expect(logs).toEqual([
        'mw1:before:editor:undo',
        'mw2:editor:undo',
        'mw1:after:editor:undo',
      ]);

      unregister1();
      unregister2();
    });

    it('can cancel or filter commands in dispatch middleware', () => {
      const handled = vi.fn();
      editorCommandBus.subscribe('editor:insert-text', handled);

      const blockingMiddleware: CommandBusMiddleware = {
        onDispatch: (cmd: EditorCommand, next: (c: EditorCommand) => void) => {
          if (cmd.type === 'editor:insert-text' && cmd.text === 'BLOCKED') {
            return; // Dropped without calling next()
          }
          next(cmd);
        },
      };

      const unuse = editorCommandBus.use(blockingMiddleware);

      editorCommandBus.dispatch({ type: 'editor:insert-text', text: 'BLOCKED' });
      expect(handled).not.toHaveBeenCalled();

      editorCommandBus.dispatch({ type: 'editor:insert-text', text: 'ALLOWED' });
      expect(handled).toHaveBeenCalledTimes(1);

      unuse();
    });

    it('wraps execution with timing/audit in execute middleware', async () => {
      editorCommandBus.registerExecutor('workspace:rename-file', async () => {
        return true;
      });

      const timings: number[] = [];

      const timingMiddleware: CommandBusMiddleware = {
        onExecute: async (cmd: EditorCommand, next: (c: EditorCommand) => Promise<any>) => {
          const t0 = performance.now();
          const res = await next(cmd);
          timings.push(performance.now() - t0);
          return res;
        },
      };

      const unuse = editorCommandBus.use(timingMiddleware);

      const result = await editorCommandBus.execute({
        type: 'workspace:rename-file',
        fileId: 'f-1',
        oldPath: 'old.tex',
        newPath: 'new.tex',
      });

      expect(result).toBe(true);
      expect(timings).toHaveLength(1);
      expect(timings[0]).toBeGreaterThanOrEqual(0);

      unuse();
    });
  });

  describe('telemetry & trace history', () => {
    it('records traces with duration and command details', () => {
      editorCommandBus.dispatch({ type: 'editor:focus' });
      editorCommandBus.dispatch({ type: 'editor:undo' });

      const history = editorCommandBus.getTraceHistory();
      expect(history).toHaveLength(2);
      expect(history[0].command.type).toBe('editor:focus');
      expect(history[0].isExecute).toBe(false);
      expect(typeof history[0].durationMs).toBe('number');
      expect(history[1].command.type).toBe('editor:undo');
    });

    it('supports limit query and trace clearing', () => {
      for (let i = 1; i <= 5; i++) {
        editorCommandBus.dispatch({ type: 'viewer:goto-page', page: i });
      }

      expect(editorCommandBus.getTraceHistory()).toHaveLength(5);
      expect(editorCommandBus.getTraceHistory(2)).toHaveLength(2);
      expect(editorCommandBus.getTraceHistory(2)[1].command).toEqual({
        type: 'viewer:goto-page',
        page: 5,
      });

      editorCommandBus.clearTraceHistory();
      expect(editorCommandBus.getTraceHistory()).toHaveLength(0);
    });

    it('respects enableTracing toggle', () => {
      editorCommandBus.enableTracing(false);
      editorCommandBus.dispatch({ type: 'editor:focus' });

      expect(editorCommandBus.getTraceHistory()).toHaveLength(0);

      editorCommandBus.enableTracing(true);
      editorCommandBus.dispatch({ type: 'editor:focus' });
      expect(editorCommandBus.getTraceHistory()).toHaveLength(1);
    });
  });
});
