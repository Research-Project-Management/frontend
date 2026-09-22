/**
 * command-bus.port.ts
 *
 * Core Port (Contract): Strongly-typed command definitions and event channels
 * bridging the Editor, Viewer, Compiler, and Sidebar without mutable refs.
 */

import type { LatexFormatType } from './editor-engine.port';

export type SidebarPanelName =
  | 'Files'
  | 'Explorer'
  | 'Outline'
  | 'Search'
  | 'Review'
  | 'History'
  | 'AI'
  | 'Settings'
  | 'Citations';

export type EditorCommand =
  | { type: 'editor:jump-to-line'; line: number; highlight?: 'error' | 'synctex' }
  | { type: 'editor:insert-text'; text: string }
  | { type: 'editor:wrap-selection'; prefix: string; suffix: string; placeholder?: string }
  | { type: 'editor:format'; format: LatexFormatType }
  | { type: 'editor:undo' }
  | { type: 'editor:redo' }
  | { type: 'editor:focus' }
  | { type: 'compiler:trigger'; forceSync?: boolean; draft?: boolean }
  | { type: 'viewer:goto-page'; page: number }
  | { type: 'viewer:jump-to-line'; line: number }
  | { type: 'viewer:scroll-to-coords'; page: number; x: number; y: number }
  | { type: 'viewer:zoom-in' }
  | { type: 'viewer:zoom-out' }
  | { type: 'viewer:fit-width' }
  | { type: 'viewer:fit-height' }
  | { type: 'sidebar:toggle-panel'; panel: SidebarPanelName }
  | { type: 'sidebar:open-panel'; panel: SidebarPanelName; query?: string; commentId?: string; suggestionId?: string };

export type CommandHandler<T extends EditorCommand = EditorCommand> = (command: T) => void;

export interface IEditorCommandBus {
  /** Dispatches an editor command to registered handlers */
  dispatch(command: EditorCommand): void;

  /** Subscribes to commands of a specific type */
  subscribe<K extends EditorCommand['type']>(
    type: K,
    handler: (command: Extract<EditorCommand, { type: K }>) => void,
  ): () => void;

  /** Subscribes to all commands */
  subscribeAll(handler: CommandHandler): () => void;
}
