'use client';

import React, { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { useConversations } from '../hooks/use-chat-queries';
import { useChatStore } from '../store/chat.store';

const CreateChannelModal = dynamic(
  () => import('./CreateChannelModal').then((m) => m.CreateChannelModal),
  { ssr: false }
);
const CreateGroupModal = dynamic(
  () => import('./CreateGroupModal').then((m) => m.CreateGroupModal),
  { ssr: false }
);
const FriendManagerModal = dynamic(
  () => import('./FriendManagerModal').then((m) => m.FriendManagerModal),
  { ssr: false }
);

function ChatModalsSlot() {
  const isCreateChannelModalOpen = useChatStore((s) => s.isCreateChannelModalOpen);
  const isCreateGroupModalOpen = useChatStore((s) => s.isCreateGroupModalOpen);
  const isFriendManagerModalOpen = useChatStore((s) => s.isFriendManagerModalOpen);

  return (
    <>
      {isCreateChannelModalOpen && <CreateChannelModal />}
      {isCreateGroupModalOpen && <CreateGroupModal />}
      {isFriendManagerModalOpen && <FriendManagerModal />}
    </>
  );
}

export function ChatView() {
  const { data: conversationsData, isLoading, isError, error } = useConversations();
  const {
    isSidebarOpen,
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

  if (isError) {
    return (
      <div className="size-full flex items-center justify-center p-8 bg-background">
        <PlaneErrorState
          title="Unable to load conversations"
          description="We couldn't retrieve your channels and messages. Other workspaces remain safe."
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="size-full flex overflow-hidden">
      {/* Unified Messenger Sidebar */}
      {isSidebarOpen && <ChatSidebar conversations={conversations} isLoading={isLoading} />}

      {/* Main Chat Workbench */}
      <ChatWindow conversation={activeConversation} />

      {/* Dialogs */}
      <ChatModalsSlot />
    </div>
  );
}
