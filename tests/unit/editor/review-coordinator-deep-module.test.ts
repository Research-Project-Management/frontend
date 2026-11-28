/**
 * review-coordinator-deep-module.test.ts
 *
 * Verification suite for ReviewCoordinator as a Deep Module (Matt Pocock design pattern):
 * - Injected ReviewServicePort test stand-in at the owned HTTP boundary.
 * - Single-click accept & reject with optimistic updates and event dispatching.
 * - Network failure graceful rollback handling and error notification.
 * - Bulk operations (acceptAll, rejectAll, acceptSelected, rejectSelected) with buffer rollback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import {
  ReviewCoordinator,
  reviewCoordinator,
  createReviewExtension,
  type ReviewServicePort,
} from '@/features/editor/subsystems/review';
import {
  editorCommandBus,
  useDocumentCollaborationStore,
  useWorkspaceStore,
} from '@/features/editor/core';

describe('ReviewCoordinator Deep Module (Ports & Seams)', () => {
  let mockService: ReviewServicePort;
  let coordinator: ReviewCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = {
      acceptSuggestion: vi.fn().mockResolvedValue({ success: true }),
      rejectSuggestion: vi.fn().mockResolvedValue({ success: true }),
      acceptAllSuggestions: vi.fn().mockResolvedValue({ success: true }),
      rejectAllSuggestions: vi.fn().mockResolvedValue({ success: true }),
      acceptSelectedSuggestions: vi.fn().mockResolvedValue({ success: true }),
      rejectSelectedSuggestions: vi.fn().mockResolvedValue({ success: true }),
    };

    coordinator = new ReviewCoordinator({
      service: mockService,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    reviewCoordinator.resetPorts();
  });

  it('acceptSuggestion calls servicePort and dispatches suggestion:accepted on success', async () => {
    const busEvents: unknown[] = [];
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      busEvents.push(cmd);
    });

    const result = await coordinator.acceptSuggestion('page-1', 'sug-123');

    expect(result).toBe(true);
    expect(mockService.acceptSuggestion).toHaveBeenCalledWith('page-1', 'sug-123');
    expect(toast.success).toHaveBeenCalledWith('Change accepted', { id: 'sug-sug-123' });
    expect(busEvents).toHaveLength(1);
    expect(busEvents[0]).toMatchObject({
      type: 'editor:review-event',
      pageId: 'page-1',
      event: 'suggestion:accepted',
      payload: { suggestionId: 'sug-123' },
    });

    unsub();
  });

  it('acceptSuggestion dispatches rollback and notifies error on service failure', async () => {
    mockService.acceptSuggestion = vi.fn().mockRejectedValue(new Error('Network error'));

    const busEvents: unknown[] = [];
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      busEvents.push(cmd);
    });

    const result = await coordinator.acceptSuggestion('page-1', 'sug-123');

    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Network error', { id: 'sug-sug-123' });
    expect(busEvents).toHaveLength(1);
    expect(busEvents[0]).toMatchObject({
      type: 'editor:review-event',
      pageId: 'page-1',
      event: 'suggestion:rollback',
      payload: { suggestionId: 'sug-123' },
    });

    unsub();
  });

  it('rejectSuggestion calls servicePort and dispatches suggestion:rejected on success', async () => {
    const busEvents: unknown[] = [];
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      busEvents.push(cmd);
    });

    const result = await coordinator.rejectSuggestion('page-1', 'sug-456');

    expect(result).toBe(true);
    expect(mockService.rejectSuggestion).toHaveBeenCalledWith('page-1', 'sug-456');
    expect(toast.success).toHaveBeenCalledWith('Change rejected', { id: 'sug-sug-456' });
    expect(busEvents).toHaveLength(1);
    expect(busEvents[0]).toMatchObject({
      type: 'editor:review-event',
      pageId: 'page-1',
      event: 'suggestion:rejected',
      payload: { suggestionId: 'sug-456' },
    });

    unsub();
  });

  it('bulk operations (acceptAll, rejectAll, acceptSelected, rejectSelected) delegate to servicePort', async () => {
    await coordinator.acceptAll('page-1');
    expect(mockService.acceptAllSuggestions).toHaveBeenCalledWith('page-1');
    expect(toast.success).toHaveBeenCalledWith('All changes accepted', { id: 'sug-bulk' });

    await coordinator.rejectAll('page-1');
    expect(mockService.rejectAllSuggestions).toHaveBeenCalledWith('page-1');
    expect(toast.success).toHaveBeenCalledWith('All changes rejected', { id: 'sug-bulk' });

    await coordinator.acceptSelected('page-1', ['sug-1', 'sug-2']);
    expect(mockService.acceptSelectedSuggestions).toHaveBeenCalledWith('page-1', ['sug-1', 'sug-2']);
    expect(toast.success).toHaveBeenCalledWith('2 changes accepted', { id: 'sug-bulk' });

    await coordinator.rejectSelected('page-1', ['sug-3']);
    expect(mockService.rejectSelectedSuggestions).toHaveBeenCalledWith('page-1', ['sug-3']);
    expect(toast.success).toHaveBeenCalledWith('1 changes rejected', { id: 'sug-bulk' });
  });

  it('acceptAll restores optimistic CodeMirror buffer snapshot when servicePort fails', async () => {
    mockService.acceptAllSuggestions = vi.fn().mockRejectedValue(new Error('Bulk failure'));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView({
      state: EditorState.create({
        doc: 'We propose an inefficient algorithm.',
        extensions: [createReviewExtension()],
      }),
      parent: container,
    });

    try {
      coordinator.bindEditorView(view, 'page-bulk-err');
      coordinator.syncEditorDecorations(
        view,
        [
          {
            id: 'sug-del-err',
            pageId: 'page-bulk-err',
            type: 'delete',
            originalText: 'inefficient ',
            suggestedText: '',
            fromLine: 1,
            fromColumn: 15,
            toLine: 1,
            toColumn: 27,
            status: 'pending',
            authorId: 'u-1',
            author: { id: 'u-1', name: 'Alice' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        [],
        'changes',
        false,
        'page-bulk-err',
      );

      const ok = await coordinator.acceptAll('page-bulk-err');
      expect(ok).toBe(false);
      expect(view.state.doc.toString()).toBe('We propose an inefficient algorithm.');
    } finally {
      view.destroy();
      container.remove();
    }
  });

  it('singleton reviewCoordinator can update service port dynamically via setPorts', async () => {
    reviewCoordinator.setPorts({
      service: mockService,
    });

    await reviewCoordinator.acceptSuggestion('page-live', 'sug-live');
    expect(mockService.acceptSuggestion).toHaveBeenCalledWith('page-live', 'sug-live');
    expect(toast.success).toHaveBeenCalledWith('Change accepted', { id: 'sug-sug-live' });

    reviewCoordinator.resetPorts();
  });

  it('initiateComment populates collaboration store pendingComment and opens review sidebar', () => {
    useDocumentCollaborationStore.getState().clearPendingComment();
    useWorkspaceStore.getState().setActiveSidebarTab('files');
    useWorkspaceStore.getState().setSidebarLeftOpen(false);

    coordinator.initiateComment(15, 'sample selected text');

    expect(useDocumentCollaborationStore.getState().pendingComment).toEqual({
      startLine: 15,
      endLine: 15,
      selectedText: 'sample selected text',
    });
    expect(useWorkspaceStore.getState().activeSidebarTab).toBe('review');
    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
  });

  it('scheduleLocalCreate converts 1-based UI columns to 0-based backend wire coordinates and preserves 1-based UI columns on merge', async () => {
    vi.useFakeTimers();
    const createSuggestion = vi.fn().mockImplementation(async (payload) => ({
      id: 'persisted-col-1',
      pageId: payload.pageId,
      type: payload.type,
      originalText: payload.originalText,
      suggestedText: payload.suggestedText,
      fromLine: payload.fromLine,
      fromColumn: payload.fromColumn,
      toLine: payload.toLine,
      toColumn: payload.toColumn,
      groupId: payload.groupId,
      status: 'pending' as const,
      authorId: 'u-1',
      author: { id: 'u-1', name: 'Alice' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    const acceptSuggestion = vi.fn().mockResolvedValue({ success: true });

    reviewCoordinator.setPorts({
      service: {
        ...mockService,
        createSuggestion,
        acceptSuggestion,
      },
    });

    try {
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: 'page-col',
        event: 'suggestion:local-recorded',
        payload: {
          suggestion: {
            id: 'sug-local-col-1',
            pageId: 'page-col',
            groupId: 'grp-col-1',
            type: 'delete',
            originalText: 'inefficient ',
            suggestedText: '',
            fromLine: 1,
            fromColumn: 18,
            toLine: 1,
            toColumn: 30,
            fromIndex: 17,
            toIndex: 29,
            status: 'pending',
            authorId: 'u-1',
            author: { id: 'u-1', name: 'Alice' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });

      await vi.advanceTimersByTimeAsync(400);

      expect(createSuggestion).toHaveBeenCalledTimes(1);
      expect(createSuggestion).toHaveBeenCalledWith(
        expect.objectContaining({
          pageId: 'page-col',
          groupId: 'grp-col-1',
          fromLine: 1,
          fromColumn: 17,
          toLine: 1,
          toColumn: 29,
        }),
      );

      // Merged persisted mapping is active for resolution
      const ok = await reviewCoordinator.acceptSuggestion('page-col', 'sug-local-col-1');
      expect(ok).toBe(true);
      expect(acceptSuggestion).toHaveBeenCalledWith('page-col', 'persisted-col-1');
    } finally {
      vi.useRealTimers();
      reviewCoordinator.reset();
    }
  });

  it('resolveOne on one member of a pending groupId pair batch-resolves all grouped members together', async () => {
    const batchResolve = vi.fn().mockResolvedValue({ success: true });
    coordinator = new ReviewCoordinator({
      service: {
        ...mockService,
        batchResolve,
      },
    });

    coordinator.syncEditorDecorations(
      null,
      [
        {
          id: 'sug-grp-del',
          pageId: 'page-grp',
          groupId: 'grp-pair-1',
          type: 'delete',
          originalText: 'old',
          suggestedText: '',
          fromLine: 1,
          fromColumn: 1,
          toLine: 1,
          toColumn: 4,
          status: 'pending',
          authorId: 'u-1',
          author: { id: 'u-1', name: 'Alice' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'sug-grp-ins',
          pageId: 'page-grp',
          groupId: 'grp-pair-1',
          type: 'insert',
          originalText: '',
          suggestedText: 'new',
          fromLine: 1,
          fromColumn: 4,
          toLine: 1,
          toColumn: 7,
          status: 'pending',
          authorId: 'u-1',
          author: { id: 'u-1', name: 'Alice' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      [],
      'changes',
      false,
      'page-grp',
    );

    const ok = await coordinator.acceptSuggestion('page-grp', 'sug-grp-del');
    expect(ok).toBe(true);
    expect(batchResolve).toHaveBeenCalledTimes(1);
    expect(batchResolve).toHaveBeenCalledWith('page-grp', {
      suggestionIds: ['sug-grp-del', 'sug-grp-ins'],
      action: 'accept',
    });
    expect(mockService.acceptSuggestion).not.toHaveBeenCalled();
  });
});
