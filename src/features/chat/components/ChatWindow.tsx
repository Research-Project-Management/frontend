'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Hash,
  Info,
  MoreVertical,
  Loader2,
  ChevronRight,
  PanelLeft,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useChatStore } from '../store/chat.store';
import { useInfiniteMessages, useSendMessage, useAddReaction } from '../hooks/use-chat-queries';
import { useChatSocket } from '../hooks/use-chat-socket';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { ChatMessage, ConversationItem } from '../types/chat.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

interface ChatWindowProps {
  conversation: ConversationItem | null;
}

export function ChatWindow({ conversation }: ChatWindowProps) {
  const { user } = useAuth();
  const { typingUsers, setReplyingToMessage, isSidebarOpen, toggleSidebar } = useChatStore();

  const conversationId = conversation?.id || null;

  // React Query Infinite Messages
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingMessages,
    isError: isErrorMessages,
    error: messagesError,
  } = useInfiniteMessages(conversationId);

  // Realtime Socket
  const { sendSocketMessage, emitTyping, emitReaction } = useChatSocket(conversationId);

  // Mutations
  const sendMessageMutation = useSendMessage(conversationId);
  const addReactionMutation = useAddReaction(conversationId);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isInitialScrollRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const isNearBottomRef = useRef(true);

  // Flatten messages: pages are returned descending (newest first).
  // For standard chat UI (bottom is newest), we reverse the full list.
  const flatMessages = useMemo(() => {
    if (!data?.pages) return [];
    const allDescending = data.pages.flatMap((page) => page.messages);
    return [...allDescending].reverse();
  }, [data]);

  // Auto-scroll logic:
  // 1. Initial conversation load: instant jump to bottom
  // 2. When new messages arrive:
  //    - If current user sent it: smooth scroll down immediately
  //    - If received from room: smooth scroll down if already near bottom (<= 150px)
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el || flatMessages.length === 0) return;

    if (isInitialScrollRef.current) {
      el.scrollTop = el.scrollHeight;
      isInitialScrollRef.current = false;
      prevMessagesLengthRef.current = flatMessages.length;
      return;
    }

    const hasNewMessage = flatMessages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = flatMessages.length;

    if (hasNewMessage) {
      const lastMessage = flatMessages[flatMessages.length - 1];
      const isSentByMe = lastMessage?.senderId === user?.id;

      if (isSentByMe || isNearBottomRef.current) {
        requestAnimationFrame(() => {
          if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTo({
              top: scrollViewportRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }
        });
      }
    }
  }, [flatMessages, user?.id]);

  // Reset initial scroll flag when changing conversation
  useEffect(() => {
    isInitialScrollRef.current = true;
    prevMessagesLengthRef.current = 0;
    isNearBottomRef.current = true;
  }, [conversationId]);

  // Scroll handler for Reverse Infinite Scroll and near-bottom tracking
  const handleScroll = useCallback(() => {
    const el = scrollViewportRef.current;
    if (!el) return;

    // Track if user is near bottom
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceToBottom < 150;

    // Reverse Infinite Scroll (load older messages when scrolled near top)
    if (!hasNextPage || isFetchingNextPage) return;

    if (el.scrollTop < 100) {
      const prevScrollHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;

      fetchNextPage().then(() => {
        // Retain scroll position to prevent jarring jump
        requestAnimationFrame(() => {
          if (el) {
            const heightDiff = el.scrollHeight - prevScrollHeight;
            el.scrollTop = prevScrollTop + heightDiff;
          }
        });
      });
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSendMessage = (content: string, replyTo?: ChatMessage | null) => {
    // 1. Single channel mutation: creates instant 0ms optimistic message with reply quote in UI & persists to DB
    sendMessageMutation.mutate({
      content,
      replyToId: replyTo?.id,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            sender: {
              id: replyTo.sender?.id,
              name: replyTo.sender?.name || (replyTo.sender as any)?.profile?.name || 'User',
            },
          }
        : null,
    });

    // 2. Scroll to bottom immediately on send
    requestAnimationFrame(() => {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({
          top: scrollViewportRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    });
  };

  const handleReaction = (messageId: string, emoji: string) => {
    emitReaction(messageId, emoji, 'add');
    addReactionMutation.mutate({ messageId, emoji });
  };

  const activeTypers = conversationId ? typingUsers[conversationId] || [] : [];

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
        {/* Topbar: Standard height h-11 with border-b matching LibraryTopbar & ProjectTopbar */}
        <header className="h-11 shrink-0 border-b border-border px-3 sm:px-4 flex items-center justify-between bg-transparent select-none">
          <div className="flex items-center gap-2 min-w-0">
            {!isSidebarOpen && (
              <div className="flex items-center gap-1.5 -ml-1 mr-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={toggleSidebar}
                      className="size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0"
                      aria-label="Expand sidebar"
                    >
                      <PanelLeft className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={6}>
                    Expand sidebar
                  </TooltipContent>
                </Tooltip>
                <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
              </div>
            )}

            <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-13 font-medium">
              <span className="text-foreground flex items-center gap-1.5 font-heading font-semibold">
                <MessageSquare className="size-4 shrink-0 text-foreground" />
                <span>Messages</span>
              </span>
            </nav>
          </div>
        </header>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <PlaneEmptyState
            variant="chat"
            title="Select a conversation to start"
            description="Choose a project channel, direct message, or group from the left panel to begin collaborating."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Topbar: Standard height h-11 with border-b matching LibraryTopbar & ProjectTopbar */}
      <header className="h-11 shrink-0 border-b border-border px-3 sm:px-4 flex items-center justify-between bg-transparent select-none">
        <div className="flex items-center gap-2 truncate min-w-0 mr-2">
          {/* Sidebar Toggle when collapsed */}
          {!isSidebarOpen && (
            <div className="flex items-center gap-1.5 -ml-1 mr-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeft className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" sideOffset={6}>
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
              <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
            </div>
          )}

          {/* Breadcrumbs Navigation matching Flux style */}
          <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-13 font-medium min-w-0 truncate">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span>Messages</span>
            </span>

            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />

            {conversation.type === 'project_channel' && conversation.projectName && (
              <>
                <span className="text-muted-foreground truncate max-w-[140px] shrink-0">
                  {conversation.projectName}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              </>
            )}

            <div className="flex items-center gap-1.5 font-heading font-semibold text-13 text-foreground truncate min-w-0">
              {conversation.type === 'project_channel' ? (
                <>
                  <Hash className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{conversation.name}</span>
                </>
              ) : conversation.type === 'group' ? (
                <>
                  <Avatar className="size-5 rounded-md shrink-0">
                    <AvatarImage src={conversation.avatar || undefined} />
                    <AvatarFallback className="rounded-md text-[10px] font-medium bg-muted text-foreground">
                      {conversation.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{conversation.name}</span>
                </>
              ) : (
                <>
                  <div className="relative shrink-0">
                    <Avatar className="size-5 rounded-full">
                      <AvatarImage src={conversation.avatar || conversation.otherUser?.avatar || undefined} />
                      <AvatarFallback className="text-[10px] font-medium bg-muted text-foreground">
                        {conversation.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-1.5 rounded-full bg-emerald-500 ring-1 ring-background" />
                  </div>
                  <span className="truncate">{conversation.name}</span>
                </>
              )}
            </div>

            {conversation.topic && (
              <span className="text-12 font-normal text-muted-foreground truncate hidden lg:inline ml-1">
                - {conversation.topic}
              </span>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                aria-label="Conversation details"
              >
                <Info className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Conversation details</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            aria-label="More options"
          >
            <MoreVertical className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div
        ref={scrollViewportRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {/* Loading Spinner for older messages */}
        {isFetchingNextPage && (
          <div className="py-2 flex items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Initial Loading */}
        {isLoadingMessages ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isErrorMessages ? (
          <div className="h-full flex items-center justify-center p-6">
            <PlaneErrorState
              title="Unable to load messages"
              description="An error occurred while loading message history for this conversation."
              error={messagesError}
            />
          </div>
        ) : flatMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6 select-none">
            <PlaneEmptyState
              variant="chat"
              isCompact
              title={`Welcome to ${conversation.type === 'project_channel' ? `#${conversation.name}` : conversation.name}!`}
              description={`This is the start of the ${conversation.type === 'project_channel' ? `#${conversation.name} channel` : conversation.name}. Send a message to start collaborating with members!`}
            />
          </div>
        ) : (
          flatMessages.map((msg: ChatMessage) => (
            <MessageItem
              key={msg.id}
              message={msg}
              isSelf={msg.senderId === user?.id}
              onReply={setReplyingToMessage}
              onReaction={handleReaction}
            />
          ))
        )}
      </div>

      {/* Realtime Typing Indicator */}
      {activeTypers.length > 0 && (
        <div className="px-4 py-1 text-11 text-muted-foreground italic flex items-center gap-1.5 animate-pulse bg-background">
          <span className="size-1.5 rounded-full bg-muted-foreground" />
          <span>
            {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is typing...' : 'are typing...'}
          </span>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onTyping={emitTyping}
        isSending={sendMessageMutation.isPending}
      />
    </div>
  );
}
