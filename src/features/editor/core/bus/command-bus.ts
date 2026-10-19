/**
 * command-bus.ts
 *
 * Concrete implementation of IEditorCommandBus (Coordinators Layer).
 * Decoupled type-safe command dispatcher and observer router for cross-pane interactions.
 * Supports both fire-and-forget `dispatch()` and async result-returning `execute()`.
 */

import type {
  EditorCommand,
  CommandHandler,
  IEditorCommandBus,
  CommandTraceEntry,
  CommandBusMiddleware,
  CommandDispatchMiddleware,
  CommandExecuteMiddleware,
} from '@/features/editor/core/bus/command-bus.port';
import type { IEditorEngine, LatexFormatType } from '@/features/editor/domain/types/ports/editor-engine.port';

class EditorCommandBusImpl implements IEditorCommandBus {
  private handlers = new Map<string, Set<CommandHandler<EditorCommand, unknown>>>();
  private executors = new Map<string, (command: EditorCommand) => Promise<unknown> | unknown>();
  private globalHandlers = new Set<CommandHandler>();
  private middlewares: CommandBusMiddleware[] = [];
  private traceHistory: CommandTraceEntry[] = [];
  private maxHistorySize = 100;
  private tracingEnabled = true;
  private errorReporter: (error: unknown, command: EditorCommand) => void = (err, cmd) => {
    console.error(`[CommandBus] Error handling command "${cmd.type}":`, err);
  };

  public use(middleware: CommandBusMiddleware): () => void {
    this.middlewares.push(middleware);
    return () => {
      const idx = this.middlewares.indexOf(middleware);
      if (idx !== -1) {
        this.middlewares.splice(idx, 1);
      }
    };
  }

  public enableTracing(enabled: boolean): void {
    this.tracingEnabled = enabled;
  }

  public getTraceHistory(limit?: number): CommandTraceEntry[] {
    if (limit && limit > 0) {
      return this.traceHistory.slice(-limit);
    }
    return [...this.traceHistory];
  }

  public clearTraceHistory(): void {
    this.traceHistory = [];
  }

  public setErrorReporter(reporter: (error: unknown, command: EditorCommand) => void): void {
    this.errorReporter = reporter;
  }

  private recordTrace(entry: CommandTraceEntry): void {
    if (!this.tracingEnabled) return;
    this.traceHistory.push(entry);
    if (this.traceHistory.length > this.maxHistorySize) {
      this.traceHistory.shift();
    }
  }

  public dispatch(command: EditorCommand): void {
    const dispatchMiddlewares = this.middlewares
      .map((m) => m.onDispatch)
      .filter((fn): fn is CommandDispatchMiddleware => typeof fn === 'function');

    const invokeFinalDispatch = (cmd: EditorCommand) => {
      const startTime = performance.now();
      let dispatchError: unknown = undefined;

      // 1. Dispatch to type-specific handlers
      const typeHandlers = this.handlers.get(cmd.type);
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          try {
            void handler(cmd);
          } catch (err) {
            dispatchError = err;
            this.errorReporter(err, cmd);
          }
        }
      }

      // 2. Dispatch to global observers
      for (const handler of this.globalHandlers) {
        try {
          void handler(cmd);
        } catch (err) {
          if (!dispatchError) dispatchError = err;
          this.errorReporter(err, cmd);
        }
      }

