/**
 * review.coordinator.ts
 *
 * Headless Review & Track Changes Coordinator (Coordinators Layer).
 *
 * Responsibilities:
 * - Single source of coordination between CodeMirror 6, Sidebar ReviewTab, and Backend Review/Suggestion Service.
 * - Handles navigation between comments/suggestions and editor line offsets.
 * - Dispatches single-click Accept and Reject mutations, updating editor state and document tree.
 * - Executes 0ms optimistic local document edits for instant user feedback.
 * - Bridges track changes view modes ('changes' | 'clean' | 'original') and review mode directly to CodeMirror.
 */

import { type EditorView } from '@codemirror/view';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { getActiveEditorEngine } from '@/features/editor/core/bus/engine-registry';
import {
  trackChangesStateField,
  resolveSuggestionRange,
  type TrackChangesViewMode,
} from '@/features/editor/subsystems/review/extensions/track-changes-state';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type {
  ReviewServicePort,
  ReviewNotificationPort,
  ReviewStorePort,
  ReviewCoordinatorPorts,
} from '@/features/editor/subsystems/review/model/review-service-port';
import {
  type SuggestionMemento,
  type ReviewRollbackSnapshot,
  mutateSuggestionInView,
  syncMutatedViewToCache,
  revertMementoInView,
  captureRollbackSnapshotForViews,
  applySnapshotToBuffers,
  reconcileAndDispatchReviewDecorations,
} from './suggestion-buffer-mutator';
import {
  type SuggestionResolutionHost,
  defaultReviewServicePort,
  defaultReviewNotificationPort,
  defaultReviewStorePort,
  scheduleLocalSuggestionCreate,
  executeResolveSingleSuggestion,
  executeResolveAllSuggestions,
  executeResolveSelectedSuggestions,
} from './suggestion-resolution.service';

