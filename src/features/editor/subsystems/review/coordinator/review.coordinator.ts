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
 * - Integrates with IEditorCommandBus for cross-component event decoupling.
 */

import { type EditorView } from '@codemirror/view';
import {
  editorCommandBus,
  getActiveEditorEngine,
  lruDocumentCache,
  sessionCoordinator,
  useDocumentCollaborationStore,
  useWorkspaceStore,
} from '@/features/editor/core';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { toast } from 'sonner';
import {
  trackChangesStateField,
  setTrackChangesSuggestionsEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  resolveSuggestionRange,
  type TrackChangesViewMode,
} from '@/features/editor/subsystems/review/extensions/track-changes.extension';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type {
  ReviewServicePort,
  ReviewNotificationPort,
  ReviewStorePort,
  ReviewCoordinatorPorts,
} from '@/features/editor/subsystems/review/model/review-service-port';

const defaultServicePort: ReviewServicePort = manuscriptService.suggestions;

const defaultNotificationPort: ReviewNotificationPort = {
  notifySuccess: (message: string, id?: string) => {
    toast.success(message, id ? { id } : undefined);
  },
  notifyError: (message: string, id?: string) => {
    toast.error(message, id ? { id } : undefined);
  },
};

const defaultStorePort: ReviewStorePort = {
  setPendingComment: (payload) => {
    useDocumentCollaborationStore.getState().setPendingComment(payload);
  },
  openReviewSidebar: () => {
    useWorkspaceStore.getState().setActiveSidebarTab('review');
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
  },
};

export interface SuggestionMemento {
  readonly view: EditorView;
  readonly range: { from: number; to: number };
  readonly postMutationTo: number;
  readonly originalText: string;
  readonly sug: PageSuggestion;
}

export interface ReviewRollbackSnapshot {
  readonly pageId: string | null;
  readonly viewDocs: Array<{ view: EditorView; text: string }>;
  readonly suggestions: Array<[string, PageSuggestion]>;
}

export class ReviewCoordinatorRegistry {
  private servicePort: ReviewServicePort = defaultServicePort;
  private notificationPort: ReviewNotificationPort = defaultNotificationPort;
  private storePort: ReviewStorePort = defaultStorePort;
  private viewsByFileId = new Map<string, Set<EditorView>>();
  private lastBoundView: EditorView | null = null;
  private activePageId: string | null = null;

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
  private currentSuggestions = new Map<string, PageSuggestion>();
  private currentComments = new Map<string, PageComment>();
  private localToPersistedId = new Map<string, string>();
  private pendingPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private rollbackSnapshots = new Map<string, SuggestionMemento>();
  private readonly inFlightSuggestionCreates = new Set<string>();
  private pendingConcurrentSuggestionUpdates = new Map<string, { pageId: string; sug: PageSuggestion }>();
  private currentViewMode: TrackChangesViewMode = 'changes';
  private currentReviewMode = false;
  private currentReviewStatuses = new Map<string, string>();
  private initialized = false;

  public getReviewStatus(pageId?: string | null): string {
    const targetId = pageId || this.activePageId;
    if (!targetId) return 'draft';
    return this.currentReviewStatuses.get(targetId) || 'draft';
  }

  constructor(ports?: ReviewCoordinatorPorts) {
    if (ports) {
      this.setPorts(ports);
    }
    this.initSubscriptions();
  }

  public setPorts(ports: ReviewCoordinatorPorts): void {
    if (ports.service) this.servicePort = ports.service;
    if (ports.notification) this.notificationPort = ports.notification;
    if (ports.store) this.storePort = ports.store;
  }

  public resetPorts(): void {
    this.servicePort = defaultServicePort;
    this.notificationPort = defaultNotificationPort;
    this.storePort = defaultStorePort;
  }

  private initSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // 1. Navigate to Comment Thread in Editor
    editorCommandBus.subscribe('review:navigate-to-comment', (cmd) => {
      if (cmd.line) {
        this.navigateToLine(cmd.line);
      }
    });