      this.recordTrace({
        command: cmd,
        timestamp: Date.now(),
        isExecute: false,
        durationMs: Math.round((performance.now() - startTime) * 100) / 100,
        error: dispatchError,
      });
    };

    if (dispatchMiddlewares.length === 0) {
      invokeFinalDispatch(command);
      return;
    }

    let index = 0;
    const next = (cmd: EditorCommand) => {
      if (index < dispatchMiddlewares.length) {
        const mw = dispatchMiddlewares[index++];
        mw(cmd, next);
      } else {
        invokeFinalDispatch(cmd);
      }
    };

    next(command);
  }

  public async execute<R = void>(command: EditorCommand): Promise<R> {
    const executeMiddlewares = this.middlewares
      .map((m) => m.onExecute)
      .filter((fn): fn is CommandExecuteMiddleware => typeof fn === 'function');

    const invokeFinalExecute = async <T = R>(cmd: EditorCommand): Promise<T> => {
      const executor = this.executors.get(cmd.type);
      let result: unknown = undefined;
      const startTime = performance.now();

      if (executor) {
        try {
          result = await executor(cmd);
        } catch (err) {
          this.errorReporter(err, cmd);
          this.recordTrace({
            command: cmd,
            timestamp: Date.now(),
            isExecute: true,
            durationMs: Math.round((performance.now() - startTime) * 100) / 100,
            error: err,
          });
          throw err;
        }
      }

      this.recordTrace({
        command: cmd,
        timestamp: Date.now(),
        isExecute: true,
        durationMs: Math.round((performance.now() - startTime) * 100) / 100,
      });

      // Still notify regular subscribers about the executed command
      this.dispatch(cmd);

      return result as T;
    };

    if (executeMiddlewares.length === 0) {
      return invokeFinalExecute<R>(command);
    }

    let index = 0;
    const next = async <T = R>(cmd: EditorCommand): Promise<T> => {
      if (index < executeMiddlewares.length) {
        const mw = executeMiddlewares[index++];
        return mw(cmd, next as <U = unknown>(command: EditorCommand) => Promise<U>) as Promise<T>;
      }
      return invokeFinalExecute<T>(cmd);
    };

    return next<R>(command);
  }

  public registerExecutor<K extends EditorCommand['type'], R = unknown>(
    type: K,
    executor: (command: Extract<EditorCommand, { type: K }>) => Promise<R> | R,
  ): () => void {
    this.executors.set(type, executor as (command: EditorCommand) => Promise<unknown> | unknown);
    return () => {
      if (this.executors.get(type) === (executor as unknown)) {
        this.executors.delete(type);
      }
    };
  }

  public subscribe<K extends EditorCommand['type']>(
    type: K,
    handler: (command: Extract<EditorCommand, { type: K }>) => void,
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const set = this.handlers.get(type)!;
    set.add(handler as unknown as CommandHandler<EditorCommand, unknown>);

    return () => {
      set.delete(handler as unknown as CommandHandler<EditorCommand, unknown>);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  public subscribeAll(handler: CommandHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  public clear(): void {
    this.handlers.clear();
    this.executors.clear();
    this.globalHandlers.clear();
    this.middlewares = [];
    this.traceHistory = [];
  }
}

const GLOBAL_BUS_KEY = Symbol.for('__FLUX_EDITOR_COMMAND_BUS__');
type GlobalWithBus = typeof globalThis & {
  [GLOBAL_BUS_KEY]?: EditorCommandBusImpl;
};
const globalWithBus = globalThis as GlobalWithBus;
if (!globalWithBus[GLOBAL_BUS_KEY]) {
  globalWithBus[GLOBAL_BUS_KEY] = new EditorCommandBusImpl();
}

export const editorCommandBus: EditorCommandBusImpl = globalWithBus[GLOBAL_BUS_KEY]!;

export type {
  EditorCommand,
  CommandHandler,
  IEditorCommandBus,
  CommandTraceEntry,
  CommandBusMiddleware,
  CommandDispatchMiddleware,
  CommandExecuteMiddleware,
};

// ── Active Engine & Viewer Registry (Context-Free Architecture) ──────────────

let activeEngineInstance: IEditorEngine | null = null;
let activeViewerInstance: unknown = null;

export function setActiveEditorEngine(engine: IEditorEngine | null): void {
  activeEngineInstance = engine;
}

export function getActiveEditorEngine(): IEditorEngine | null {
  return activeEngineInstance;
}

export function getActiveEditorContent(): string {
  if (activeEngineInstance && typeof activeEngineInstance.getContent === 'function') {
    return activeEngineInstance.getContent();
  }
  return '';
}

export function setActivePdfViewer(viewer: unknown): void {
  activeViewerInstance = viewer;
}

export function getActivePdfViewer(): unknown {
  return activeViewerInstance;
}

let defaultBridgesUnsub: Array<() => void> = [];

// Default bridges from Command Bus to Active Engine (Idempotent)
export function registerDefaultBridges(): void {
  for (const unsub of defaultBridgesUnsub) {
    unsub();
  }
  defaultBridgesUnsub = [];

  defaultBridgesUnsub.push(
    editorCommandBus.subscribe('editor:insert-text', (cmd) => {
      activeEngineInstance?.insertText(cmd.text);
    }),
    editorCommandBus.subscribe('editor:focus', () => {
      activeEngineInstance?.focus();
    }),
    editorCommandBus.subscribe('editor:set-content', (cmd) => {
      activeEngineInstance?.setContent?.(cmd.content);
    }),
    editorCommandBus.subscribe('editor:undo', () => {
      activeEngineInstance?.undo();
    }),
    editorCommandBus.subscribe('editor:redo', () => {
      activeEngineInstance?.redo();
    }),
    editorCommandBus.subscribe('editor:wrap-selection', (cmd) => {
      activeEngineInstance?.wrapSelection(cmd.prefix, cmd.suffix, cmd.placeholder);
    }),
    editorCommandBus.subscribe('editor:format', (cmd) => {
      activeEngineInstance?.format(cmd.format);
    }),
    editorCommandBus.subscribe('editor:jump-to-line', (cmd) => {
      activeEngineInstance?.jumpToLine(cmd.line, cmd.highlight, cmd.column, cmd.length);
    }),
    editorCommandBus.subscribe('editor:scroll-to-line', (cmd) => {
      activeEngineInstance?.scrollToLine?.(cmd.line, cmd.smooth);
    }),
    editorCommandBus.subscribe('editor:find', () => {
      activeEngineInstance?.openFind();
    }),
    editorCommandBus.subscribe('editor:insert-citation', (cmd) => {
      if (cmd.bibKey) {
        activeEngineInstance?.insertText(`\\cite{${cmd.bibKey}}`);
      }
    }),
    editorCommandBus.subscribe('editor:visual-command', (cmd) => {
      if (!activeEngineInstance) return;
      const formatCommands: Record<string, LatexFormatType> = {
        bold: 'bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'strikethrough',
        strike: 'strikethrough',
        code: 'code',
        math: 'inlineMath',
        inlineMath: 'inlineMath',
        section: 'section',
        subsection: 'subsection',
        subsubsection: 'subsubsection',
        paragraph: 'paragraph',
        subparagraph: 'subparagraph',
      };

      if (cmd.command in formatCommands) {
        activeEngineInstance.format(formatCommands[cmd.command]);
      } else if (cmd.command === 'bulletList') {
        activeEngineInstance.insertText('\\begin{itemize}\n  \\item \n\\end{itemize}\n');
      } else if (cmd.command === 'orderedList') {
        activeEngineInstance.insertText('\\begin{enumerate}\n  \\item \n\\end{enumerate}\n');
      } else if (cmd.command === 'codeBlock') {
        activeEngineInstance.insertText('\\begin{verbatim}\n\n\\end{verbatim}\n');
      } else if (cmd.contentHtml) {
        activeEngineInstance.insertText(cmd.contentHtml);
      }
    })
  );
}

// Initial binding
registerDefaultBridges();

