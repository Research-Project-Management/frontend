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
} from '../domain/types/ports/command-bus.port';
import type { IEditorEngine, LatexFormatType } from '../domain/types/ports/editor-engine.port';

class EditorCommandBusImpl implements IEditorCommandBus {
  private handlers = new Map<string, Set<CommandHandler<EditorCommand, unknown>>>();
  private executors = new Map<string, (command: EditorCommand) => Promise<unknown> | unknown>();
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
    let result: unknown = undefined;

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
export const commandBus = editorCommandBus;
export type { EditorCommand, CommandHandler, IEditorCommandBus };

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

export const getActiveEditorInstance = getActiveEditorEngine;
export const getActiveViewerInstance = getActivePdfViewer;

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
      activeEngineInstance?.setContent(cmd.content);
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

