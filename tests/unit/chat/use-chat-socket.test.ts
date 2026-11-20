import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatSocket } from '@/features/chat/hooks/use-chat-socket';
import { CHAT_QUERY_KEYS } from '@/features/chat/hooks/use-chat-queries';
import { useChatStore } from '@/features/chat/store/chat.store';
import {
  CHAT_SOCKET_EVENTS,
  disconnectChatSocketImmediately,
} from '@/features/chat/services/chat-socket.manager';
import type { ChatMessage, MessagesPageResponse } from '@/features/chat/types/chat.types';

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

  removeAllListeners() {
    this.listeners.clear();
    return this;
  }

  trigger(event: string, ...args: unknown[]) {
    for (const fn of Array.from(this.listeners.get(event) ?? [])) {
      fn(...args);
    }
  }
}

const mockSockets: MockSocket[] = [];
const ioMock = vi.fn(() => {
  const sock = new MockSocket();
  mockSockets.push(sock);
  return sock;
});

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...(args as [])),
}));

vi.mock('@/shared/lib/api', () => ({
  getAuthToken: vi.fn(() => 'test-jwt-token'),
  getEffectiveBaseUrl: vi.fn(() => 'http://localhost:4000'),
  getRealtimeBaseUrl: vi.fn(() => 'http://localhost:3014'),
}));

