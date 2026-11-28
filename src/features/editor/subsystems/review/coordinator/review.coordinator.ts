import type { EditorView } from '@codemirror/view';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { getActiveEditorEngine } from '@/features/editor/core/bus/engine-registry';
import { useDocumentCollaborationStore } from '@/features/editor/core/store/collaboration.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import {
  isLocalSuggestionId,
  type TrackChangesViewMode,
} from '../extensions/state';
import {
  defaultReviewServicePort,
  getActiveViewFromState,
  resolveAll,
  resolveOne,
  resolveSelected,
  rollbackSuggestionInState,
  scheduleLocalCreate,
  syncStateDecorations,
  type ReviewCoordinatorState,
  type ReviewServicePort,
} from './resolver';

export type { ReviewServicePort };

export interface ReviewCoordinatorOptions {
  service?: ReviewServicePort;
}

function isServicePort(
  input: ReviewServicePort | ReviewCoordinatorOptions | undefined,
): input is ReviewServicePort {
  return Boolean(input && typeof (input as ReviewServicePort).acceptSuggestion === 'function');
}

export class ReviewCoordinator {
  private readonly state: ReviewCoordinatorState = {
    servicePort: defaultReviewServicePort,
    viewsByFileId: new Map(),
    lastBoundView: null,
    activePageId: null,
    currentViewMode: 'changes',
    currentReviewMode: false,
    currentSuggestions: new Map(),
    currentComments: new Map(),
    localToPersistedId: new Map(),
    pendingPersistTimers: new Map(),
    rollbackSnapshots: new Map(),
    inFlightSuggestionCreates: new Set(),
    inFlightResolutions: new Set(),
    currentReviewStatuses: new Map(),
  };
  private initialized = false;

  public get activeView(): EditorView | null {
    return getActiveViewFromState(this.state);
  }

  public set activeView(view: EditorView | null) {
    this.state.lastBoundView = view;
  }

  constructor(options?: ReviewServicePort | ReviewCoordinatorOptions) {
    if (options) {
      this.setPorts(isServicePort(options) ? { service: options } : options);
    }
    this.initSubscriptions();
  }

  public reset(): void {
    for (const timer of this.state.pendingPersistTimers.values()) clearTimeout(timer);
    this.state.pendingPersistTimers.clear();
    this.state.inFlightSuggestionCreates.clear();
    this.state.inFlightResolutions.clear();
    this.state.rollbackSnapshots.clear();
    this.state.currentSuggestions.clear();
    this.state.currentComments.clear();
    this.state.localToPersistedId.clear();
    this.state.currentReviewStatuses.clear();
    this.state.viewsByFileId.clear();
    this.state.lastBoundView = null;
    this.state.activePageId = null;
    this.state.currentViewMode = 'changes';
    this.state.currentReviewMode = false;
  }

  public getReviewStatus(docId?: string | null): string {
    const targetId = docId || this.state.activePageId;
    if (!targetId) return 'draft';
    return this.state.currentReviewStatuses.get(targetId) || 'draft';
  }

  public setPorts(ports: ReviewCoordinatorOptions): void {
    if (ports.service) this.state.servicePort = ports.service;
  }

  public resetPorts(): void {
    this.state.servicePort = defaultReviewServicePort;
  }

  private initSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    editorCommandBus.subscribe('review:navigate-to-comment', (cmd) => {
      if (cmd.line) this.navigateToLine(cmd.line);
    });
    editorCommandBus.subscribe('review:navigate-to-change', (cmd) => {
      if (cmd.line) this.navigateToLine(cmd.line);
    });
    editorCommandBus.subscribe('review:accept-suggestion', async (cmd) => {
      if (this.state.activePageId && cmd.suggestionId) {
        await this.acceptSuggestion(this.state.activePageId, cmd.suggestionId);
      }
    });
    editorCommandBus.subscribe('review:reject-suggestion', async (cmd) => {
      if (this.state.activePageId && cmd.suggestionId) {
        await this.rejectSuggestion(this.state.activePageId, cmd.suggestionId);
      }
    });
    editorCommandBus.subscribe('review:create-comment', (cmd) => {
      this.initiateComment(cmd.line, cmd.selectedText, cmd.endLine);
    });

    const reviewEventHandlers: Record<
      string,
      (cmd: { pageId?: string; payload?: unknown }) => void
    > = {
      'review:status-changed': (cmd) => {
        const payload = cmd.payload as
          | { docId?: string; review?: { status?: string; roundNumber?: number } }
          | undefined;
        const targetId = payload?.docId || cmd.pageId || this.state.activePageId;
        const nextStatus = payload?.review?.status;
        if (targetId && nextStatus) this.state.currentReviewStatuses.set(targetId, nextStatus);
      },
      'suggestion:rollback': (cmd) => {
        const payload = cmd.payload as { suggestionId?: string } | undefined;
        if (payload?.suggestionId) this.rollbackSuggestionLocally(payload.suggestionId);
      },
      'suggestion:local-recorded': (cmd) => {
        const sug = (cmd.payload as { suggestion?: PageSuggestion })?.suggestion;
        if (sug) {
          const targetDocId = sug.pageId || cmd.pageId || this.state.activePageId || '';
          const normalized: PageSuggestion = { ...sug, pageId: targetDocId };
          this.state.currentSuggestions.set(sug.id, normalized);
          if (targetDocId && isLocalSuggestionId(sug.id)) {
            scheduleLocalCreate(this.state, targetDocId, normalized);
          }
        }
      },
    };

