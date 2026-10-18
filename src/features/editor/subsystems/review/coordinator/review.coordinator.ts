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
import { editorCommandBus, getActiveEditorEngine } from '@/features/editor/core';
import { suggestionService } from '@/features/editor/sdk/manuscript.service';
import { toast } from 'sonner';
import {
  type ReviewServicePort,
  type ReviewNotificationPort,
  type ReviewStorePort,
} from '@/features/editor/subsystems/review/model/review-service-port';
import { useDocumentCollaborationStore } from '@/features/editor/core';
import { useLayoutStore } from '@/features/editor/core';
import {
  trackChangesStateField,
  setTrackChangesSuggestionsEffect,
  setTrackChangesCommentsEffect,
  setTrackChangesViewModeEffect,
  setTrackChangesReviewModeEffect,
  getSafeOffset,
  resolveSuggestionRange,
  type TrackChangesViewMode,
} from '@/features/editor/subsystems/review/extensions/track-changes.extension';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';

export const defaultReviewServicePort: ReviewServicePort = {
  acceptSuggestion: (pageId, suggestionId) => suggestionService.acceptSuggestion(pageId, suggestionId),
  rejectSuggestion: (pageId, suggestionId) => suggestionService.rejectSuggestion(pageId, suggestionId),
  acceptAllSuggestions: (pageId) => suggestionService.acceptAllSuggestions(pageId),
  rejectAllSuggestions: (pageId) => suggestionService.rejectAllSuggestions(pageId),
  acceptSelectedSuggestions: (pageId, suggestionIds) => suggestionService.acceptSelectedSuggestions(pageId, suggestionIds),
  rejectSelectedSuggestions: (pageId, suggestionIds) => suggestionService.rejectSelectedSuggestions(pageId, suggestionIds),
};

export const defaultReviewNotificationPort: ReviewNotificationPort = {
  notifySuccess: (message, id) => toast.success(message, id ? { id } : undefined),
  notifyError: (message, id) => toast.error(message, id ? { id } : undefined),
};

export const defaultReviewStorePort: ReviewStorePort = {
  setPendingComment: (comment) => {
    if (comment) {
      useDocumentCollaborationStore.getState().setPendingComment(comment);
    } else {
      useDocumentCollaborationStore.getState().clearPendingComment();
    }
  },
  openReviewSidebar: () => {
    useLayoutStore.getState().setActiveSidebarTab('review');
    useLayoutStore.getState().setSidebarLeftOpen(true);
  },
};

export const noopReviewNotificationPort: ReviewNotificationPort = {
  notifySuccess: () => {},
  notifyError: () => {},
};

export const noopReviewStorePort: ReviewStorePort = {
  setPendingComment: () => {},
  openReviewSidebar: () => {},
};

export interface ReviewCoordinatorPorts {
  service?: ReviewServicePort;
  notification?: ReviewNotificationPort;
  store?: ReviewStorePort;
}

export class ReviewCoordinatorRegistry {
  private activeView: EditorView | null = null;
  private activePageId: string | null = null;
  private currentSuggestions = new Map<string, PageSuggestion>();
  private currentComments = new Map<string, PageComment>();
  private currentViewMode: TrackChangesViewMode = 'changes';
  private currentReviewMode = false;
  private initialized = false;
  private servicePort: ReviewServicePort;
  private notificationPort: ReviewNotificationPort;
  private storePort: ReviewStorePort;

  constructor(ports?: ReviewCoordinatorPorts) {
    this.servicePort = ports?.service ?? defaultReviewServicePort;
    this.notificationPort = ports?.notification ?? defaultReviewNotificationPort;
    this.storePort = ports?.store ?? defaultReviewStorePort;
    this.initSubscriptions();
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

    // 6. Sync locally recorded suggestions from Suggesting Mode keystrokes
    editorCommandBus.subscribe('editor:review-event', (cmd) => {
      if (cmd.event === 'suggestion:local-recorded') {
        const sug = (cmd.payload as { suggestion?: PageSuggestion })?.suggestion;
        if (sug) {
          this.currentSuggestions.set(sug.id, {
            ...sug,
            pageId: sug.pageId || this.activePageId || '',
          });
        }
      }
    });
  }

  /**
   * Initiates a new comment thread from the active editor selection or line
   */
  public initiateComment(optLine?: number, optSelectedText?: string): void {
    const engine = getActiveEditorEngine();
    const sel = engine?.getSelection?.();
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
    editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
  }

