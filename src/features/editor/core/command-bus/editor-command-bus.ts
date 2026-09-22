/**
 * editor-command-bus.ts
 *
 * Concrete implementation of IEditorCommandBus.
 * Eliminates the anti-pattern of storing mutable { current: null } refs in Zustand.
 * Provides a clean, type-safe pub-sub bus for cross-pane interactions.
 */

import type {
  EditorCommand,
  CommandHandler,
  IEditorCommandBus,
} from '../../ports/command-bus.port';

class EditorCommandBusImpl implements IEditorCommandBus {
  private handlers = new Map<string, Set<CommandHandler<any>>>();
  private globalHandlers = new Set<CommandHandler>();

  dispatch(command: EditorCommand): void {
    // 1. Dispatch to type-specific handlers
    const typeHandlers = this.handlers.get(command.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(command);
        } catch (err) {
          console.error(`[CommandBus] Error handling command "${command.type}":`, err);
        }
      }
    }

    // 2. Dispatch to global observers
    for (const handler of this.globalHandlers) {
      try {
        handler(command);
      } catch (err) {
        console.error(`[CommandBus] Error in global observer for "${command.type}":`, err);
      }
    }
  }

  subscribe<K extends EditorCommand['type']>(
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

  subscribeAll(handler: CommandHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /** Clears all registered handlers (useful for test teardown) */
  reset(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
  }
}

/** Singleton instance for application runtime */
export const editorCommandBus: IEditorCommandBus = new EditorCommandBusImpl();

/** Factory function for isolated test instances */
export function createEditorCommandBus(): IEditorCommandBus {
  return new EditorCommandBusImpl();
}
