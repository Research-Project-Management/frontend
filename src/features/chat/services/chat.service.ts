import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import {
  ConversationsData,
  ConversationItem,
  ChatMessage,
  FriendItem,
  FriendRequestsData,
  SearchedUser,
  MessageType,
} from '../types/chat.types';

export const chatService = {
  // ─── Conversations & Channels ───────────────────────────────────────────────
  async getConversations(): Promise<ConversationsData> {
    return apiGet<ConversationsData>('/api/chat/conversations');
  },

  async createDirectConversation(targetUserId: string): Promise<ConversationItem> {
    return apiPost<ConversationItem>('/api/chat/conversations/direct', { targetUserId });
  },

  async createGroupConversation(dto: {
    name: string;
    avatar?: string;
    memberIds?: string[];
  }): Promise<ConversationItem> {
    return apiPost<ConversationItem>('/api/chat/conversations/group', dto);
  },

  // ─── Messages & Reactions ───────────────────────────────────────────────────
  async getMessages(
    conversationId: string,
    cursor?: string,
    limit = 25,
  ): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());

    const qs = params.toString();
    const url = `/api/chat/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`;
    return apiGet<{ messages: ChatMessage[]; nextCursor: string | null }>(url);
  },

  async sendMessage(
    conversationId: string,
    dto: {
      content: string;
      type?: MessageType;
      attachments?: unknown[];
      replyToId?: string;
    },
  ): Promise<ChatMessage> {
    return apiPost<ChatMessage>(`/api/chat/conversations/${conversationId}/messages`, dto);
  },

  async markAsRead(conversationId: string): Promise<{ success: boolean; lastReadAt: string }> {
    return apiPost<{ success: boolean; lastReadAt: string }>(`/api/chat/conversations/${conversationId}/read`);
  },

  async addReaction(messageId: string, emoji: string): Promise<unknown> {
    return apiPost(`/api/chat/messages/${messageId}/reactions`, { emoji });
  },

  async removeReaction(messageId: string, emoji: string): Promise<unknown> {
    return apiDelete(`/api/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  },

  // ─── Project Chat Channels ──────────────────────────────────────────────────
  async enableProjectChat(projectId: string): Promise<ConversationItem> {
    return apiPost<ConversationItem>(`/api/projects/${projectId}/chat/enable`);
  },

  async getProjectChannels(projectId: string): Promise<ConversationItem[]> {
    return apiGet<ConversationItem[]>(`/api/projects/${projectId}/channels`);
  },

  async createProjectChannel(
    projectId: string,
    dto: { name: string; topic?: string },
  ): Promise<ConversationItem> {
    return apiPost<ConversationItem>(`/api/projects/${projectId}/channels`, dto);
  },

  async deleteProjectChannel(projectId: string, channelId: string): Promise<{ success: boolean }> {
    return apiDelete<{ success: boolean }>(`/api/projects/${projectId}/channels/${channelId}`);
  },

  // ─── Friends & Relationships ───────────────────────────────────────────────
  async getFriends(): Promise<FriendItem[]> {
    return apiGet<FriendItem[]>('/api/friends');
  },

  async getFriendRequests(): Promise<FriendRequestsData> {
    return apiGet<FriendRequestsData>('/api/friends/requests');
  },

  async sendFriendRequest(targetUserId: string): Promise<unknown> {
    return apiPost(`/api/friends/request/${targetUserId}`);
  },

  async acceptFriendRequest(requestId: string): Promise<unknown> {
    return apiPut(`/api/friends/requests/${requestId}/accept`);
  },

  async declineFriendRequest(requestId: string): Promise<unknown> {
    return apiPut(`/api/friends/requests/${requestId}/decline`);
  },

  async searchUsers(query: string = ''): Promise<SearchedUser[]> {
    const clean = query?.trim() || '';
    const qParam = clean ? `?q=${encodeURIComponent(clean)}` : '';
    return apiGet<SearchedUser[]>(`/api/friends/search${qParam}`);
  },
};
