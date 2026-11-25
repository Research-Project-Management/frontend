import type { EditorView } from '@codemirror/view';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { getActiveEditorEngine } from '@/features/editor/core/bus/engine-registry';
import { getActiveYjsProvider } from '@/features/editor/sdk/realtime/provider';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import {
  isLocalSuggestionId,
  resolveSuggestionRange,
  reviewStateField,
  type TrackChangesViewMode,
} from '../extensions/state';
import type {
  ReviewCoordinatorPorts,
  ReviewNotificationPort,
  ReviewServicePort,
  ReviewStorePort,
} from '../model/ports';
import {
  captureSnapshot,
  mutateSuggestion,
  restoreSnapshot,
  revertMemento,
  syncDecorations,
  syncViewToCache,
  type ReviewRollbackSnapshot,
  type SuggestionMemento,
} from './buffer';
import {
  defaultReviewNotificationPort,
  defaultReviewServicePort,
  defaultReviewStorePort,
  resolveAll,
  resolveOne,
  resolveSelected,
  scheduleLocalCreate,
  type ResolutionHost,
} from './resolver';

export type { ReviewRollbackSnapshot, SuggestionMemento };

export class ReviewCoordinator {
  private servicePort: ReviewServicePort = defaultReviewServicePort;
  private notificationPort: ReviewNotificationPort = defaultReviewNotificationPort;
  private storePort: ReviewStorePort = defaultReviewStorePort;
  private viewsByFileId = new Map<string, Set<EditorView>>();
  private lastBoundView: EditorView | null = null;
  private activePageId: string | null = null;

  private currentSuggestions = new Map<string, PageSuggestion>();
  private currentComments = new Map<string, PageComment>();
  private localToPersistedId = new Map<string, string>();
  private pendingPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private rollbackSnapshots = new Map<string, SuggestionMemento>();
  private readonly inFlightSuggestionCreates = new Set<string>();
  private readonly inFlightResolutions = new Set<string>();
  private currentViewMode: TrackChangesViewMode = 'changes';
  private currentReviewMode = false;
  private currentReviewStatuses = new Map<string, string>();
  private initialized = false;

  public get activeView(): EditorView | null {
    if (this.activePageId) {
      const views = this.viewsByFileId.get(this.activePageId);
      if (views && views.size > 0) {
        if (this.lastBoundView && views.has(this.lastBoundView)) {
          return this.lastBoundView;
        }
        let latest: EditorView | null = null;
        for (const v of views) latest = v;
        return latest;
      }
    }
    return this.lastBoundView;
  }

  public set activeView(view: EditorView | null) {
    this.lastBoundView = view;
  }

  private getViewsForFile(fileId?: string | null, fallbackView?: EditorView | null): EditorView[] {
    const result = new Set<EditorView>();
    if (fallbackView) result.add(fallbackView);
    const targetId = fileId || this.activePageId;
    if (targetId) {
      const views = this.viewsByFileId.get(targetId);
      if (views) {
        for (const v of views) result.add(v);
      }
    }
    if (result.size === 0 && this.activeView) {
      result.add(this.activeView);
    }
    return Array.from(result);
  }

  constructor(ports?: ReviewCoordinatorPorts) {
    if (ports) this.setPorts(ports);
    this.initSubscriptions();
  }

  public reset(): void {
    for (const timer of this.pendingPersistTimers.values()) clearTimeout(timer);
    this.pendingPersistTimers.clear();
    this.inFlightSuggestionCreates.clear();
    this.inFlightResolutions.clear();
    this.rollbackSnapshots.clear();
    this.currentSuggestions.clear();
    this.currentComments.clear();
    this.localToPersistedId.clear();
    this.currentReviewStatuses.clear();
    this.viewsByFileId.clear();
    this.lastBoundView = null;
    this.activePageId = null;
    this.currentViewMode = 'changes';
    this.currentReviewMode = false;
  }

  public getReviewStatus(docId?: string | null): string {
    const targetId = docId || this.activePageId;
    if (!targetId) return 'draft';
    return this.currentReviewStatuses.get(targetId) || 'draft';
  }

  public setPorts(ports: ReviewCoordinatorPorts): void {
    if (ports.service) this.servicePort = ports.service;
    if (ports.notification) this.notificationPort = ports.notification;
    if (ports.store) this.storePort = ports.store;
  }

  public resetPorts(): void {
    this.servicePort = defaultReviewServicePort;
    this.notificationPort = defaultReviewNotificationPort;
    this.storePort = defaultReviewStorePort;
  }

