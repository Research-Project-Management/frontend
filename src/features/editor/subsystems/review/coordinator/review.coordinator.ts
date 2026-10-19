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
  useDocumentCollaborationStore,
  useWorkspaceStore,
} from '@/features/editor/core';
import { suggestionService } from '@/features/editor/sdk/manuscript.service';
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

export class ReviewCoordinatorRegistry {
  private activeView: EditorView | null = null;
  private activePageId: string | null = null;
  private currentSuggestions = new Map<string, PageSuggestion>();
  private currentComments = new Map<string, PageComment>();
  private localToPersistedId = new Map<string, string>();
  private pendingPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private currentViewMode: TrackChangesViewMode = 'changes';
  private currentReviewMode = false;
  private initialized = false;

  constructor() {
    this.initSubscriptions();
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

    // 6. Sync locally recorded suggestions from Suggesting Mode keystrokes and persist to backend
    editorCommandBus.subscribe('editor:review-event', (cmd) => {
      if (cmd.event === 'suggestion:local-recorded') {
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
      }
    });
  }

  private scheduleLocalSuggestionPersist(pageId: string, sug: PageSuggestion): void {
    const existingTimer = this.pendingPersistTimers.get(sug.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pendingPersistTimers.delete(sug.id);
      const latest = this.currentSuggestions.get(sug.id) ?? sug;
      if (latest.status && latest.status !== 'pending') return;

      void suggestionService
        .createSuggestion({
          pageId,
          type: latest.type,
          originalText: latest.originalText || '',
          suggestedText: latest.suggestedText || '',
          fromLine: latest.fromLine || 1,
          fromColumn: latest.fromColumn || 1,
          toLine: latest.toLine || latest.fromLine || 1,
          toColumn: latest.toColumn || 1,
          silent: true,
        })
        .then((created) => {
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
              void suggestionService.acceptSuggestion(pageId, created.id).catch(() => {});
            } else if (currentLocal.status === 'rejected') {
              void suggestionService.rejectSuggestion(pageId, created.id).catch(() => {});
            }
          }

          if (this.activeView && this.activePageId === pageId) {
            try {
              this.activeView.dispatch({
                effects: [
                  setTrackChangesSuggestionsEffect.of(
                    Array.from(this.currentSuggestions.values())
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
    const sel = engine?.getSelection?.();
    const cursor = engine?.getCursorPosition?.();

    const startLine = optLine ?? sel?.startLine ?? cursor?.line ?? 1;
    const endLine = optLine ?? sel?.endLine ?? cursor?.line ?? 1;
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

  /**
   * Registers current CodeMirror EditorView for live decoration updates.
   */
  public bindEditorView(view: EditorView | null, pageId: string): void {
    const isPageSwitch = this.activePageId !== null && this.activePageId !== pageId;
    this.activeView = view;
    this.activePageId = pageId;

    if (isPageSwitch) {
      for (const [id, s] of this.currentSuggestions.entries()) {
        if (s.pageId && s.pageId !== pageId) {
          this.currentSuggestions.delete(id);
        } else if (!s.pageId) {
          this.currentSuggestions.delete(id);
        }
      }
      this.currentComments.clear();
    }

    if (view) {
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
        this.currentReviewMode
      );
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
      if (!this.activePageId || !s.pageId || s.pageId === this.activePageId) {
        this.currentSuggestions.set(s.id, s);
      }
    }
    for (const localSug of preservedLocal) {
      const persistedId = this.localToPersistedId.get(localSug.id);
      if (persistedId && this.currentSuggestions.has(persistedId)) {
        continue;
      }
      if (!this.currentSuggestions.has(localSug.id)) {
        this.currentSuggestions.set(localSug.id, localSug);
      }
    }

    const mergedSuggestions = Array.from(this.currentSuggestions.values());

    this.currentComments.clear();
    const scopedComments: PageComment[] = [];
    for (const c of comments) {
      const commentPageId = c.page || c.projectPageId;
      if (!this.activePageId || !commentPageId || commentPageId === this.activePageId) {
        this.currentComments.set(c.id, c);
        scopedComments.push(c);
      }
    }
    this.currentViewMode = viewMode;
    this.currentReviewMode = reviewMode;

    const targetView = view || this.activeView;
    if (!targetView) return;

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

  public applySelectedLocally(suggestionIds: string[], action: 'accept' | 'reject'): void {
    if (!this.activeView || !suggestionIds.length) return;
    const doc = this.activeView.state.doc;
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
    if (this.activeView && sug) {
      this.applySuggestionLocally(this.activeView, sug, action);
    }

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event = action === 'accept' ? 'suggestion:accepted' : 'suggestion:rejected';
    const effectiveId = this.localToPersistedId.get(suggestionId) ?? suggestionId;

    if (effectiveId.startsWith('sug-local-')) {
      toast.success(`Change ${pastTense}`, { id: `sug-${suggestionId}` });
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
        await suggestionService.acceptSuggestion(pageId, effectiveId);
      } else {
        await suggestionService.rejectSuggestion(pageId, effectiveId);
      }
      toast.success(`Change ${pastTense}`, { id: `sug-${suggestionId}` });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionId: effectiveId },
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || `Failed to ${action} change`, { id: `sug-${suggestionId}` });
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

    this.applyAllLocally(action);

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event = action === 'accept' ? 'suggestion:accepted-all' : 'suggestion:rejected-all';

    try {
      if (action === 'accept') {
        await suggestionService.acceptAllSuggestions(pageId);
      } else {
        await suggestionService.rejectAllSuggestions(pageId);
      }
      toast.success(`All changes ${pastTense}`, { id: 'sug-bulk' });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || `Failed to ${action} all changes`, { id: 'sug-bulk' });
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

    this.applySelectedLocally(suggestionIds, action);

    const persistedIds = suggestionIds
      .map((id) => this.localToPersistedId.get(id) ?? id)
      .filter((id) => !id.startsWith('sug-local-'));

    const pastTense = action === 'accept' ? 'accepted' : 'rejected';
    const event =
      action === 'accept' ? 'suggestion:accepted-selected' : 'suggestion:rejected-selected';

    if (persistedIds.length === 0) {
      toast.success(`${suggestionIds.length} changes ${pastTense}`, { id: 'sug-bulk' });
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
        await suggestionService.acceptSelectedSuggestions(pageId, persistedIds);
      } else {
        await suggestionService.rejectSelectedSuggestions(pageId, persistedIds);
      }
      toast.success(`${suggestionIds.length} changes ${pastTense}`, { id: 'sug-bulk' });
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId,
        event,
        payload: { suggestionIds: persistedIds },
      });
      return true;
    } catch (err: unknown) {
      toast.error((err as Error)?.message || `Failed to ${action} selected changes`, { id: 'sug-bulk' });
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