  /**
   * Registers current CodeMirror EditorView for live decoration updates.
   */
  public bindEditorView(view: EditorView | null, pageId: string): void {
    this.activeView = view;
    this.activePageId = pageId;

    if (view && this.currentSuggestions.size > 0) {
      this.syncEditorDecorations(
        view,
        Array.from(this.currentSuggestions.values()),
        Array.from(this.currentComments.values()),
        this.currentViewMode,
        this.currentReviewMode
      );
    }
  }

  /**
   * Retrieves currently cached suggestion by ID.
   */
  public getSuggestion(suggestionId: string): PageSuggestion | undefined {
    return this.currentSuggestions.get(suggestionId);
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
    reviewMode: boolean = false
  ): void {
    const preservedLocal: PageSuggestion[] = [];
    for (const s of this.currentSuggestions.values()) {
      if (s.id.startsWith('sug-local-') && (!this.activePageId || !s.pageId || s.pageId === this.activePageId)) {
        preservedLocal.push(s);
      }
    }

    this.currentSuggestions.clear();
    for (const s of suggestions) {
      this.currentSuggestions.set(s.id, s);
    }
    for (const localSug of preservedLocal) {
      if (!this.currentSuggestions.has(localSug.id)) {
        this.currentSuggestions.set(localSug.id, localSug);
      }
    }

    const mergedSuggestions = Array.from(this.currentSuggestions.values());

    this.currentComments.clear();
    for (const c of comments) {
      this.currentComments.set(c.id, c);
    }
    this.currentViewMode = viewMode;
    this.currentReviewMode = reviewMode;

    const targetView = view || this.activeView;
    if (!targetView) return;

    try {
      targetView.dispatch({
        effects: [
          setTrackChangesSuggestionsEffect.of(mergedSuggestions),
          setTrackChangesCommentsEffect.of(comments),
          setTrackChangesViewModeEffect.of(viewMode),
          setTrackChangesReviewModeEffect.of(reviewMode),
        ],
      });
    } catch (err) {
      console.debug('[ReviewCoordinator] Failed to sync decorations:', err);
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

    if (action === 'accept') {
      if (sug.type === 'delete') {
        // Text marked for deletion is permanently removed on accept
        if (from < to && to <= doc.length) {
          view.dispatch({
            changes: { from, to, insert: '' },
          });
        }
      } else if (sug.type === 'replace' && sug.suggestedText !== undefined) {
        if (from < to && to <= doc.length && currentSlice !== sug.suggestedText) {
          view.dispatch({
            changes: { from, to, insert: sug.suggestedText },
          });
        }
      } else if (sug.type === 'insert' && sug.suggestedText) {
        if (from <= to && to <= doc.length && currentSlice !== sug.suggestedText) {
          view.dispatch({
            changes: { from, to: from, insert: sug.suggestedText },
          });
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
        }
      } else if (sug.type === 'replace' && sug.originalText !== undefined) {
        if (from < to && to <= doc.length && currentSlice !== sug.originalText) {
          view.dispatch({
            changes: { from, to, insert: sug.originalText },
          });
        }
      }
      // If type === 'delete', original text was preserved in document
    }

    // Mark suggestion resolved in local cache
    const updatedSug = {
      ...sug,
      status: action === 'accept' ? ('accepted' as const) : ('rejected' as const),
    };
    this.currentSuggestions.set(sug.id, updatedSug);

    // Update active view decorations immediately
    this.syncEditorDecorations(
      view,
      Array.from(this.currentSuggestions.values()),
      Array.from(this.currentComments.values()),
      this.currentViewMode,
      this.currentReviewMode
    );
  }

  private resolveKnownSuggestion(suggestionId: string): PageSuggestion | undefined {
    const cached = this.currentSuggestions.get(suggestionId);
    if (cached) return cached;
    const stateSugs = this.activeView?.state.field(trackChangesStateField, false)?.suggestions || [];
    return stateSugs.find((s) => s.id === suggestionId);
  }

  public applySuggestionByIdLocally(suggestionId: string, action: 'accept' | 'reject'): void {
    const sug = this.resolveKnownSuggestion(suggestionId);
    if (this.activeView && sug) {
      this.applySuggestionLocally(this.activeView, sug, action);
    }
  }

  public applyAllLocally(action: 'accept' | 'reject'): void {
    if (!this.activeView) return;
    const doc = this.activeView.state.doc;
    const stateSugs = this.activeView.state.field(trackChangesStateField, false)?.suggestions || [];
    for (const s of stateSugs) {
      if (!this.currentSuggestions.has(s.id)) {
        this.currentSuggestions.set(s.id, s);
      }
    }
    const pending = Array.from(this.currentSuggestions.values())
      .filter((s) => s.status === 'pending')
      .map((s) => ({ sug: s, range: resolveSuggestionRange(doc, s) }))
      .sort((a, b) => b.range.from - a.range.from);

    for (const item of pending) {
      this.applySuggestionLocally(this.activeView, item.sug, action);
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

  /**
   * Accepts a proposed track change and applies it permanently.
   */
  public async acceptSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    const sug = this.resolveKnownSuggestion(suggestionId);
    if (this.activeView && sug) {
      this.applySuggestionLocally(this.activeView, sug, 'accept');
    }

    if (suggestionId.startsWith('sug-local-')) {
      this.notificationPort.notifySuccess('Change accepted', `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted',
        payload: { suggestionId },
      });
      return true;
    }

    try {
      await this.servicePort.acceptSuggestion(pageId, suggestionId);
      this.notificationPort.notifySuccess('Change accepted', `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted',
        payload: { suggestionId },
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to accept change', `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rollback',
        payload: { suggestionId },
      });
      return false;
    }
  }

  /**
   * Rejects a proposed track change and reverts it.
   */
  public async rejectSuggestion(pageId: string, suggestionId: string): Promise<boolean> {
    const sug = this.resolveKnownSuggestion(suggestionId);
    if (this.activeView && sug) {
      this.applySuggestionLocally(this.activeView, sug, 'reject');
    }

    if (suggestionId.startsWith('sug-local-')) {
      this.notificationPort.notifySuccess('Change rejected', `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected',
        payload: { suggestionId },
      });
      return true;
    }

    try {
      await this.servicePort.rejectSuggestion(pageId, suggestionId);
      this.notificationPort.notifySuccess('Change rejected', `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected',
        payload: { suggestionId },
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to reject change', `sug-${suggestionId}`);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rollback',
        payload: { suggestionId },
      });
      return false;
    }
  }

