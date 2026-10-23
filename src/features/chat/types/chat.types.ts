export type ConversationType = 'direct' | 'group' | 'project_channel';
export type MessageType = 'text' | 'image' | 'file' | 'system';
export type FilterTab = 'all' | 'direct' | 'group' | 'project';
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface ChatAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
  mimeType?: string;
}

export interface ChatUser {
  id: string;
  email?: string;
  name: string;
  avatar?: string | null;
  institution?: string | null;
}

export interface MessageReactionItem {
  id: string;
  emoji: string;
  userId: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  attachments?: ChatAttachment[];
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    sender?: {
      id?: string;
      name?: string | null;
      profile?: { name: string };
    } | null;
  } | null;
  sender?: ChatUser;
  reactions?: MessageReactionItem[];
  isEdited?: boolean;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationItem {
  id: string;
  type: ConversationType;
  name: string;
  topic?: string | null;
  avatar?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  projectIdentifier?: string | null;
  isDefault?: boolean;
  otherUser?: ChatUser | null;
  memberCount?: number;
  lastMessageAt?: string | null;
  lastMessageSnippet?: string | null;
  lastSenderName?: string | null;
  unreadCount: number;
  isMuted?: boolean;
  isPinned?: boolean;
  updatedAt?: string;
}

export interface ConversationsData {
  directs: ConversationItem[];
  groups: ConversationItem[];
  projectChannels: ConversationItem[];
}

export interface MessagesPageResponse {
  messages: ChatMessage[];
  nextCursor: string | null;
  fromCache?: boolean;
}

export interface FriendItem {
  friendshipId: string;
  friend: ChatUser;
  since: string;
}

export interface PendingFriendRequest {
  id: string;
  user: ChatUser;
  createdAt: string;
}

export interface FriendRequestsData {
  incoming: PendingFriendRequest[];
  outgoing: PendingFriendRequest[];
}

export interface SearchedUser extends ChatUser {
  friendship?: {
    id: string;
    status: FriendshipStatus;
    isRequester: boolean;
  } | null;
  connectionContext?: {
    sharedProjects?: string[];
    mutualFriendsCount?: number;
  };
}
