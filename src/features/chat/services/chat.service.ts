import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import {
  ConversationsData,
  ConversationItem,
  ChatMessage,
  FriendItem,
  FriendRequestsData,
  SearchedUser,
  MessageType,
  ChatAttachment,
} from '../types/chat.types';

export const CHAT_UPLOAD_LIMITS = {
  MAX_IMAGE_BYTES: 20 * 1024 * 1024,
  MAX_FILE_BYTES: 50 * 1024 * 1024,
} as const;

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

  // ─── Attachments & Media (Cloudflare R2 Direct Upload & Scale) ───────────
  async presignAttachment(
    conversationId: string,
    dto: { filename: string; sizeBytes: number; mimeType?: string },
  ): Promise<{
    uploadUrl: string;
    storageKey: string;
    filename: string;
    sizeBytes: number;
    mimeType: string;
    maxSizeBytes: number;
    expiresIn: number;
    type: 'image' | 'file';
  }> {
    return apiPost(
      `/api/chat/conversations/${conversationId}/attachments/presign`,
      dto,
    );
  },

  async uploadToPresignedUrl(
    uploadUrl: string,
    file: File | Blob,
    mimeType: string,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`R2 direct upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during direct R2 upload'));
      xhr.ontimeout = () => reject(new Error('Timeout during direct R2 upload'));

      xhr.send(file);
    });
  },

  async completeAttachment(
    conversationId: string,
    dto: {
      storageKey: string;
      filename: string;
      sizeBytes: number;
      mimeType?: string;
    },
  ): Promise<ChatAttachment> {
    return apiPost<ChatAttachment>(
      `/api/chat/conversations/${conversationId}/attachments/complete`,
      dto,
    );
  },

  async uploadAttachmentDirect(
    conversationId: string,
    formData: FormData,
  ): Promise<ChatAttachment> {
    return apiPost<ChatAttachment>(
      `/api/chat/conversations/${conversationId}/attachments/upload`,
      formData,
    );
  },

  /**
   * Upload chat file orchestrator:
   * 1. Validates file size limits (20MB for images, 50MB for files).
   * 2. Issues presigned upload URL to Cloudflare R2.
   * 3. Streams binary data directly to R2 for scalable performance.
   * 4. Finalizes attachment and returns typed ChatAttachment.
   */
  async uploadChatFile(
    conversationId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<ChatAttachment> {
    const isImage =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name);
    if (isImage && file.size > CHAT_UPLOAD_LIMITS.MAX_IMAGE_BYTES) {
      throw new Error(`Ảnh "${file.name}" vượt quá dung lượng tối đa 20MB.`);
    }
    if (!isImage && file.size > CHAT_UPLOAD_LIMITS.MAX_FILE_BYTES) {
      throw new Error(`Tệp "${file.name}" vượt quá dung lượng tối đa 50MB.`);
    }

    try {
      const presign = await this.presignAttachment(conversationId, {
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      await this.uploadToPresignedUrl(
        presign.uploadUrl,
        file,
        presign.mimeType,
        onProgress,
      );

      const completed = await this.completeAttachment(conversationId, {
        storageKey: presign.storageKey,
        filename: presign.filename,
        sizeBytes: presign.sizeBytes,
        mimeType: presign.mimeType,
      });

      return completed;
    } catch {
      // Fallback: direct multipart upload via backend
      const formData = new FormData();
      formData.append('file', file);
      return this.uploadAttachmentDirect(conversationId, formData);
    }
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
