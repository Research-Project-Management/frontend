import { create } from 'zustand';
import { ConversationItem, ChatMessage, FilterTab } from '../types/chat.types';

interface ChatStore {
  // Navigation & Selection
  activeConversationId: string | null;
  activeConversation: ConversationItem | null;
  filterTab: FilterTab;
  searchQuery: string;

  // Replying state
  replyingToMessage: ChatMessage | null;

  // Realtime typing indicators
  typingUsers: Record<string, string[]>;

  // Modals state
  isCreateChannelModalOpen: boolean;
  selectedProjectIdForChannel: string | null;
  isCreateGroupModalOpen: boolean;
  isFriendManagerModalOpen: boolean;

  // Actions
  setActiveConversation: (conv: ConversationItem | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setFilterTab: (tab: FilterTab) => void;
  setSearchQuery: (query: string) => void;
  setReplyingToMessage: (msg: ChatMessage | null) => void;

  setTypingUser: (conversationId: string, userName: string, isTyping: boolean) => void;

  openCreateChannelModal: (projectId: string) => void;
  closeCreateChannelModal: () => void;
  openCreateGroupModal: () => void;
  closeCreateGroupModal: () => void;
  openFriendManagerModal: () => void;
  closeFriendManagerModal: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeConversationId: null,
  activeConversation: null,
  filterTab: 'all',
  searchQuery: '',

  replyingToMessage: null,
  typingUsers: {},

  isCreateChannelModalOpen: false,
  selectedProjectIdForChannel: null,
  isCreateGroupModalOpen: false,
  isFriendManagerModalOpen: false,

  setActiveConversation: (conv) =>
    set({
      activeConversation: conv,
      activeConversationId: conv?.id || null,
      replyingToMessage: null,
    }),

  setActiveConversationId: (id) =>
    set({
      activeConversationId: id,
      replyingToMessage: null,
    }),

  setFilterTab: (tab) => set({ filterTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setReplyingToMessage: (msg) => set({ replyingToMessage: msg }),

  setTypingUser: (conversationId, userName, isTyping) =>
    set((state) => {
      const current = state.typingUsers[conversationId] || [];
      const updated = isTyping
        ? Array.from(new Set([...current, userName]))
        : current.filter((u) => u !== userName);
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: updated,
        },
      };
    }),

  openCreateChannelModal: (projectId) =>
    set({
      isCreateChannelModalOpen: true,
      selectedProjectIdForChannel: projectId,
    }),

  closeCreateChannelModal: () =>
    set({
      isCreateChannelModalOpen: false,
      selectedProjectIdForChannel: null,
    }),

  openCreateGroupModal: () => set({ isCreateGroupModalOpen: true }),
  closeCreateGroupModal: () => set({ isCreateGroupModalOpen: false }),

  openFriendManagerModal: () => set({ isFriendManagerModalOpen: true }),
  closeFriendManagerModal: () => set({ isFriendManagerModalOpen: false }),
}));