    editorCommandBus.subscribe('editor:review-event', (cmd) => {
      const handler = reviewEventHandlers[cmd.event];
      if (handler) handler(cmd);
    });
  }

  public initiateComment(optLine?: number, optSelectedText?: string, optEndLine?: number): void {
    const engine = getActiveEditorEngine();
    const sel = engine?.getSelection?.() as
      | { startLine?: number; endLine?: number; fromLine?: number; toLine?: number }
      | null
      | undefined;
    const cursor = engine?.getCursorPosition?.();

    const startLine = optLine ?? sel?.startLine ?? sel?.fromLine ?? cursor?.line ?? 1;
    const endLine = optEndLine ?? optLine ?? sel?.endLine ?? sel?.toLine ?? cursor?.line ?? 1;
    const selectedText = optSelectedText ?? engine?.getSelectedText?.() ?? '';

    useDocumentCollaborationStore.getState().setPendingComment({
      startLine,
      endLine,
      selectedText,
    });
    useWorkspaceStore.getState().setActiveSidebarTab('review');
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
  }

  public bindEditorView(view: EditorView | null, docId: string): void {
    if (!view) {
      this.unbindEditorView(null, docId);
      return;
    }

    const isPageSwitch = this.state.activePageId !== null && this.state.activePageId !== docId;
    this.state.lastBoundView = view;
    this.state.activePageId = docId;

    let set = this.state.viewsByFileId.get(docId);
    if (!set) {
      set = new Set<EditorView>();
      this.state.viewsByFileId.set(docId, set);
    }
    set.add(view);

    if (isPageSwitch) {
      for (const [id, s] of this.state.currentSuggestions.entries()) {
        if (s.pageId && s.pageId !== docId && !this.state.viewsByFileId.has(s.pageId)) {
          this.state.currentSuggestions.delete(id);
        } else if (!s.pageId) {
          this.state.currentSuggestions.delete(id);
        }
      }
      this.state.currentComments.clear();
    }

    this.syncEditorDecorations(
      view,
      Array.from(this.state.currentSuggestions.values()).filter(
        (s) => !s.pageId || s.pageId === docId,
      ),
      Array.from(this.state.currentComments.values()).filter((c) => {
        const commentDocId = c.page || c.projectPageId;
        return !commentDocId || commentDocId === docId;
      }),
      this.state.currentViewMode,
      this.state.currentReviewMode,
      docId,
    );
  }

  public unbindEditorView(view: EditorView | null, docId: string): void {
    const set = this.state.viewsByFileId.get(docId);
    if (set) {
      if (view) set.delete(view);
      else set.clear();
      if (set.size === 0) this.state.viewsByFileId.delete(docId);
    }

    if (view && this.state.lastBoundView === view) {
      this.state.lastBoundView = null;
      for (const views of this.state.viewsByFileId.values()) {
        for (const v of views) this.state.lastBoundView = v;
      }
    } else if (
      !view &&
      this.state.activePageId === docId &&
      !this.state.viewsByFileId.has(docId)
    ) {
      this.state.lastBoundView = null;
      for (const [fid, views] of this.state.viewsByFileId.entries()) {
        for (const v of views) {
          this.state.activePageId = fid;
          this.state.lastBoundView = v;
        }
      }
    }
  }

  public getSuggestion(suggestionId: string): PageSuggestion | undefined {
    return (
      this.state.currentSuggestions.get(suggestionId) ??
      (this.state.localToPersistedId.has(suggestionId)
        ? this.state.currentSuggestions.get(this.state.localToPersistedId.get(suggestionId)!)
        : undefined)
    );
  }

  public getLocalSuggestions(docId?: string | null): PageSuggestion[] {
    const result: PageSuggestion[] = [];
    for (const s of this.state.currentSuggestions.values()) {
      if (isLocalSuggestionId(s.id) && (!docId || !s.pageId || s.pageId === docId)) {
        result.push(s);
      }
    }
    return result;
  }

  public syncEditorDecorations(
    view: EditorView | null,
    suggestions: PageSuggestion[],
    comments: PageComment[],
    viewMode: TrackChangesViewMode = 'changes',
    reviewMode = false,
    docId?: string | null,
  ): void {
    syncStateDecorations(this.state, view, suggestions, comments, viewMode, reviewMode, docId);
  }

  public rollbackSuggestionLocally(suggestionId: string): void {
    rollbackSuggestionInState(this.state, suggestionId);
  }

  public navigateToLine(lineNum: number): void {
    const activeView = this.activeView;
    if (activeView) {
      const doc = activeView.state.doc;
      const safeLine = Math.max(1, Math.min(lineNum, doc.lines));
      const line = doc.line(safeLine);
      activeView.dispatch({
        selection: { anchor: line.from, head: line.from },
        scrollIntoView: true,
      });
      activeView.focus();
      return;
    }

    const engine = getActiveEditorEngine();
    if (engine?.jumpToLine) engine.jumpToLine(lineNum, 'synctex');
  }

  public async acceptSuggestion(docId: string, suggestionId: string): Promise<boolean> {
    return resolveOne(this.state, docId, suggestionId, 'accept');
  }

  public async rejectSuggestion(docId: string, suggestionId: string): Promise<boolean> {
    return resolveOne(this.state, docId, suggestionId, 'reject');
  }

  public async acceptAll(docId: string): Promise<boolean> {
    return resolveAll(this.state, docId, 'accept');
  }

  public async rejectAll(docId: string): Promise<boolean> {
    return resolveAll(this.state, docId, 'reject');
  }

  public async acceptSelected(docId: string, suggestionIds: string[]): Promise<boolean> {
    return resolveSelected(this.state, docId, suggestionIds, 'accept');
  }

  public async rejectSelected(docId: string, suggestionIds: string[]): Promise<boolean> {
    return resolveSelected(this.state, docId, suggestionIds, 'reject');
  }
}

export const reviewCoordinator = new ReviewCoordinator();

editorCommandBus.subscribe('workspace:reset', () => {
  reviewCoordinator.reset();
});