    // 2. Navigate to Track Change Suggestion in Editor
    editorCommandBus.subscribe('review:navigate-to-change', (cmd) => {
      if (cmd.line) {
        this.navigateToLine(cmd.line);
      }
    });

    // 3. Accept Suggestion via 1-Click
    editorCommandBus.subscribe('review:accept-suggestion', async (cmd) => {
      if (this.activePageId && cmd.suggestionId) {
        await this.acceptSuggestion(this.activePageId, cmd.suggestionId);
      }
    });

    // 4. Reject Suggestion via 1-Click
    editorCommandBus.subscribe('review:reject-suggestion', async (cmd) => {
      if (this.activePageId && cmd.suggestionId) {
        await this.rejectSuggestion(this.activePageId, cmd.suggestionId);
      }
    });

    // 5. Initiate new review comment from active selection or line
    editorCommandBus.subscribe('review:create-comment', (cmd) => {
      this.initiateComment(cmd.line, cmd.selectedText);
    });

    // 6. Dispatch table for `editor:review-event` notifications
    const reviewEventHandlers: Record<
      string,
      (cmd: { pageId?: string; payload?: unknown }) => void
    > = {
      'review:status-changed': (cmd) => {
        const payload = cmd.payload as
          | {
              docId?: string;
              review?: { status?: string; roundNumber?: number };
            }
          | undefined;
        const targetId = payload?.docId || cmd.pageId || this.activePageId;
        const nextStatus = payload?.review?.status;
        if (targetId && nextStatus) {
          this.currentReviewStatuses.set(targetId, nextStatus);
        }
      },
      'suggestion:rollback': (cmd) => {
        const payload = cmd.payload as { suggestionId?: string } | undefined;
        if (payload?.suggestionId) {
          this.rollbackSuggestionLocally(payload.suggestionId);
        }
      },
      'suggestion:local-recorded': (cmd) => {
        const sug = (cmd.payload as { suggestion?: PageSuggestion })?.suggestion;
        if (sug) {
          const targetPageId = sug.pageId || cmd.pageId || this.activePageId || '';
          const normalizedSug: PageSuggestion = {
            ...sug,
            pageId: targetPageId,
          };
          this.currentSuggestions.set(sug.id, normalizedSug);
          if (targetPageId && sug.id.startsWith('sug-local-')) {
            this.scheduleLocalSuggestionPersist(targetPageId, normalizedSug);
          }
        }
      },
    };

