/**
 * command-bus.port.ts
 *
 * Core Port (Contract): Strongly-typed command definitions and event channels
 * bridging the Editor, Viewer, Compiler, and Sidebar without mutable refs.
 */

import type { LatexFormatType, DiffProposal } from '@/features/editor/domain/types/ports/editor-engine.port';
export type { LatexFormatType, DiffProposal };

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
  | 'matrix-wizard'
  | 'figure-wizard'
  | 'symbol-palette'
  | 'upload-file'
  | 'new-file'
  | 'new-folder'
  | 'rename-symbol'
  | 'rename-citation'
  | 'suggest-edit'
  | 'deleted-files'
  | 'add-files'
  | 'template-gallery'
  | 'history'
  | 'quick-open'
  | 'shortcuts'
  | 'github-sync'
  | 'project-settings';

import type { EditorDiagnosticItem } from '@/features/editor/domain/diagnostics/diagnostic-types';
export type { EditorDiagnosticItem };

export type EditorCommand =
  | { type: 'editor:jump-to-line'; line: number; highlight?: 'error' | 'synctex'; column?: number; length?: number }
  | { type: 'editor:set-content'; content: string }
  | { type: 'editor:insert-text'; text: string }
  | { type: 'editor:wrap-selection'; prefix: string; suffix: string; placeholder?: string }
  | { type: 'editor:format'; format: LatexFormatType }
  | { type: 'editor:undo' }
  | { type: 'editor:redo' }
  | { type: 'editor:focus' }
  | { type: 'editor:find'; open?: boolean }
  | { type: 'editor:split'; direction: 'vertical' | 'horizontal' | 'none'; fileId?: string }
  | { type: 'editor:open-to-side'; fileId: string; filePath?: string }
  | { type: 'editor:close-split' }
  | { type: 'editor:focus-pane'; paneId: 'primary' | 'secondary' }
  | { type: 'editor:swap-panes' }
  | { type: 'editor:autofix' }
  | { type: 'editor:lint-project'; projectId?: string }
  | { type: 'editor:insert-citation'; bibKey: string; textInserted?: boolean; entry?: Record<string, unknown> }
  | { type: 'editor:rename-citekey'; oldKey: string; newKey: string }
  | { type: 'editor:open-suggestion-widget'; suggestionId: string; x?: number; y?: number }
  | { type: 'editor:suggest-fix'; error: { message: string; line?: number; file?: string; context?: string } }
  | { type: 'editor:error-stepped'; errorIndex?: number; file?: string; line?: number; message?: string }
  | { type: 'editor:visual-command'; command: string; level?: 1 | 2 | 3; rows?: number; cols?: number; withHeaderRow?: boolean; contentHtml?: string }
  | { type: 'editor:review-event'; pageId: string; event: string; payload?: unknown }
  | { type: 'collab:presence-update'; collaborators: import('@/features/editor/core/store/collaboration.store').CollaboratorPresenceInfo[] }
  | { type: 'collab:user-joined'; collaborator: Partial<import('@/features/editor/core/store/collaboration.store').CollaboratorPresenceInfo> & { id: string } }
  | { type: 'collab:user-left'; userId: string }
  | {
      type: 'collab:cursor';
      userId: string;
      activeFileId?: string;
      activeFile?: string;
      cursor?: {
        line: number;
        column: number;
        selection?: {
          startLineNumber: number;
          startColumn?: number;
          endLineNumber: number;
          endColumn?: number;
        };
      };
    }
  | { type: 'compiler:trigger'; forceSync?: boolean; draft?: boolean; forceClean?: boolean; reason?: string }
  | { type: 'compiler:started' }
  | { type: 'compiler:progress'; status?: string; logs?: string[] }
  | { type: 'compiler:finished'; success: boolean; aborted?: boolean }
  | { type: 'viewer:goto-page'; page: number }
  | { type: 'viewer:jump-to-line'; line: number }
  | { type: 'viewer:scroll-to-coords'; page: number; y: number; x?: number; behavior?: ScrollBehavior }
  | { type: 'editor:scroll-to-line'; line: number; smooth?: boolean }
  | { type: 'sync:editor-scrolled'; line: number; totalLines?: number; fraction?: number }
  | { type: 'sync:viewer-scrolled'; page: number; y: number; fraction?: number }
  | { type: 'viewer:zoom-in' }
  | { type: 'viewer:zoom-out' }
  | { type: 'viewer:fit-width' }
  | { type: 'viewer:fit-height' }
  | { type: 'viewer:find'; query?: string; open?: boolean; caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }
  | { type: 'viewer:find-next' }
  | { type: 'viewer:find-prev' }
  | { type: 'preview:detach'; projectId?: string }
  | { type: 'preview:attach' }
  | { type: 'sidebar:toggle-panel'; panel: SidebarPanelName; forceOpen?: boolean }
  | { type: 'sidebar:open-panel'; panel: SidebarPanelName; query?: string; showReplace?: boolean; commentId?: string; suggestionId?: string; forceOpen?: boolean }
  | { type: 'sidebar:open-ai-panel'; initialPrompt?: string; selectedText?: string; forceOpen?: boolean }
  | { type: 'sidebar:toggle-ai-panel'; forceOpen?: boolean }
  | {
      type: 'dialog:open';
      dialog: DialogName;
      payload?: {
        initialQuery?: string;
        oldKey?: string;
        key?: string;
        initialTab?: string;
        initialLatex?: string;
        tab?: string;
        view?: string;
        forceOpen?: boolean;
        [key: string]: unknown;
      };
    }
  | { type: 'dialog:close'; dialog?: DialogName }
  | { type: 'synctex:forward'; line?: number; column?: number; filePath?: string; fileId?: string }
  | { type: 'synctex:backward'; page?: number; x?: number; y?: number }
  | { type: 'synctex:map-updated'; map: import('@/features/editor/subsystems/compiler/synctex/synctex-index').SyncTeXMap | null }
  | { type: 'document:content-updated'; docId: string; content: string }
  | { type: 'document:conflict'; docId: string; remoteContent: string; localContent: string }
  | { type: 'filetree:updated'; payload?: unknown }
  | { type: 'workspace:open-file'; fileId: string; filePath?: string; preview?: boolean }
  | { type: 'workspace:create-file'; name: string; folderId?: string | null; content?: string }
  | { type: 'workspace:rename-file'; fileId: string; oldPath: string; newPath: string }
  | { type: 'workspace:delete-file'; fileId: string; filePath?: string }
  | { type: 'workspace:restore-file'; fileId: string; projectId?: string }
  | { type: 'workspace:set-main-file'; fileId: string; projectId?: string }
  | { type: 'workspace:move-file'; fileId: string; targetFolderId: string | null }
  | { type: 'navigation:open-tab'; fileId: string; title: string; path?: string }
  | { type: 'navigation:close-tab'; fileId: string }
  | { type: 'navigation:jump-to-line'; fileId?: string; filePath?: string; line: number; column?: number; highlight?: 'error' | 'synctex' }
  | { type: 'navigation:next-error' }
  | { type: 'navigation:prev-error' }
  | { type: 'ai:request-completion'; prompt: string; context?: Record<string, unknown> }
  | { type: 'ai:apply-fix'; fileId: string; line?: number; replacement: string }
  | { type: 'ai:propose-diff'; proposal: DiffProposal }
  | { type: 'ai:accept-diff'; diffId?: string }
  | { type: 'ai:reject-diff'; diffId?: string }
  | { type: 'ai:autofix-diagnostic'; diagnostic: EditorDiagnosticItem }
  | {
      type: 'ai:diff-resolved';
      action: 'accept' | 'reject';
      proposalId?: string;
      proposal?: DiffProposal;
    }
  | { type: 'lifecycle:state-change'; state: 'hibernated' | 'active'; durationMs?: number }
  | { type: 'review:navigate-to-comment'; commentId: string; line?: number }
  | { type: 'review:navigate-to-change'; suggestionId: string; line?: number }
  | { type: 'review:accept-suggestion'; suggestionId: string }
  | { type: 'review:reject-suggestion'; suggestionId: string }
  | { type: 'review:create-comment'; line?: number; selectedText?: string }
  | { type: 'history:open'; initialVersion?: number; projectId?: string; baseVersion?: number; targetVersion?: number }
  | { type: 'history:open-modal'; initialVersion?: number; projectId?: string; baseVersion?: number; targetVersion?: number }
  | { type: 'citation:open-picker'; initialQuery?: string }
  | { type: 'citation:insert'; bibKey: string; entry?: Record<string, unknown> }
  | { type: 'citation:validate'; bibKey?: string }
  | { type: 'diagnostics:run-linter'; documentId?: string; content?: string }
  | { type: 'diagnostics:clear'; documentId?: string }
  | { type: 'diagnostics:set-items'; items: EditorDiagnosticItem[] }
  | { type: 'compiler:compile-draft'; reason?: string };