  /**
   * Bulk accepts all pending changes in a document.
   */
  public async acceptAll(pageId: string): Promise<boolean> {
    // Optimistically accept all in local view
    this.applyAllLocally('accept');

    try {
      await this.servicePort.acceptAllSuggestions(pageId);
      this.notificationPort.notifySuccess('All changes accepted', 'sug-bulk');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted-all',
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to accept all changes', 'sug-bulk');
      return false;
    }
  }

  /**
   * Bulk rejects all pending changes in a document.
   */
  public async rejectAll(pageId: string): Promise<boolean> {
    // Optimistically reject all in local view
    this.applyAllLocally('reject');

    try {
      await this.servicePort.rejectAllSuggestions(pageId);
      this.notificationPort.notifySuccess('All changes rejected', 'sug-bulk');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected-all',
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to reject all changes', 'sug-bulk');
      return false;
    }
  }

  /**
   * Bulk accepts selected pending changes in a document.
   */
  public async acceptSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    if (!suggestionIds || suggestionIds.length === 0) return true;
    try {
      await this.servicePort.acceptSelectedSuggestions(pageId, suggestionIds);
      this.notificationPort.notifySuccess(`${suggestionIds.length} changes accepted`, 'sug-bulk');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:accepted-selected',
        payload: { suggestionIds },
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to accept selected changes', 'sug-bulk');
      return false;
    }
  }

  /**
   * Bulk rejects selected pending changes in a document.
   */
  public async rejectSelected(pageId: string, suggestionIds: string[]): Promise<boolean> {
    if (!suggestionIds || suggestionIds.length === 0) return true;
    try {
      await this.servicePort.rejectSelectedSuggestions(pageId, suggestionIds);
      this.notificationPort.notifySuccess(`${suggestionIds.length} changes rejected`, 'sug-bulk');
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event: 'suggestion:rejected-selected',
        payload: { suggestionIds },
      });
      return true;
    } catch (err: unknown) {
      this.notificationPort.notifyError((err as Error)?.message || 'Failed to reject selected changes', 'sug-bulk');
      return false;
    }
  }
}

export const reviewCoordinator = new ReviewCoordinatorRegistry();