    editorCommandBus.subscribe('editor:review-event', (cmd) => {
      const handler = reviewEventHandlers[cmd.event];
      if (handler) {
        handler(cmd);
      }
    });
  }

  private scheduleLocalSuggestionPersist(pageId: string, sug: PageSuggestion): void {
    const existingTimer = this.pendingPersistTimers.get(sug.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (this.inFlightSuggestionCreates.has(sug.id) || this.localToPersistedId.has(sug.id)) {
      if (this.inFlightSuggestionCreates.has(sug.id)) {
        this.pendingConcurrentSuggestionUpdates.set(sug.id, { pageId, sug });
      }
      return;
    }

    const timer = setTimeout(() => {
      this.pendingPersistTimers.delete(sug.id);
      if (this.inFlightSuggestionCreates.has(sug.id) || this.localToPersistedId.has(sug.id)) {
        return;
      }
      const latest = this.currentSuggestions.get(sug.id) ?? sug;
      if (latest.status && latest.status !== 'pending') return;

      this.inFlightSuggestionCreates.add(sug.id);

      const createPayload = {
        pageId,
        type: latest.type,
        originalText: latest.originalText || '',
        suggestedText: latest.suggestedText || '',
        fromLine: latest.fromLine || 1,
        fromColumn: latest.fromColumn || 1,
        toLine: latest.toLine || latest.fromLine || 1,
        toColumn: latest.toColumn || 1,
        idempotencyKey: sug.id,
        silent: true,
      };

      const createPromise = this.servicePort.createSuggestion
        ? this.servicePort.createSuggestion(createPayload)
        : manuscriptService.suggestions.createSuggestion(createPayload);
      void createPromise.then((created) => {
          this.inFlightSuggestionCreates.delete(sug.id);
          this.pendingConcurrentSuggestionUpdates.delete(sug.id);
          if (!created?.id) return;
          this.localToPersistedId.set(sug.id, created.id);
          const currentLocal = this.currentSuggestions.get(sug.id);
          if (currentLocal) {
            this.currentSuggestions.delete(sug.id);
            const mergedPersisted: PageSuggestion = {
              ...currentLocal,
              ...created,
              id: created.id,
              pageId: created.pageId || pageId,
              status: currentLocal.status ?? created.status ?? 'pending',
            };
            this.currentSuggestions.set(created.id, mergedPersisted);

            // If user already accepted/rejected locally while create was in flight, sync resolution
            if (currentLocal.status === 'accepted') {
              void this.servicePort.acceptSuggestion(pageId, created.id).catch(() => {});
            } else if (currentLocal.status === 'rejected') {
              void this.servicePort.rejectSuggestion(pageId, created.id).catch(() => {});
            }
          }

          const targetViews = this.getViewsForFile(pageId);
          for (const v of targetViews) {
            try {
              v.dispatch({
                effects: [
                  setTrackChangesSuggestionsEffect.of(
                    Array.from(this.currentSuggestions.values()).filter(
                      (s) => !s.pageId || s.pageId === pageId
                    )
                  ),
                ],
              });
            } catch {
              // Ignore view dispatch errors if view was destroyed
            }
          }

          editorCommandBus.dispatch({
            type: 'editor:review-event',
            pageId,
            event: 'suggestion:persisted',
            payload: { localId: sug.id, suggestion: created },
          });
        })
        .catch((err) => {
          this.inFlightSuggestionCreates.delete(sug.id);
          this.pendingConcurrentSuggestionUpdates.delete(sug.id);
          console.debug('[ReviewCoordinator] Failed to persist local suggestion:', err);
        });
    }, 350);

    this.pendingPersistTimers.set(sug.id, timer);
  }

  /**
   * Initiates a new comment thread from the active editor selection or line
   */
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

    this.storePort.setPendingComment({
      startLine,
      endLine,
      selectedText,
    });
    this.storePort.openReviewSidebar();
  }

  /**
   * Registers current CodeMirror EditorView for live decoration updates.
   */
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
      Array.from(this.currentSuggestions.values()).filter(
        (s) => !s.pageId || s.pageId === pageId
      ),
      Array.from(this.currentComments.values()).filter((c) => {
        const commentPageId = c.page || c.projectPageId;
        return !commentPageId || commentPageId === pageId;
      }),
      this.currentViewMode,
      this.currentReviewMode,
      pageId
    );
  }

  /**
   * Unbinds a specific EditorView instance (or all views for a pageId when view is null)
   * without wiping out other active split-pane EditorViews.
   */
  public unbindEditorView(view: EditorView | null, pageId: string): void {
    const set = this.viewsByFileId.get(pageId);
    if (set) {
      if (view) {
        set.delete(view);
      } else {
        set.clear();
      }
      if (set.size === 0) {
        this.viewsByFileId.delete(pageId);
      }
    }

    if (view && this.lastBoundView === view) {
      this.lastBoundView = null;
      for (const [, views] of this.viewsByFileId.entries()) {
        for (const v of views) {
          this.lastBoundView = v;
        }
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

  /**
   * Retrieves currently cached suggestion by ID.
   */
  public getSuggestion(suggestionId: string): PageSuggestion | undefined {
    return (
      this.currentSuggestions.get(suggestionId) ??
      (this.localToPersistedId.has(suggestionId)
        ? this.currentSuggestions.get(this.localToPersistedId.get(suggestionId)!)
        : undefined)
    );
  }

  /**
   * Retrieves locally recorded suggestions (`sug-local-*`) for a document.
   */
  public getLocalSuggestions(pageId?: string | null): PageSuggestion[] {
    const result: PageSuggestion[] = [];
    for (const s of this.currentSuggestions.values()) {
      if (s.id.startsWith('sug-local-') && (!pageId || !s.pageId || s.pageId === pageId)) {
        result.push(s);
      }
    }
    return result;
  }

  /**
   * Updates CodeMirror Track Changes and Comments decorations in-place without editor reload.
   */
  public syncEditorDecorations(
    view: EditorView | null,
    suggestions: PageSuggestion[],
    comments: PageComment[],
    viewMode: TrackChangesViewMode = 'changes',
    reviewMode: boolean = false,
    pageId?: string | null
  ): void {
    const targetPageId = pageId ?? this.activePageId;
    const preservedLocal: PageSuggestion[] = [];
    for (const [id, s] of Array.from(this.currentSuggestions.entries())) {
      const matchesTarget = !targetPageId || !s.pageId || s.pageId === targetPageId;
      if (matchesTarget) {
        if (s.id.startsWith('sug-local-')) {
          preservedLocal.push(s);
        }
        this.currentSuggestions.delete(id);
      }
    }

    const scopedSuggestions: PageSuggestion[] = [];
    for (const s of suggestions) {
      if (!targetPageId || !s.pageId || s.pageId === targetPageId) {
        this.currentSuggestions.set(s.id, s);
        scopedSuggestions.push(s);
      }
    }
    for (const localSug of preservedLocal) {
      const persistedId = this.localToPersistedId.get(localSug.id);
      if (persistedId && this.currentSuggestions.has(persistedId)) {
        continue;
      }
      if (!this.currentSuggestions.has(localSug.id)) {
        this.currentSuggestions.set(localSug.id, localSug);
        scopedSuggestions.push(localSug);
      }
    }

    const mergedSuggestions = targetPageId
      ? scopedSuggestions
      : Array.from(this.currentSuggestions.values());

    for (const [id, c] of Array.from(this.currentComments.entries())) {
      const commentPageId = c.page || c.projectPageId;
      if (!targetPageId || !commentPageId || commentPageId === targetPageId) {
        this.currentComments.delete(id);
      }
    }
    const scopedComments: PageComment[] = [];
    for (const c of comments) {
      const commentPageId = c.page || c.projectPageId;
      if (!targetPageId || !commentPageId || commentPageId === targetPageId) {
        this.currentComments.set(c.id, c);
        scopedComments.push(c);
      }
    }
    this.currentViewMode = viewMode;
    this.currentReviewMode = reviewMode;

    const targetViews = this.getViewsForFile(targetPageId, view);
    if (targetViews.length === 0) return;

    for (const targetView of targetViews) {
      try {
        targetView.dispatch({
          effects: [
            setTrackChangesSuggestionsEffect.of(mergedSuggestions),
            setTrackChangesCommentsEffect.of(scopedComments),
            setTrackChangesViewModeEffect.of(viewMode),
            setTrackChangesReviewModeEffect.of(reviewMode),
          ],
        });
      } catch (err) {
        console.debug('[ReviewCoordinator] Failed to sync decorations:', err);
      }
    }
  }

  /**
   * Applies local optimistic text edits into CodeMirror for 0ms tactile responsiveness.
   */
  public applySuggestionLocally(
    view: EditorView,
    sug: PageSuggestion,
    action: 'accept' | 'reject'
  ): void {
    const doc = view.state.doc;
    const { from, to } = resolveSuggestionRange(doc, sug);
    const currentSlice = from < to && to <= doc.length ? doc.sliceString(from, to) : '';
    let postMutationTo = to;

    if (action === 'accept') {
      if (sug.type === 'delete') {
        // Text marked for deletion is permanently removed on accept
        if (from < to && to <= doc.length) {
          view.dispatch({
            changes: { from, to, insert: '' },
          });
          postMutationTo = from;
        }
      } else if (sug.type === 'replace' && sug.suggestedText !== undefined) {
        if (from < to && to <= doc.length && currentSlice !== sug.suggestedText) {
          view.dispatch({
            changes: { from, to, insert: sug.suggestedText },
          });
          postMutationTo = from + sug.suggestedText.length;
        }
      } else if (sug.type === 'insert' && sug.suggestedText) {
        if (from <= to && to <= doc.length && currentSlice !== sug.suggestedText) {
          view.dispatch({
            changes: { from, to: from, insert: sug.suggestedText },
          });
          postMutationTo = from + sug.suggestedText.length;
        }
      }
    } else {
      // action === 'reject'
      if (sug.type === 'insert') {
        // Proposed insertion is removed on reject
        if (from < to && to <= doc.length && (!sug.suggestedText || currentSlice === sug.suggestedText)) {
          view.dispatch({
            changes: { from, to, insert: '' },
          });
          postMutationTo = from;
        }
      } else if (sug.type === 'replace' && sug.originalText !== undefined) {
        if (from < to && to <= doc.length && currentSlice !== sug.originalText) {
          view.dispatch({
            changes: { from, to, insert: sug.originalText },
          });
          postMutationTo = from + sug.originalText.length;
        }
      } else if (sug.type === 'delete' && sug.originalText) {
        // If deleted text was already removed from doc (from === to), re-insert it on reject
        if (from === to && from <= doc.length) {
          view.dispatch({
            changes: { from, to: from, insert: sug.originalText },
          });
          postMutationTo = from + sug.originalText.length;
        }
      }
    }

    this.rollbackSnapshots.set(sug.id, {
      view,
      range: { from, to },
      postMutationTo,
      originalText: currentSlice,
      sug: { ...sug },
    });

    // Mark suggestion resolved in local cache
    const updatedSug = {
      ...sug,
      status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
    };
    this.currentSuggestions.set(sug.id, updatedSug);

    // Sync mutated view document back to LRU document cache and session coordinator if registered
    const targetPageId = sug.pageId || this.activePageId;
    if (targetPageId && lruDocumentCache.getModel(targetPageId)) {
      const nextText = view.state.doc.toString();
      lruDocumentCache.updateContent(targetPageId, nextText, true);
      sessionCoordinator.notifyContentChange(targetPageId, nextText);
    }

    // Update active view decorations immediately
    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode,
      targetPageId
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
    const { view, sug, range, postMutationTo, originalText } = snap;
    const doc = view.state.doc;
    const currentLen = doc.length;
    const safeFrom = Math.min(range.from, currentLen);
    const safeTo = Math.min(postMutationTo, currentLen);

    if (originalText !== undefined && (safeFrom !== safeTo || originalText.length > 0)) {
      view.dispatch({
        changes: { from: safeFrom, to: safeTo, insert: originalText },
      });
    }

    const targetPageId = sug.pageId || this.activePageId;
    if (targetPageId && lruDocumentCache.getModel(targetPageId)) {
      const revertedText = view.state.doc.toString();
      lruDocumentCache.updateContent(targetPageId, revertedText, true);
      sessionCoordinator.notifyContentChange(targetPageId, revertedText);
    }

    const restoredSug: PageSuggestion = { ...sug, status: 'pending' };
    this.currentSuggestions.set(sug.id, restoredSug);
    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode
    );
  }

  public getRollbackSnapshot(pageId?: string): ReviewRollbackSnapshot {
    const targetPageId = pageId || this.activePageId;
    const targetViews = this.getViewsForFile(targetPageId, this.activeView);
    return {
      pageId: targetPageId,
      viewDocs: targetViews.map((view) => ({
        view,
        text: view.state.doc.toString(),
      })),
      suggestions: Array.from(this.currentSuggestions.entries()).map(([id, sug]) => [
        id,
        { ...sug },
      ]),
    };
  }

  public restoreSnapshot(snapshot: ReviewRollbackSnapshot): void {
    for (const { view, text } of snapshot.viewDocs) {
      const currentText = view.state.doc.toString();
      if (currentText !== text) {
        view.dispatch({
          changes: { from: 0, to: currentText.length, insert: text },
        });
      }
    }

    if (snapshot.pageId && snapshot.viewDocs.length > 0 && lruDocumentCache.getModel(snapshot.pageId)) {
      const restoredText = snapshot.viewDocs[0].text;
      lruDocumentCache.updateContent(snapshot.pageId, restoredText, true);
      sessionCoordinator.notifyContentChange(snapshot.pageId, restoredText);
    }

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
        snapshot.pageId
      );
    }
  }

  public applySuggestionByIdLocally(
    suggestionId: string,
    action: 'accept' | 'reject',
    targetPageId?: string
  ): void {
    const sug = this.resolveKnownSuggestion(suggestionId);
    if (!sug) return;

    const effectivePageId = targetPageId || sug.pageId;
    if (effectivePageId && this.activePageId && effectivePageId !== this.activePageId) {
      // Only splice views specifically registered for effectivePageId (never fall back to this.activeView)
      const registeredViews = this.viewsByFileId.get(effectivePageId);
      if (registeredViews && registeredViews.size > 0) {
        for (const view of registeredViews) {
          this.applySuggestionLocally(view, sug, action);
        }
      } else {
        const updatedSug = {
          ...sug,
          status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
        };
        this.currentSuggestions.set(sug.id, updatedSug);
      }
      return;
    }

    const targetViews = this.getViewsForFile(effectivePageId, this.activeView);
    for (const view of targetViews) {
      this.applySuggestionLocally(view, sug, action);
    }
  }

  public applyAllLocally(action: 'accept' | 'reject', pageId?: string): void {
    const targetViews = this.getViewsForFile(pageId, this.activeView);
    if (targetViews.length === 0) return;
    const primaryView = targetViews[0];
    const doc = primaryView.state.doc;
    const stateSugs = primaryView.state.field(trackChangesStateField, false)?.suggestions || [];
    for (const s of stateSugs) {
      if (!this.currentSuggestions.has(s.id)) {
        this.currentSuggestions.set(s.id, s);
      }
    }
    const pending = Array.from(this.currentSuggestions.values())
      .filter((s) => s.status === 'pending' && (!pageId || !s.pageId || s.pageId === pageId))
      .map((s) => ({ sug: s, range: resolveSuggestionRange(doc, s) }))
      .sort((a, b) => b.range.from - a.range.from);

    for (const item of pending) {
      for (const view of targetViews) {
        this.applySuggestionLocally(view, item.sug, action);
      }
    }
  }

  public applySelectedLocally(
    suggestionIds: string[],
    action: 'accept' | 'reject',
    pageId?: string
  ): void {
    const targetViews = this.getViewsForFile(pageId, this.activeView);
    if (targetViews.length === 0 || !suggestionIds.length) return;
    const primaryView = targetViews[0];
    const doc = primaryView.state.doc;
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
      for (const view of targetViews) {
        this.applySuggestionLocally(view, item.sug, action);
      }
    }
  }

  /**
   * Scrolls CodeMirror view to specified 1-indexed line and sets cursor position.
   */
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
    if (engine?.jumpToLine) {
      engine.jumpToLine(lineNum, 'synctex');
      return;
    }
  }

  private async resolveSingleSuggestion(
    pageId: string,
    suggestionId: string,
    action: 'accept' | 'reject'
  ): Promise<boolean> {
    const pendingTimer = this.pendingPersistTimers.get(suggestionId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.pendingPersistTimers.delete(suggestionId);
    }

    const sug = this.resolveKnownSuggestion(suggestionId);
    if (sug) {
      const targetViews = this.getViewsForFile(pageId || sug.pageId, this.activeView);
      for (const view of targetViews) {
        this.applySuggestionLocally(view, sug, action);
      }
    }

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event = action === 'accept' ? 'suggestion:accepted' : 'suggestion:rejected';
    const effectiveId = this.localToPersistedId.get(suggestionId) ?? suggestionId;

    if (effectiveId.startsWith('sug-local-')) {
      this.notificationPort.notifySuccess(`Change ${pastTense}`, `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionId },
      });
      return true;
    }

    try {
      if (action === 'accept') {
        await this.servicePort.acceptSuggestion(pageId, effectiveId);
      } else {
        await this.servicePort.rejectSuggestion(pageId, effectiveId);
      }
      this.notificationPort.notifySuccess(`Change ${pastTense}`, `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionId: effectiveId },
      });
      return true;
    } catch (err: unknown) {
      this.rollbackSuggestionLocally(effectiveId);
      this.notificationPort.notifyError(
        (err as Error)?.message || `Failed to ${action} change`,
        `sug-${suggestionId}`
      );
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rollback',
        payload: { suggestionId: effectiveId },
      });
      return false;
    }
  }

  /**
   * Accepts a proposed track change and applies it permanently.
   */
  public async acceptSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    return this.resolveSingleSuggestion(pageId, suggestionId, 'accept');
  }

  /**
   * Rejects a proposed track change and reverts it.
   */
  public async rejectSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    return this.resolveSingleSuggestion(pageId, suggestionId, 'reject');
  }

  private async resolveAllSuggestions(
    pageId: string,
    action: 'accept' | 'reject'
  ): Promise<boolean> {
    for (const [localId, timer] of this.pendingPersistTimers.entries()) {
      clearTimeout(timer);
      this.pendingPersistTimers.delete(localId);
    }

    this.applyAllLocally(action, pageId);

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event = action === 'accept' ? 'suggestion:accepted-all' : 'suggestion:rejected-all';

    try {
      if (action === 'accept') {
        await this.servicePort.acceptAllSuggestions(pageId);
      } else {
        await this.servicePort.rejectAllSuggestions(pageId);
      }
      this.notificationPort.notifySuccess(`All changes ${pastTense}`, 'sug-bulk');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError(
        (err as Error)?.message || `Failed to ${action} all changes`,
        'sug-bulk'
      );
      return false;
    }
  }

  /**
   * Bulk accepts all pending changes in a document.
   */
  public async acceptAll(pageId: string): Promise<boolean> {
    return this.resolveAllSuggestions(pageId, 'accept');
  }

  /**
   * Bulk rejects all pending changes in a document.
   */
  public async rejectAll(pageId: string): Promise<boolean> {
    return this.resolveAllSuggestions(pageId, 'reject');
  }

  private async resolveSelectedSuggestions(
    pageId: string,
    suggestionIds: string[],
    action: 'accept' | 'reject'
  ): Promise<boolean> {
    if (!suggestionIds || suggestionIds.length === 0) return true;

    for (const id of suggestionIds) {
      const timer = this.pendingPersistTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.pendingPersistTimers.delete(id);
      }
    }

    this.applySelectedLocally(suggestionIds, action, pageId);

    const persistedIds = suggestionIds
      .map((id) => this.localToPersistedId.get(id) ?? id)
      .filter((id) => !id.startsWith('sug-local-'));

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event =
      action === 'accept' ? 'suggestion:accepted-selected' : 'suggestion:rejected-selected';

    if (persistedIds.length === 0) {
      this.notificationPort.notifySuccess(`${suggestionIds.length} changes ${pastTense}`, 'sug-bulk');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionIds },
      });
      return true;
    }

    try {
      if (action === 'accept') {
        await this.servicePort.acceptSelectedSuggestions(pageId, persistedIds);
      } else {
        await this.servicePort.rejectSelectedSuggestions(pageId, persistedIds);
      }
      this.notificationPort.notifySuccess(`${suggestionIds.length} changes ${pastTense}`, 'sug-bulk');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionIds: persistedIds },
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError(
        (err as Error)?.message || `Failed to ${action} selected changes`,
        'sug-bulk'
      );
      return false;
    }
  }

  /**
   * Bulk accepts selected pending changes in a document.
   */
  public async acceptSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    return this.resolveSelectedSuggestions(pageId, suggestionIds, 'accept');
  }

  /**
   * Bulk rejects selected pending changes in a document.
   */
  public async rejectSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    return this.resolveSelectedSuggestions(pageId, suggestionIds, 'reject');
  }
}

export const reviewCoordinator = new ReviewCoordinatorRegistry();
