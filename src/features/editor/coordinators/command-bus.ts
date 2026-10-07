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
} from '../ports/command-bus.port';

class EditorCommandBusImpl implements IEditorCommandBus {
  private handlers = new Map<string, Set<CommandHandler<any>>>();
  private executors = new Map<string, (command: any) => Promise<any> | any>();
  private globalHandlers = new Set<CommandHandler>();

  public dispatch(command: EditorCommand): void {
    // 1. Dispatch to type-specific handlers
    const typeHandlers = this.handlers.get(command.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          void handler(command);
        } catch (err) {
          console.error(`[CommandBus] Error handling command "${command.type}":`, err);
        }
      }
    }

    // 2. Dispatch to global observers
    for (const handler of this.globalHandlers) {
      try {
        void handler(command);
      } catch (err) {
        console.error(`[CommandBus] Error in global observer for "${command.type}":`, err);
      }
    }
  }

  public async execute<R = void>(command: EditorCommand): Promise<R> {
    const executor = this.executors.get(command.type);
    let result: any = undefined;

    if (executor) {
      try {
        result = await executor(command);
      } catch (err) {
        console.error(`[CommandBus] Execution error for command "${command.type}":`, err);
        throw err;
      }
    }

    // Still notify regular subscribers about the executed command
    this.dispatch(command);

    return result as R;
  }

  public registerExecutor<K extends EditorCommand['type'], R = any>(
    type: K,
    executor: (command: Extract<EditorCommand, { type: K }>) => Promise<R> | R,
  ): () => void {
    this.executors.set(type, executor);
    return () => {
      if (this.executors.get(type) === executor) {
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
    set.add(handler as CommandHandler<any>);

    return () => {
      set.delete(handler as CommandHandler<any>);
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
  }
}

const GLOBAL_BUS_KEY = Symbol.for('__FLUX_EDITOR_COMMAND_BUS__');
const globalAny = globalThis as any;
if (!globalAny[GLOBAL_BUS_KEY]) {
  globalAny[GLOBAL_BUS_KEY] = new EditorCommandBusImpl();
}

export const editorCommandBus: EditorCommandBusImpl = globalAny[GLOBAL_BUS_KEY];
export const commandBus = editorCommandBus;
export type { EditorCommand, CommandHandler, IEditorCommandBus };