  private getResolutionHost(): ResolutionHost {
    return {
      getServicePort: () => this.servicePort,
      getNotificationPort: () => this.notificationPort,
      getActivePageId: () => this.activePageId,
      getActiveView: () => this.activeView,
      getViewMode: () => this.currentViewMode,
      getReviewMode: () => this.currentReviewMode,
      currentSuggestions: this.currentSuggestions,
      currentComments: this.currentComments,
      localToPersistedId: this.localToPersistedId,
      pendingPersistTimers: this.pendingPersistTimers,
      inFlightSuggestionCreates: this.inFlightSuggestionCreates,
      inFlightResolutions: this.inFlightResolutions,
      getViewsForFile: (fileId, fallback) => this.getViewsForFile(fileId, fallback),
      resolveKnownSuggestion: (id) => this.resolveKnownSuggestion(id),
      clearPendingPersistTimer: (id) => this.clearPendingPersistTimer(id),
      applySuggestionLocally: (v, sug, action) => this.applySuggestionLocally(v, sug, action),
      applyAllLocally: (action, docId) => this.applyAllLocally(action, docId),
      applySelectedLocally: (ids, action, docId) => this.applySelectedLocally(ids, action, docId),
      rollbackSuggestionLocally: (id) => this.rollbackSuggestionLocally(id),
      syncEditorDecorations: (v, sugs, comments, vm, rm, pid) =>
        this.syncEditorDecorations(v, sugs, comments, vm, rm, pid),
    };
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
      if (this.activePageId && cmd.suggestionId) {
        await this.acceptSuggestion(this.activePageId, cmd.suggestionId);
      }
    });
    editorCommandBus.subscribe('review:reject-suggestion', async (cmd) => {
      if (this.activePageId && cmd.suggestionId) {
        await this.rejectSuggestion(this.activePageId, cmd.suggestionId);
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
        const targetId = payload?.docId || cmd.pageId || this.activePageId;
        const nextStatus = payload?.review?.status;
        if (targetId && nextStatus) this.currentReviewStatuses.set(targetId, nextStatus);
      },
      'suggestion:rollback': (cmd) => {
        const payload = cmd.payload as { suggestionId?: string } | undefined;
        if (payload?.suggestionId) this.rollbackSuggestionLocally(payload.suggestionId);
      },
      'suggestion:local-recorded': (cmd) => {
        const sug = (cmd.payload as { suggestion?: PageSuggestion })?.suggestion;
        if (sug) {
          const targetDocId = sug.pageId || cmd.pageId || this.activePageId || '';
          const normalized: PageSuggestion = { ...sug, pageId: targetDocId };
          this.currentSuggestions.set(sug.id, normalized);
          if (targetDocId && isLocalSuggestionId(sug.id)) {
            scheduleLocalCreate(this.getResolutionHost(), targetDocId, normalized);
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

    this.storePort.setPendingComment({ startLine, endLine, selectedText });
    this.storePort.openReviewSidebar();
  }

  public bindEditorView(view: EditorView | null, docId: string): void {
    if (!view) {
      this.unbindEditorView(null, docId);
      return;
    }

    const isPageSwitch = this.activePageId !== null && this.activePageId !== docId;
    this.lastBoundView = view;
    this.activePageId = docId;

    let set = this.viewsByFileId.get(docId);
    if (!set) {
      set = new Set<EditorView>();
      this.viewsByFileId.set(docId, set);
    }
    set.add(view);

    if (isPageSwitch) {
      for (const [id, s] of this.currentSuggestions.entries()) {
        if (s.pageId && s.pageId !== docId && !this.viewsByFileId.has(s.pageId)) {
          this.currentSuggestions.delete(id);
        } else if (!s.pageId) {
          this.currentSuggestions.delete(id);
        }
      }
      this.currentComments.clear();
    }

    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()).filter((s) => !s.pageId || s.pageId === docId),
      Array.from(this.currentComments.values()).filter((c) => {
        const commentDocId = c.page || c.projectPageId;
        return !commentDocId || commentDocId === docId;
      }),
      this.currentViewMode,
      this.currentReviewMode,
      docId,
    );
  }

  public unbindEditorView(view: EditorView | null, docId: string): void {
    const set = this.viewsByFileId.get(docId);
    if (set) {
      if (view) set.delete(view);
      else set.clear();
      if (set.size === 0) this.viewsByFileId.delete(docId);
    }

    if (view && this.lastBoundView === view) {
      this.lastBoundView = null;
      for (const views of this.viewsByFileId.values()) {
        for (const v of views) this.lastBoundView = v;
      }
    } else if (!view && this.activePageId === docId && !this.viewsByFileId.has(docId)) {
      this.lastBoundView = null;
      for (const [fid, views] of this.viewsByFileId.entries()) {
        for (const v of views) {
          this.activePageId = fid;
          this.lastBoundView = v;
        }
      }
    }
  }

  public getSuggestion(suggestionId: string): PageSuggestion | undefined {
    return (
      this.currentSuggestions.get(suggestionId) ??
      (this.localToPersistedId.has(suggestionId)
        ? this.currentSuggestions.get(this.localToPersistedId.get(suggestionId)!)
        : undefined)
    );
  }

  public getLocalSuggestions(docId?: string | null): PageSuggestion[] {
    const result: PageSuggestion[] = [];
    for (const s of this.currentSuggestions.values()) {
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
    const targetDocId = docId ?? this.activePageId;
    const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
    this.currentViewMode = viewMode;
    this.currentReviewMode = reviewMode;
    const targetViews = this.getViewsForFile(targetDocId, view);

    syncDecorations({
      targetDocId,
      suggestions,
      comments,
      viewMode,
      reviewMode,
      yDoc,
      currentSuggestions: this.currentSuggestions,
      currentComments: this.currentComments,
      localToPersistedId: this.localToPersistedId,
      targetViews,
    });
  }

  public applySuggestionLocally(
    view: EditorView,
    sug: PageSuggestion,
    action: 'accept' | 'reject',
  ): void {
    const targetDocId = sug.pageId || this.activePageId;
    const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
    const memento = mutateSuggestion(view, sug, action, yDoc);
    this.rollbackSnapshots.set(sug.id, memento);

    this.currentSuggestions.set(sug.id, {
      ...sug,
      status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
    });

    syncViewToCache(view, targetDocId);

    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode,
      targetDocId,
    );
  }

  private resolveKnownSuggestion(suggestionId: string): PageSuggestion | undefined {
    const cached = this.getSuggestion(suggestionId);
    if (cached) return cached;
    const stateSugs = this.activeView?.state.field(reviewStateField, false)?.suggestions || [];
    const mappedId = this.localToPersistedId.get(suggestionId);
    return stateSugs.find((s) => s.id === suggestionId || (mappedId && s.id === mappedId));
  }

  public rollbackSuggestionLocally(suggestionId: string): void {
    const effectiveId = this.localToPersistedId.get(suggestionId) ?? suggestionId;
    const snap = this.rollbackSnapshots.get(effectiveId) || this.rollbackSnapshots.get(suggestionId);
    if (!snap) return;
    this.rollbackSnapshots.delete(effectiveId);
    this.rollbackSnapshots.delete(suggestionId);

    revertMemento(snap, this.activePageId);

    this.currentSuggestions.set(snap.sug.id, { ...snap.sug, status: 'pending' });
    this.syncEditorDecorations(
      snap.view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode,
    );
  }

  public getRollbackSnapshot(docId?: string): ReviewRollbackSnapshot {
    const targetDocId = docId || this.activePageId;
    const targetViews = this.getViewsForFile(targetDocId, this.activeView);
    return captureSnapshot(targetDocId, targetViews, this.currentSuggestions);
  }

  public restoreSnapshot(snapshot: ReviewRollbackSnapshot): void {
    restoreSnapshot(snapshot);

    this.currentSuggestions.clear();
    for (const [id, sug] of snapshot.suggestions) {
      this.currentSuggestions.set(id, { ...sug });
    }

    for (const { view } of snapshot.viewDocs) {
      this.syncEditorDecorations(
        view,
        Array.from(this.currentSuggestions.values()),
        Array.from(this.currentComments.values()),
        this.currentViewMode,
        this.currentReviewMode,
        snapshot.pageId,
      );
    }
  }

  private clearPendingPersistTimer(suggestionId: string): void {
    const timer = this.pendingPersistTimers.get(suggestionId);
    if (timer) {
      clearTimeout(timer);
      this.pendingPersistTimers.delete(suggestionId);
    }
  }

  public applySuggestionByIdLocally(
    suggestionId: string,
    action: 'accept' | 'reject',
    targetDocId?: string,
  ): void {
    this.clearPendingPersistTimer(suggestionId);
    const sug = this.resolveKnownSuggestion(suggestionId);
    if (!sug) return;
    if (sug.id !== suggestionId) this.clearPendingPersistTimer(sug.id);

    const effectiveDocId = targetDocId || sug.pageId;
    if (effectiveDocId && this.activePageId && effectiveDocId !== this.activePageId) {
      const registeredViews = this.viewsByFileId.get(effectiveDocId);
      if (registeredViews && registeredViews.size > 0) {
        for (const view of registeredViews) this.applySuggestionLocally(view, sug, action);
      } else {
        this.currentSuggestions.set(sug.id, {
          ...sug,
          status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
        });
      }
      return;
    }

    for (const view of this.getViewsForFile(effectiveDocId, this.activeView)) {
      this.applySuggestionLocally(view, sug, action);
    }
  }

  public applyAllLocally(action: 'accept' | 'reject', docId?: string): void {
    for (const [localId, timer] of this.pendingPersistTimers.entries()) {
      const localSug = this.currentSuggestions.get(localId);
      if (!docId || !localSug?.pageId || localSug.pageId === docId) {
        clearTimeout(timer);
        this.pendingPersistTimers.delete(localId);
      }
    }
    const targetViews = this.getViewsForFile(docId, this.activeView);
    if (targetViews.length === 0) return;
    const primaryView = targetViews[0];
    const doc = primaryView.state.doc;
    const stateSugs = primaryView.state.field(reviewStateField, false)?.suggestions || [];
    for (const s of stateSugs) {
      if (!this.currentSuggestions.has(s.id)) this.currentSuggestions.set(s.id, s);
    }
    const targetDocId = docId ?? this.activePageId;
    const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
    const pending = Array.from(this.currentSuggestions.values())
      .filter((s) => s.status === 'pending' && (!docId || !s.pageId || s.pageId === docId))
      .map((s) => ({ sug: s, range: resolveSuggestionRange(doc, s, yDoc) }))
      .sort((a, b) => b.range.from - a.range.from);

    for (const item of pending) {
      for (const view of targetViews) this.applySuggestionLocally(view, item.sug, action);
    }
  }

  public applySelectedLocally(
    suggestionIds: string[],
    action: 'accept' | 'reject',
    docId?: string,
  ): void {
    for (const rawId of suggestionIds) this.clearPendingPersistTimer(rawId);
    const targetViews = this.getViewsForFile(docId, this.activeView);
    if (targetViews.length === 0 || !suggestionIds.length) return;
    const doc = targetViews[0].state.doc;
    const resolved: { sug: PageSuggestion; range: { from: number; to: number } }[] = [];
    const seen = new Set<string>();

    const targetDocId = docId ?? this.activePageId;
    const yDoc = targetDocId ? getActiveYjsProvider(targetDocId)?.doc ?? null : null;
    for (const rawId of suggestionIds) {
      const sug = this.resolveKnownSuggestion(rawId);
      if (sug && !seen.has(sug.id) && sug.status === 'pending') {
        seen.add(sug.id);
        resolved.push({ sug, range: resolveSuggestionRange(doc, sug, yDoc) });
      }
    }
    resolved.sort((a, b) => b.range.from - a.range.from);

    for (const item of resolved) {
      for (const view of targetViews) this.applySuggestionLocally(view, item.sug, action);
    }
  }

  public navigateToLine(lineNum: number): void {
    if (this.activeView) {
      const doc = this.activeView.state.doc;
      const safeLine = Math.max(1, Math.min(lineNum, doc.lines));
      const line = doc.line(safeLine);
      this.activeView.dispatch({
        selection: { anchor: line.from, head: line.from },
        scrollIntoView: true,
      });
      this.activeView.focus();
      return;
    }

    const engine = getActiveEditorEngine();
    if (engine?.jumpToLine) engine.jumpToLine(lineNum, 'synctex');
  }

  public async acceptSuggestion(docId: string, suggestionId: string): Promise<boolean> {
    return resolveOne(this.getResolutionHost(), docId, suggestionId, 'accept');
  }

  public async rejectSuggestion(docId: string, suggestionId: string): Promise<boolean> {
    return resolveOne(this.getResolutionHost(), docId, suggestionId, 'reject');
  }

  public async acceptAll(docId: string): Promise<boolean> {
    return resolveAll(this.getResolutionHost(), docId, 'accept');
  }

  public async rejectAll(docId: string): Promise<boolean> {
    return resolveAll(this.getResolutionHost(), docId, 'reject');
  }

  public async acceptSelected(docId: string, suggestionIds: string[]): Promise<boolean> {
    return resolveSelected(this.getResolutionHost(), docId, suggestionIds, 'accept');
  }

  public async rejectSelected(docId: string, suggestionIds: string[]): Promise<boolean> {
    return resolveSelected(this.getResolutionHost(), docId, suggestionIds, 'reject');
  }
}

export const reviewCoordinator = new ReviewCoordinator();

editorCommandBus.subscribe('workspace:reset', () => {
  reviewCoordinator.reset();
});
