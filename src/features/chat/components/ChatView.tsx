'use client';

import React, { useEffect, useMemo } from 'react';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { CreateChannelModal } from './CreateChannelModal';
import { CreateGroupModal } from './CreateGroupModal';
import { FriendManagerModal } from './FriendManagerModal';
import { useConversations } from '../hooks/use-chat-queries';
import { useChatStore } from '../store/chat.store';

export function ChatView() {
  const { data: conversationsData, isLoading } = useConversations();
  const {
    activeConversation,
    activeConversationId,
    setActiveConversation,
  } = useChatStore();

  const conversations = useMemo(
    () => ({
      directs: conversationsData?.directs || [],
      groups: conversationsData?.groups || [],
      projectChannels: conversationsData?.projectChannels || [],
    }),
    [conversationsData],
  );

  // If activeConversation is missing but activeConversationId exists, find it
  useEffect(() => {
    if (activeConversationId && (!activeConversation || activeConversation.id !== activeConversationId)) {
      const all = [
        ...conversations.projectChannels,
        ...conversations.groups,
        ...conversations.directs,
      ];
      const found = all.find((c) => c.id === activeConversationId);
      if (found) {
        setActiveConversation(found);
      }
    }
  }, [
    activeConversationId,
    activeConversation,
    conversations,
    setActiveConversation,
  ]);

  // Deep link support via URL search params (e.g. /chat?projectId=... or /chat?conversationId=...)
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) return;
    const params = new URLSearchParams(window.location.search);
    const paramConvId = params.get('conversationId') || params.get('id');
    const paramProjectId = params.get('projectId') || params.get('project');

    if (paramConvId) {
      const all = [
        ...conversations.projectChannels,
        ...conversations.groups,
        ...conversations.directs,
      ];
      const match = all.find((c) => c.id === paramConvId);
      if (match) {
        setActiveConversation(match);
        return;
      }
    }

    if (paramProjectId) {
      const projectChannel = conversations.projectChannels.find(
        (c) => c.projectId === paramProjectId,
      );
      if (projectChannel) {
        setActiveConversation(projectChannel);
        return;
      }
    }

    // Default fallback: select first conversation if none is active
    if (!activeConversationId) {
      const first =
        conversations.projectChannels[0] ||
        conversations.directs[0] ||
        conversations.groups[0];
      if (first) {
        setActiveConversation(first);
      }
    }
  }, [
    isLoading,
    conversations,
    activeConversationId,
    setActiveConversation,
  ]);

  return (
    <div className="size-full flex overflow-hidden">
      {/* Unified Messenger Sidebar */}
      <ChatSidebar conversations={conversations} isLoading={isLoading} />

      {/* Main Chat Workbench */}
      <ChatWindow conversation={activeConversation} />

      {/* Dialogs */}
      <CreateChannelModal />
      <CreateGroupModal />
      <FriendManagerModal />
    </div>
  );
}
