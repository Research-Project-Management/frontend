import { useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../services/chat.service';
import { MessageType, ChatMessage } from '../types/chat.types';
import { useAuth } from '@/features/auth/hooks/use-auth';

export const CHAT_QUERY_KEYS = {
  conversations: ['chat-conversations'] as const,
  messages: (convId: string | null) => ['chat-messages', convId] as const,
  friends: ['chat-friends'] as const,
  friendRequests: ['chat-friend-requests'] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.conversations,
    queryFn: () => chatService.getConversations(),
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

export function useInfiniteMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: CHAT_QUERY_KEYS.messages(conversationId),
    queryFn: async ({ pageParam }) => {
      if (!conversationId) return { messages: [], nextCursor: null };
      return chatService.getMessages(conversationId, pageParam as string | undefined, 25);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: !!conversationId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useFriends() {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.friends,
    queryFn: () => chatService.getFriends(),
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.friendRequests,
    queryFn: () => chatService.getFriendRequests(),
  });
}

export function useChatBadgeCounts() {
  const { data: conversations } = useConversations();
  const { data: friendRequests } = useFriendRequests();

  const totalUnreadMessages = useMemo(() => {
    if (!conversations) return 0;
    const all = [
      ...(conversations.directs || []),
      ...(conversations.groups || []),
      ...(conversations.projectChannels || []),
    ];
    return all.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations]);

  const pendingFriendRequests = friendRequests?.incoming?.length || 0;
  const totalBadgeCount = totalUnreadMessages + pendingFriendRequests;

  return {
    totalUnreadMessages,
    pendingFriendRequests,
    totalBadgeCount,
  };
}

export function useSendMessage(conversationId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (dto: {
      content: string;
      type?: MessageType;
      attachments?: unknown[];
      replyToId?: string;
      replyTo?: {
        id: string;
        content: string;
        sender?: { id?: string; name?: string | null } | null;
      } | null;
    }) => {
      if (!conversationId) throw new Error('No active conversation');
      return chatService.sendMessage(conversationId, {
        content: dto.content,
        type: dto.type,
        attachments: dto.attachments,
        replyToId: dto.replyToId,
      });
    },
    onMutate: async (newDto) => {
      if (!conversationId) return;

      // 1. Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: CHAT_QUERY_KEYS.messages(conversationId) });

      // 2. Snapshot previous cache
      const previousMessages = queryClient.getQueryData(CHAT_QUERY_KEYS.messages(conversationId));

      // 3. Create instant optimistic message (0ms latency on user's screen)
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        conversationId,
        senderId: user?.id || '',
        content: newDto.content,
        type: newDto.type || 'text',
        attachments: (newDto.attachments as any) || [],
        replyToId: newDto.replyToId || null,
        replyTo: newDto.replyTo || null,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: user?.id || '',
          email: user?.email || '',
          name: (user as any)?.name || (user as any)?.profile?.name || user?.email?.split('@')[0] || 'You',
          avatar: (user as any)?.avatar || (user as any)?.profile?.avatar || null,
        },
        reactions: [],
      };

      // 4. Inject optimistic message into query cache
      queryClient.setQueryData(
        CHAT_QUERY_KEYS.messages(conversationId),
        (oldData: any) => {
          if (!oldData || !oldData.pages || oldData.pages.length === 0) {
            return {
              pageParams: [undefined],
              pages: [{ messages: [optimisticMessage], nextCursor: null }],
            };
          }
          const firstPage = oldData.pages[0];
          return {
            ...oldData,
            pages: [
              {
                ...firstPage,
                messages: [optimisticMessage, ...firstPage.messages],
              },
              ...oldData.pages.slice(1),
            ],
          };
        },
      );

      return { previousMessages, tempId };
    },
    onError: (_err, _newDto, context: any) => {
      // Rollback on network failure
      if (conversationId && context?.previousMessages) {
        queryClient.setQueryData(
          CHAT_QUERY_KEYS.messages(conversationId),
          context.previousMessages,
        );
      }
    },
    onSuccess: (savedMsg, _newDto, context: any) => {
      // Reconcile: Replace optimistic temp message with actual database message
      queryClient.setQueryData(
        CHAT_QUERY_KEYS.messages(conversationId),
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((m: ChatMessage) => {
                if (m.id === context?.tempId || m.id === savedMsg.id) {
                  return savedMsg;
                }
                return m;
              }),
            })),
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    },
  });
}

export function useAddReaction(conversationId: string | null) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatService.addReaction(messageId, emoji),
  });
}

export function useRemoveReaction(conversationId: string | null) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatService.removeReaction(messageId, emoji),
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      topic,
    }: {
      projectId: string;
      name: string;
      topic?: string;
    }) => chatService.createProjectChannel(projectId, { name, topic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; avatar?: string; memberIds?: string[] }) =>
      chatService.createGroupConversation(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    },
  });
}

export function useCreateDirect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) =>
      chatService.createDirectConversation(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    },
  });
}
