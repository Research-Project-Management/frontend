import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useRealtimeItems,
  WORK_ITEMS_SOCKET_EVENTS,
} from '@/features/projects/project-id/work-items/hooks/use-realtime';

type Listener = (...args: unknown[]) => void;

class MockSocket {
  public connected = true;
  public emit = vi.fn();
  public disconnect = vi.fn();
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, fn: Listener) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return this;
  }

  off(event: string, fn?: Listener) {
    if (!fn) {
      this.listeners.delete(event);
    } else {
      this.listeners.get(event)?.delete(fn);
    }
    return this;
  }

  trigger(event: string, ...args: unknown[]) {
    for (const fn of Array.from(this.listeners.get(event) ?? [])) {
      fn(...args);
    }
  }
}

const mockSockets: MockSocket[] = [];
const ioMock = vi.fn((_url?: string, _opts?: Record<string, unknown>) => {
  const sock = new MockSocket();
  mockSockets.push(sock);
  return sock;
});

vi.mock('socket.io-client', () => ({
  io: (url?: string, opts?: Record<string, unknown>) => ioMock(url, opts),
}));

vi.mock('@/shared/lib/api', () => ({
  getAuthToken: vi.fn(() => 'test-jwt-token'),
  getEffectiveBaseUrl: vi.fn(() => 'http://localhost:4000'),
  getRealtimeBaseUrl: vi.fn(() => 'http://localhost:3014'),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useRealtimeItems (Socket.IO /work-items)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    ioMock.mockClear();
    mockSockets.length = 0;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.useRealTimers();
  });

  it('connects to /work-items with handshake auth (no ?token= query param), joins room on connect, and leaves on unmount', () => {
    const { unmount } = renderHook(
      () => useRealtimeItems({ projectId: 'proj-1', enabled: true }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(ioMock).toHaveBeenCalledTimes(1);
    const [url, opts] = ioMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('http://localhost:3014/work-items');
    expect(url).not.toContain('token=');
    expect(typeof opts.auth).toBe('function');

    const authResult: Record<string, unknown>[] = [];
    (opts.auth as (cb: (data: Record<string, unknown>) => void) => void)((data) => {
      authResult.push(data);
    });
    expect(authResult).toEqual([{ token: 'test-jwt-token' }]);

    const socket = mockSockets[0];
    expect(socket.emit).toHaveBeenCalledWith(WORK_ITEMS_SOCKET_EVENTS.JOIN, {
      projectId: 'proj-1',
    });

    socket.emit.mockClear();
    unmount();

    expect(socket.emit).toHaveBeenCalledWith(WORK_ITEMS_SOCKET_EVENTS.LEAVE, {
      projectId: 'proj-1',
    });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not connect when disabled or missing projectId', () => {
    renderHook(() => useRealtimeItems({ projectId: 'proj-1', enabled: false }), {
      wrapper: createWrapper(queryClient),
    });
    renderHook(() => useRealtimeItems({ projectId: '', enabled: true }), {
      wrapper: createWrapper(queryClient),
    });

    expect(ioMock).not.toHaveBeenCalled();
  });

  it('coalesces debounced invalidations without losing state counts and triggers item/state callbacks', () => {
    vi.useFakeTimers();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onWorkItemDeleted = vi.fn();
    const onStateReordered = vi.fn();

    renderHook(
      () =>
        useRealtimeItems({
          projectId: 'proj-1',
          enabled: true,
          onWorkItemDeleted,
          onStateReordered,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    const socket = mockSockets[0];

    act(() => {
      socket.trigger(WORK_ITEMS_SOCKET_EVENTS.STATE_CHANGED, {
        projectId: 'proj-1',
        entityId: 'wi-10',
        verb: 'transitioned',
      });
      socket.trigger(WORK_ITEMS_SOCKET_EVENTS.UPDATED, {
        projectId: 'proj-1',
        entityId: 'wi-10',
        verb: 'updated',
      });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-items', 'proj-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-states', 'proj-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['project-state-counts', 'proj-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['comments', 'wi-10'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['work-item-comments', 'wi-10'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['work-item-activity', 'wi-10'],
    });

    invalidateSpy.mockClear();

    act(() => {
      socket.trigger(WORK_ITEMS_SOCKET_EVENTS.STATE_UPDATED, {
        projectId: 'proj-1',
        entityId: 'proj-1',
        entityType: 'project',
        verb: 'reordered',
      });
      socket.trigger(WORK_ITEMS_SOCKET_EVENTS.DELETED, {
        projectId: 'proj-1',
        entityId: 'wi-99',
        verb: 'deleted',
      });
    });

    expect(onStateReordered).toHaveBeenCalledTimes(1);
    expect(onWorkItemDeleted).toHaveBeenCalledWith('wi-99');

    act(() => {
      socket.trigger(WORK_ITEMS_SOCKET_EVENTS.ACCESS_REVOKED, { projectId: 'proj-1' });
    });

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-items', 'proj-1'] });
  });
});
