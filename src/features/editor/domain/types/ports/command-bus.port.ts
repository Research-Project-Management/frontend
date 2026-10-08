/**
 * command-bus.port.ts
 *
 * Core Port (Contract): Strongly-typed command definitions and event channels
 * bridging the Editor, Viewer, Compiler, and Sidebar without mutable refs.
 */

import type { LatexFormatType, DiffProposal } from './editor-engine.port';

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

export type DialogName =
  | 'word-count'
  | 'citation-picker'
  | 'table-wizard'
  | 'figure-wizard'
  | 'symbol-palette'
  | 'upload-file'
  | 'new-file'
  | 'new-folder'
  | 'rename-symbol'
  | 'suggest-edit'
  | 'deleted-files'
  | 'add-files'
  | 'template-gallery';

export type EditorCommand =
  | { type: 'editor:jump-to-line'; line: number; highlight?: 'error' | 'synctex' }
  | { type: 'editor:set-content'; content: string }
  | { type: 'editor:insert-text'; text: string }
  | { type: 'editor:wrap-selection'; prefix: string; suffix: string; placeholder?: string }
  | { type: 'editor:format'; format: LatexFormatType }
  | { type: 'editor:undo' }
  | { type: 'editor:redo' }
  | { type: 'editor:focus' }
  | { type: 'editor:find'; open?: boolean }
  | { type: 'editor:autofix' }
  | { type: 'editor:lint-project'; projectId?: string }
  | { type: 'editor:insert-citation'; bibKey: string; textInserted?: boolean; entry?: any }
  | { type: 'editor:open-suggestion-widget'; suggestionId: string; x?: number; y?: number }
  | { type: 'editor:suggest-fix'; error: { message: string; line?: number; file?: string; context?: string } }
  | { type: 'editor:visual-command'; command: string; level?: 1 | 2 | 3; rows?: number; cols?: number; withHeaderRow?: boolean; contentHtml?: string }
  | { type: 'editor:review-event'; pageId: string; event: string; payload?: any }
  | { type: 'compiler:trigger'; forceSync?: boolean; draft?: boolean }
  | { type: 'compiler:started' }
  | { type: 'compiler:progress'; status?: string; logs?: string[] }
  | { type: 'compiler:finished'; success: boolean; aborted?: boolean }
  | { type: 'viewer:goto-page'; page: number }
  | { type: 'viewer:jump-to-line'; line: number }
  | { type: 'viewer:scroll-to-coords'; page: number; x: number; y: number }
  | { type: 'viewer:zoom-in' }
  | { type: 'viewer:zoom-out' }
  | { type: 'viewer:fit-width' }
  | { type: 'viewer:fit-height' }
  | { type: 'sidebar:toggle-panel'; panel: SidebarPanelName }
  | { type: 'sidebar:open-panel'; panel: SidebarPanelName; query?: string; commentId?: string; suggestionId?: string }
  | { type: 'sidebar:open-ai-panel'; initialPrompt?: string; selectedText?: string }
  | { type: 'sidebar:toggle-ai-panel' }
  | { type: 'dialog:open'; dialog: DialogName; payload?: any }
  | { type: 'dialog:close'; dialog?: DialogName }
  | { type: 'synctex:forward'; line?: number; column?: number }
  | { type: 'synctex:backward'; page?: number; x?: number; y?: number }
  | { type: 'document:content-updated'; docId: string; content: string }
  | { type: 'document:conflict'; docId: string; remoteContent: string; localContent: string }
  | { type: 'filetree:updated'; payload?: any }
  | { type: 'workspace:open-file'; fileId: string; filePath?: string; preview?: boolean }
  | { type: 'workspace:create-file'; name: string; folderId?: string | null; content?: string }
  | { type: 'workspace:rename-file'; fileId: string; oldPath: string; newPath: string }
  | { type: 'workspace:delete-file'; fileId: string; filePath?: string }
  | { type: 'workspace:move-file'; fileId: string; targetFolderId: string | null }
  | { type: 'navigation:open-tab'; fileId: string; title: string; path?: string }
  | { type: 'navigation:close-tab'; fileId: string }
  | { type: 'navigation:jump-to-line'; fileId?: string; filePath?: string; line: number; column?: number; highlight?: 'error' | 'synctex' }
  | { type: 'navigation:next-error' }
  | { type: 'navigation:prev-error' }
  | { type: 'ai:request-completion'; prompt: string; context?: any }
  | { type: 'ai:apply-fix'; fileId: string; line?: number; replacement: string }
  | { type: 'ai:propose-diff'; proposal: DiffProposal }
  | { type: 'ai:accept-diff'; diffId?: string }
  | { type: 'ai:reject-diff'; diffId?: string }
  | { type: 'ai:autofix-diagnostic'; diagnostic: any }
  | {
      type: 'ai:diff-resolved';
      action?: 'accept' | 'reject';
      proposalId?: string;
      proposal?: DiffProposal;
      payload?: { action: 'accept' | 'reject'; proposalId?: string; proposal?: DiffProposal };
    }
  | { type: 'lifecycle:state-change'; state: 'hibernated' | 'active'; durationMs?: number };

export type CommandHandler<T extends EditorCommand = EditorCommand, R = any> = (command: T) => R | Promise<R>;

export interface IEditorCommandBus {
  /** Dispatches an editor command to registered handlers (fire-and-forget) */
  dispatch(command: EditorCommand): void;

  /** Executes an editor command and awaits the return value from the primary handler */
  execute<R = void>(command: EditorCommand): Promise<R>;

  /** Subscribes to commands of a specific type */
  subscribe<K extends EditorCommand['type']>(
    type: K,
    handler: (command: Extract<EditorCommand, { type: K }>) => void,
  ): () => void;

  /** Registers a primary command executor that returns a result */
  registerExecutor<K extends EditorCommand['type'], R = any>(
    type: K,
    executor: (command: Extract<EditorCommand, { type: K }>) => Promise<R> | R,
  ): () => void;

  /** Subscribes to all commands */
  subscribeAll(handler: CommandHandler): () => void;
}