export type { SuggestionMemento, ReviewRollbackSnapshot };

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
  private pendingConcurrentSuggestionUpdates = new Map<string, { pageId: string; sug: PageSuggestion }>();
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
    this.pendingConcurrentSuggestionUpdates.clear();
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

  public getReviewStatus(pageId?: string | null): string {
    const targetId = pageId || this.activePageId;
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

  private getResolutionHost(): SuggestionResolutionHost {
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
      pendingConcurrentUpdates: this.pendingConcurrentSuggestionUpdates,
      getViewsForFile: (fileId, fallback) => this.getViewsForFile(fileId, fallback),
      resolveKnownSuggestion: (id) => this.resolveKnownSuggestion(id),
      clearPendingPersistTimer: (id) => this.clearPendingPersistTimer(id),
      applySuggestionLocally: (v, sug, action) => this.applySuggestionLocally(v, sug, action),
      applyAllLocally: (action, pageId) => this.applyAllLocally(action, pageId),
      applySelectedLocally: (ids, action, pageId) => this.applySelectedLocally(ids, action, pageId),
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
      this.initiateComment(cmd.line, cmd.selectedText);
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
          const targetPageId = sug.pageId || cmd.pageId || this.activePageId || '';
          const normalizedSug: PageSuggestion = { ...sug, pageId: targetPageId };
          this.currentSuggestions.set(sug.id, normalizedSug);
          if (targetPageId && sug.id.startsWith('sug-local-')) {
            scheduleLocalSuggestionCreate(this.getResolutionHost(), targetPageId, normalizedSug);
          }
        }
      },
    };

    editorCommandBus.subscribe('editor:review-event', (cmd) => {
      const handler = reviewEventHandlers[cmd.event];
      if (handler) handler(cmd);
    });
  }

  public initiateComment(optLine?: number, optSelectedText?: string): void {
    const engine = getActiveEditorEngine();
    const sel = engine?.getSelection?.() as
      | { startLine?: number; endLine?: number; fromLine?: number; toLine?: number }
      | null
      | undefined;
    const cursor = engine?.getCursorPosition?.();

    const startLine = optLine ?? sel?.startLine ?? sel?.fromLine ?? cursor?.line ?? 1;
    const endLine = optLine ?? sel?.endLine ?? sel?.toLine ?? cursor?.line ?? 1;
    const selectedText = optSelectedText ?? engine?.getSelectedText?.() ?? '';

    this.storePort.setPendingComment({ startLine, endLine, selectedText });
    this.storePort.openReviewSidebar();
  }

  public bindEditorView(view: EditorView | null, pageId: string): void {
    if (!view) {
      this.unbindEditorView(null, pageId);
      return;
    }

    const isPageSwitch = this.activePageId !== null && this.activePageId !== pageId;
    this.lastBoundView = view;
    this.activePageId = pageId;

    let set = this.viewsByFileId.get(pageId);
    if (!set) {
      set = new Set<EditorView>();
      this.viewsByFileId.set(pageId, set);
    }
    set.add(view);

    if (isPageSwitch) {
      for (const [id, s] of this.currentSuggestions.entries()) {
        if (s.pageId && s.pageId !== pageId && !this.viewsByFileId.has(s.pageId)) {
          this.currentSuggestions.delete(id);
        } else if (!s.pageId) {
          this.currentSuggestions.delete(id);
        }
      }
      this.currentComments.clear();
    }

    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()).filter((s) => !s.pageId || s.pageId === pageId),
      Array.from(this.currentComments.values()).filter((c) => {
        const commentPageId = c.page || c.projectPageId;
        return !commentPageId || commentPageId === pageId;
      }),
      this.currentViewMode,
      this.currentReviewMode,
      pageId,
    );
  }

  public unbindEditorView(view: EditorView | null, pageId: string): void {
    const set = this.viewsByFileId.get(pageId);
    if (set) {
      if (view) set.delete(view);
      else set.clear();
      if (set.size === 0) this.viewsByFileId.delete(pageId);
    }

    if (view && this.lastBoundView === view) {
      this.lastBoundView = null;
      for (const [, views] of this.viewsByFileId.entries()) {
        for (const v of views) this.lastBoundView = v;
      }
    } else if (!view && this.activePageId === pageId && !this.viewsByFileId.has(pageId)) {
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

  public getLocalSuggestions(pageId?: string | null): PageSuggestion[] {
    const result: PageSuggestion[] = [];
    for (const s of this.currentSuggestions.values()) {
      if (s.id.startsWith('sug-local-') && (!pageId || !s.pageId || s.pageId === pageId)) {
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
    reviewMode: boolean = false,
    pageId?: string | null,
  ): void {
    const targetPageId = pageId ?? this.activePageId;
    this.currentViewMode = viewMode;
    this.currentReviewMode = reviewMode;
    const targetViews = this.getViewsForFile(targetPageId, view);

    reconcileAndDispatchReviewDecorations({
      targetPageId,
      suggestions,
      comments,
      viewMode,
      reviewMode,
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
    const memento = mutateSuggestionInView(view, sug, action);
    this.rollbackSnapshots.set(sug.id, memento);

    this.currentSuggestions.set(sug.id, {
      ...sug,
      status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
    });

    const targetPageId = sug.pageId || this.activePageId;
    syncMutatedViewToCache(view, targetPageId);

    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode,
      targetPageId,
    );
  }

  private resolveKnownSuggestion(suggestionId: string): PageSuggestion | undefined {
    const cached =
      this.currentSuggestions.get(suggestionId) ??
      (this.localToPersistedId.has(suggestionId)
        ? this.currentSuggestions.get(this.localToPersistedId.get(suggestionId)!)
        : undefined);
    if (cached) return cached;
    const stateSugs = this.activeView?.state.field(trackChangesStateField, false)?.suggestions || [];
    const mappedId = this.localToPersistedId.get(suggestionId);
    return stateSugs.find((s) => s.id === suggestionId || (mappedId && s.id === mappedId));
  }

  public rollbackSuggestionLocally(suggestionId: string): void {
    const effectiveId = this.localToPersistedId.get(suggestionId) ?? suggestionId;
    const snap = this.rollbackSnapshots.get(effectiveId) || this.rollbackSnapshots.get(suggestionId);
    if (!snap) return;
    this.rollbackSnapshots.delete(effectiveId);
    this.rollbackSnapshots.delete(suggestionId);

    revertMementoInView(snap, this.activePageId);

    this.currentSuggestions.set(snap.sug.id, { ...snap.sug, status: 'pending' });
    this.syncEditorDecorations(
      snap.view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode,
    );
  }

  public getRollbackSnapshot(pageId?: string): ReviewRollbackSnapshot {
    const targetPageId = pageId || this.activePageId;
    const targetViews = this.getViewsForFile(targetPageId, this.activeView);
    return captureRollbackSnapshotForViews(targetPageId, targetViews, this.currentSuggestions);
  }

  public restoreSnapshot(snapshot: ReviewRollbackSnapshot): void {
    applySnapshotToBuffers(snapshot);

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
    this.pendingConcurrentSuggestionUpdates.delete(suggestionId);
  }

  public applySuggestionByIdLocally(
    suggestionId: string,
    action: 'accept' | 'reject',
    targetPageId?: string,
  ): void {
    this.clearPendingPersistTimer(suggestionId);
    const sug = this.resolveKnownSuggestion(suggestionId);
    if (!sug) return;
    if (sug.id !== suggestionId) this.clearPendingPersistTimer(sug.id);

    const effectivePageId = targetPageId || sug.pageId;
    if (effectivePageId && this.activePageId && effectivePageId !== this.activePageId) {
      const registeredViews = this.viewsByFileId.get(effectivePageId);
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

    for (const view of this.getViewsForFile(effectivePageId, this.activeView)) {
      this.applySuggestionLocally(view, sug, action);
    }
  }

  public applyAllLocally(action: 'accept' | 'reject', pageId?: string): void {
    for (const [localId, timer] of this.pendingPersistTimers.entries()) {
      const localSug = this.currentSuggestions.get(localId);
      if (!pageId || !localSug?.pageId || localSug.pageId === pageId) {
        clearTimeout(timer);
        this.pendingPersistTimers.delete(localId);
        this.pendingConcurrentSuggestionUpdates.delete(localId);
      }
    }
    const targetViews = this.getViewsForFile(pageId, this.activeView);
    if (targetViews.length === 0) return;
    const primaryView = targetViews[0];
    const doc = primaryView.state.doc;
    const stateSugs = primaryView.state.field(trackChangesStateField, false)?.suggestions || [];
    for (const s of stateSugs) {
      if (!this.currentSuggestions.has(s.id)) this.currentSuggestions.set(s.id, s);
    }
    const pending = Array.from(this.currentSuggestions.values())
      .filter((s) => s.status === 'pending' && (!pageId || !s.pageId || s.pageId === pageId))
      .map((s) => ({ sug: s, range: resolveSuggestionRange(doc, s) }))
      .sort((a, b) => b.range.from - a.range.from);

    for (const item of pending) {
      for (const view of targetViews) this.applySuggestionLocally(view, item.sug, action);
    }
  }

  public applySelectedLocally(
    suggestionIds: string[],
    action: 'accept' | 'reject',
    pageId?: string,
  ): void {
    for (const rawId of suggestionIds) this.clearPendingPersistTimer(rawId);
    const targetViews = this.getViewsForFile(pageId, this.activeView);
    if (targetViews.length === 0 || !suggestionIds.length) return;
    const doc = targetViews[0].state.doc;
    const resolved: { sug: PageSuggestion; range: { from: number; to: number } }[] = [];
    const seen = new Set<string>();

    for (const rawId of suggestionIds) {
      const sug = this.resolveKnownSuggestion(rawId);
      if (sug && !seen.has(sug.id) && sug.status === 'pending') {
        seen.add(sug.id);
        resolved.push({ sug, range: resolveSuggestionRange(doc, sug) });
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

  public async acceptSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    return executeResolveSingleSuggestion(this.getResolutionHost(), pageId, suggestionId, 'accept');
  }

  public async rejectSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    return executeResolveSingleSuggestion(this.getResolutionHost(), pageId, suggestionId, 'reject');
  }

  public async acceptAll(pageId: string): Promise<boolean> {
    return executeResolveAllSuggestions(this.getResolutionHost(), pageId, 'accept');
  }

  public async rejectAll(pageId: string): Promise<boolean> {
    return executeResolveAllSuggestions(this.getResolutionHost(), pageId, 'reject');
  }

  public async acceptSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    return executeResolveSelectedSuggestions(this.getResolutionHost(), pageId, suggestionIds, 'accept');
  }

  public async rejectSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    return executeResolveSelectedSuggestions(this.getResolutionHost(), pageId, suggestionIds, 'reject');
  }
}

export const reviewCoordinator = new ReviewCoordinator();

editorCommandBus.subscribe('workspace:reset', () => {
  reviewCoordinator.reset();
});