const mockUser = { id: 'user-1', name: 'Alice', email: 'alice@flux.dev' };
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useChatSocket & ChatSocketManager', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    ioMock.mockClear();
    mockSockets.length = 0;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useChatStore.setState({ typingUsers: {} });
  });

  afterEach(() => {
    disconnectChatSocketImmediately();
    queryClient.clear();
    vi.useRealTimers();
  });

  it('keeps a single persistent /chat connection without reconnecting when switching conversations', () => {
    const { rerender } = renderHook(
      ({ convId }: { convId: string | null }) => useChatSocket(convId),
      {
        initialProps: { convId: 'conv-1' as string | null },
        wrapper: createWrapper(queryClient),
      },
    );

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledWith(
      'http://localhost:3014/chat',
      expect.any(Object),
    );
    const socket = mockSockets[0];

    expect(socket.emit).toHaveBeenCalledWith(CHAT_SOCKET_EVENTS.CONVERSATION_JOIN, {
      conversationId: 'conv-1',
    });
    expect(socket.emit).toHaveBeenCalledWith(CHAT_SOCKET_EVENTS.MESSAGE_READ, {
      conversationId: 'conv-1',
    });

    socket.emit.mockClear();
    rerender({ convId: 'conv-2' });

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(CHAT_SOCKET_EVENTS.TYPING_STOP, {
      conversationId: 'conv-1',
      userName: 'Alice',
    });
    expect(socket.emit).toHaveBeenCalledWith(CHAT_SOCKET_EVENTS.CONVERSATION_LEAVE, {
      conversationId: 'conv-1',
    });
    expect(socket.emit).toHaveBeenCalledWith(CHAT_SOCKET_EVENTS.CONVERSATION_JOIN, {
      conversationId: 'conv-2',
    });
    expect(socket.emit).toHaveBeenCalledWith(CHAT_SOCKET_EVENTS.MESSAGE_READ, {
      conversationId: 'conv-2',
    });
  });

  it('shares one socket across concurrent ChatWindow and FloatingChatWidget hooks and ref-counts rooms', () => {
    const wrapper = createWrapper(queryClient);

    const hookA = renderHook(() => useChatSocket('conv-shared'), { wrapper });
    const hookB = renderHook(() => useChatSocket('conv-shared'), { wrapper });

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledWith(
      'http://localhost:3014/chat',
      expect.any(Object),
    );
    const socket = mockSockets[0];

    const joinCalls = socket.emit.mock.calls.filter(
      ([event]) => event === CHAT_SOCKET_EVENTS.CONVERSATION_JOIN,
    );
    expect(joinCalls).toHaveLength(1);

    socket.emit.mockClear();
    hookB.unmount();

    const leaveAfterFirstUnmount = socket.emit.mock.calls.filter(
      ([event]) => event === CHAT_SOCKET_EVENTS.CONVERSATION_LEAVE,
    );
    expect(leaveAfterFirstUnmount).toHaveLength(0);

    hookA.unmount();
    const leaveAfterLastUnmount = socket.emit.mock.calls.filter(
      ([event]) => event === CHAT_SOCKET_EVENTS.CONVERSATION_LEAVE,
    );
    expect(leaveAfterLastUnmount).toHaveLength(1);
  });

  it('updates message cache, reactions, conversation invalidations, and typing indicators on canonical events', () => {
    queryClient.setQueryData(CHAT_QUERY_KEYS.messages('conv-1'), {
      pageParams: [undefined],
      pages: [
        {
          messages: [
            {
              id: 'msg-1',
              conversationId: 'conv-1',
              senderId: 'user-2',
              type: 'text',
              content: 'Existing',
              reactions: [],
              createdAt: '2026-11-20T10:00:00.000Z',
              updatedAt: '2026-11-20T10:00:00.000Z',
            },
          ],
          nextCursor: null,
        } satisfies MessagesPageResponse,
      ],
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useChatSocket('conv-1'), {
      wrapper: createWrapper(queryClient),
    });

    const socket = mockSockets[0];
    socket.emit.mockClear();

    const incomingMsg: ChatMessage = {
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'user-2',
      type: 'text',
      content: 'Hello from Bob',
      reactions: [],
      createdAt: '2026-11-20T10:01:00.000Z',
      updatedAt: '2026-11-20T10:01:00.000Z',
    };

    act(() => {
      socket.trigger(CHAT_SOCKET_EVENTS.MESSAGE_NEW, incomingMsg);
    });

    const updatedMsgs = queryClient.getQueryData<{
      pages: MessagesPageResponse[];
    }>(CHAT_QUERY_KEYS.messages('conv-1'));
    expect(updatedMsgs?.pages[0].messages[0].id).toBe('msg-2');
    expect(socket.emit).toHaveBeenCalledWith(CHAT_SOCKET_EVENTS.MESSAGE_READ, {
      conversationId: 'conv-1',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: CHAT_QUERY_KEYS.conversations,
    });

    invalidateSpy.mockClear();
    act(() => {
      socket.trigger(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, {
        conversationId: 'conv-other',
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: CHAT_QUERY_KEYS.conversations,
    });

    act(() => {
      socket.trigger(CHAT_SOCKET_EVENTS.REACTION_UPDATED, {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        userId: 'user-2',
        emoji: '🔥',
        action: 'add',
      });
    });
    const afterAdd = queryClient.getQueryData<{ pages: MessagesPageResponse[] }>(
      CHAT_QUERY_KEYS.messages('conv-1'),
    );
    expect(afterAdd?.pages[0].messages[1].reactions).toHaveLength(1);
    expect(afterAdd?.pages[0].messages[1].reactions?.[0].emoji).toBe('🔥');

    act(() => {
      socket.trigger(CHAT_SOCKET_EVENTS.REACTION_UPDATED, {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        userId: 'user-2',
        emoji: '🔥',
        action: 'remove',
      });
    });
    const afterRemove = queryClient.getQueryData<{ pages: MessagesPageResponse[] }>(
      CHAT_QUERY_KEYS.messages('conv-1'),
    );
    expect(afterRemove?.pages[0].messages[1].reactions).toHaveLength(0);

    act(() => {
      socket.trigger(CHAT_SOCKET_EVENTS.TYPING_STATUS, {
        conversationId: 'conv-1',
        userId: 'user-2',
        userName: 'Bob',
        isTyping: true,
      });
    });
    expect(useChatStore.getState().typingUsers['conv-1']).toEqual(['Bob']);

    act(() => {
      socket.trigger(CHAT_SOCKET_EVENTS.TYPING_STATUS, {
        conversationId: 'conv-1',
        userId: 'user-2',
        isTyping: false,
      });
    });
    expect(useChatStore.getState().typingUsers['conv-1']).toEqual([]);
  });
});
