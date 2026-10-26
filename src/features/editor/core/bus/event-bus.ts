/**
 * event-bus.ts
 *
 * Legacy Event Bus Bridge (Backward-compatible adapter over `editorCommandBus`).
 * Routes `flux:*` events through the centralized `editorCommandBus` and typed listener map.
 */

import { editorCommandBus } from './command-bus';

type EventHandler<T = any> = (payload: T) => void;

const listeners = new Map<string, Set<EventHandler>>();

export const EditorEventBus = {
  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(handler as EventHandler);
    return () => {
      set?.delete(handler as EventHandler);
    };
  },

  emit<T = any>(event: string, payload?: T): void {
    const set = listeners.get(event);
    if (set) {
      for (const fn of Array.from(set)) {
        fn(payload);
      }
    }

    // Bridge to centralized editorCommandBus where applicable
    if (event === 'flux:open-ai-panel' && payload && typeof payload === 'object') {
      const p = payload as { selectedText?: string; initialPrompt?: string };
      editorCommandBus.dispatch({
        type: 'sidebar:open-ai-panel',
        selectedText: p.selectedText,
        initialPrompt: p.initialPrompt,
      });
    } else if (event === 'flux:toggle-ai-panel') {
      editorCommandBus.dispatch({ type: 'sidebar:toggle-ai-panel' });
    } else if (event === 'flux:visual-command' && payload && typeof payload === 'object') {
      const p = payload as unknown as { command: string; level?: 1 | 2 | 3 };
      editorCommandBus.dispatch({
        type: 'editor:visual-command',
        command: p.command,
        level: p.level,
      });
    } else if (event === 'flux:insert-citation' && payload && typeof payload === 'object') {
      const p = payload as unknown as { bibKey: string };
      if (p.bibKey) {
        editorCommandBus.dispatch({
          type: 'editor:insert-citation',
          bibKey: p.bibKey,
        });
      }
    }
  },

  clear(): void {
    listeners.clear();
  },
};

export default EditorEventBus;
