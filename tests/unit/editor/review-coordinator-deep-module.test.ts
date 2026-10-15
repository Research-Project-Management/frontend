/**
 * review-coordinator-deep-module.test.ts
 *
 * Verification suite for ReviewCoordinator as a Deep Module (Matt Pocock design pattern):
 * - Injected ReviewServicePort & ReviewNotificationPort test stand-ins.
 * - Single-click accept & reject with optimistic updates and event dispatching.
 * - Network failure graceful rollback handling and error notification.
 * - Bulk operations (acceptAll, rejectAll, acceptSelected, rejectSelected).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReviewCoordinatorRegistry,
  reviewCoordinator,
} from '@/features/editor/subsystems/review';
import type {
  ReviewServicePort,
  ReviewNotificationPort,
  ReviewStorePort,
} from '@/features/editor/subsystems/review/model/review-service-port';
import { editorCommandBus } from '@/features/editor/core';

describe('ReviewCoordinator Deep Module (Ports & Seams)', () => {
  let mockService: ReviewServicePort;
  let mockNotification: ReviewNotificationPort;
  let coordinator: ReviewCoordinatorRegistry;

  beforeEach(() => {
    mockService = {
      acceptSuggestion: vi.fn().mockResolvedValue({ success: true }),
      rejectSuggestion: vi.fn().mockResolvedValue({ success: true }),
      acceptAllSuggestions: vi.fn().mockResolvedValue({ success: true }),
      rejectAllSuggestions: vi.fn().mockResolvedValue({ success: true }),
      acceptSelectedSuggestions: vi.fn().mockResolvedValue({ success: true }),
      rejectSelectedSuggestions: vi.fn().mockResolvedValue({ success: true }),
    };

    mockNotification = {
      notifySuccess: vi.fn(),
      notifyError: vi.fn(),
    };

    coordinator = new ReviewCoordinatorRegistry({
      service: mockService,
      notification: mockNotification,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    reviewCoordinator.resetPorts();
  });

  it('acceptSuggestion calls servicePort and dispatches suggestion:accepted on success', async () => {
    const busEvents: any[] = [];
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      busEvents.push(cmd);
    });

    const result = await coordinator.acceptSuggestion('page-1', 'sug-123');

    expect(result).toBe(true);
    expect(mockService.acceptSuggestion).toHaveBeenCalledWith('page-1', 'sug-123');
    expect(mockNotification.notifySuccess).toHaveBeenCalledWith('Change accepted', 'sug-sug-123');
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

    const busEvents: any[] = [];
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      busEvents.push(cmd);
    });

    const result = await coordinator.acceptSuggestion('page-1', 'sug-123');

    expect(result).toBe(false);
    expect(mockNotification.notifyError).toHaveBeenCalledWith('Network error', 'sug-sug-123');
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
    const busEvents: any[] = [];
    const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
      busEvents.push(cmd);
    });

    const result = await coordinator.rejectSuggestion('page-1', 'sug-456');

    expect(result).toBe(true);
    expect(mockService.rejectSuggestion).toHaveBeenCalledWith('page-1', 'sug-456');
    expect(mockNotification.notifySuccess).toHaveBeenCalledWith('Change rejected', 'sug-sug-456');
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
    expect(mockNotification.notifySuccess).toHaveBeenCalledWith('All changes accepted', 'sug-bulk');

    await coordinator.rejectAll('page-1');
    expect(mockService.rejectAllSuggestions).toHaveBeenCalledWith('page-1');
    expect(mockNotification.notifySuccess).toHaveBeenCalledWith('All changes rejected', 'sug-bulk');

    await coordinator.acceptSelected('page-1', ['sug-1', 'sug-2']);
    expect(mockService.acceptSelectedSuggestions).toHaveBeenCalledWith('page-1', ['sug-1', 'sug-2']);
    expect(mockNotification.notifySuccess).toHaveBeenCalledWith('2 changes accepted', 'sug-bulk');

    await coordinator.rejectSelected('page-1', ['sug-3']);
    expect(mockService.rejectSelectedSuggestions).toHaveBeenCalledWith('page-1', ['sug-3']);
    expect(mockNotification.notifySuccess).toHaveBeenCalledWith('1 changes rejected', 'sug-bulk');
  });

  it('singleton reviewCoordinator can update ports dynamically via setPorts', async () => {
    reviewCoordinator.setPorts({
      service: mockService,
      notification: mockNotification,
    });

    await reviewCoordinator.acceptSuggestion('page-live', 'sug-live');
    expect(mockService.acceptSuggestion).toHaveBeenCalledWith('page-live', 'sug-live');
    expect(mockNotification.notifySuccess).toHaveBeenCalledWith('Change accepted', 'sug-sug-live');

    reviewCoordinator.resetPorts();
  });

  it('initiateComment delegates to storePort and opens review sidebar', () => {
    const mockStore: ReviewStorePort = {
      setPendingComment: vi.fn(),
      openReviewSidebar: vi.fn(),
    };

    coordinator.setPorts({ store: mockStore });
    coordinator.initiateComment(15, 'sample selected text');

    expect(mockStore.setPendingComment).toHaveBeenCalledWith({
      startLine: 15,
      endLine: 15,
      selectedText: 'sample selected text',
    });
    expect(mockStore.openReviewSidebar).toHaveBeenCalled();
  });
});
