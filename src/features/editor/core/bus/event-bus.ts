/**
 * event-bus.ts
 *
 * Legacy Event Bus Bridge (Backward-compatible adapter over `editorCommandBus`).
 * Routes `flux:*` events through the centralized `editorCommandBus` and typed listener map.
 */

import { editorCommandBus, type EditorCommand } from './command-bus';

type EventHandler<T = any> = (payload: T) => void;

const listeners = new Map<string, Set<EventHandler>>();

export interface LegacyEventMap {
  'flux:open-ai-panel': { selectedText?: string; initialPrompt?: string };
  'flux:toggle-ai-panel': undefined;
  'flux:visual-command': { command: string; level?: 1 | 2 | 3 };
  'flux:insert-citation': { bibKey: string };
}

/**
 * Declarative Adapter / Bridge table mapping legacy `flux:*` string events
 * into strongly-typed `EditorCommand` dispatches.
 */
const LEGACY_EVENT_BRIDGES: Readonly<
  Record<string, (payload: unknown) => EditorCommand | null>
> = {
  'flux:open-ai-panel': (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as LegacyEventMap['flux:open-ai-panel'];
    return {
      type: 'sidebar:open-ai-panel',
      selectedText: p.selectedText,
      initialPrompt: p.initialPrompt,
    };
  },
  'flux:toggle-ai-panel': () => ({ type: 'sidebar:toggle-ai-panel' }),
  'flux:visual-command': (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as LegacyEventMap['flux:visual-command'];
    return {
      type: 'editor:visual-command',
      command: p.command,
      level: p.level,
    };
  },
  'flux:insert-citation': (payload) => {
    if (!payload || typeof payload !== 'object') return null;
    const p = payload as LegacyEventMap['flux:insert-citation'];
    return p.bibKey ? { type: 'editor:insert-citation', bibKey: p.bibKey } : null;
  },
};

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

    const bridge = LEGACY_EVENT_BRIDGES[event];
    if (bridge) {
      const command = bridge(payload);
      if (command) {
        editorCommandBus.dispatch(command);
      }
    }
  },

  clear(): void {
    listeners.clear();
  },
};

export default EditorEventBus;