export type CommandHandler<T extends EditorCommand = EditorCommand, R = unknown> = (command: T) => R | Promise<R>;

export interface CommandTraceEntry {
  command: EditorCommand;
  timestamp: number;
  isExecute: boolean;
  durationMs?: number;
  error?: unknown;
}

export type CommandDispatchMiddleware = (
  command: EditorCommand,
  next: (command: EditorCommand) => void
) => void;

export type CommandExecuteMiddleware = <R = unknown>(
  command: EditorCommand,
  next: (command: EditorCommand) => Promise<R>
) => Promise<R>;

export interface CommandBusMiddleware {
  onDispatch?: CommandDispatchMiddleware;
  onExecute?: CommandExecuteMiddleware;
}

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
  registerExecutor<K extends EditorCommand['type'], R = unknown>(
    type: K,
    executor: (command: Extract<EditorCommand, { type: K }>) => Promise<R> | R,
  ): () => void;

  /** Subscribes to all commands */
  subscribeAll(handler: CommandHandler): () => void;

  /** Registers a middleware into the command bus pipeline */
  use(middleware: CommandBusMiddleware): () => void;

  /** Retrieves recent command traces (ring buffer) */
  getTraceHistory(limit?: number): CommandTraceEntry[];

  /** Clears recorded command traces */
  clearTraceHistory(): void;

  /** Enables or disables trace recording */
  enableTracing(enabled: boolean): void;

  /** Injects a custom error reporter */
  setErrorReporter(reporter: (error: unknown, command: EditorCommand) => void): void;
}
