'use client';

import React, { useState, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  X,
  Maximize2,
  ArrowLeft,
  Search,
  Send,
  Hash,
  Users,
  FolderGit2,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useConversations, useInfiniteMessages, useSendMessage, useChatBadgeCounts } from '../hooks/use-chat-queries';
import { useChatSocket } from '../hooks/use-chat-socket';
import { ConversationItem, FilterTab } from '../types/chat.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';

export default function FloatingChatWidget() {
  const pathname = usePathname();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');

  const { data: conversationsData } = useConversations();
  const { totalUnreadMessages, pendingFriendRequests, totalBadgeCount } = useChatBadgeCounts();

  // If on the full /chat page, do not render the floating widget
  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    return null;
  }

  // Group conversations
  const allConversations = useMemo(() => {
    const directs = conversationsData?.directs || [];
    const groups = conversationsData?.groups || [];
    const projectChannels = conversationsData?.projectChannels || [];
    return { directs, groups, projectChannels };
  }, [conversationsData]);

  // Total unread count
  const totalUnread = useMemo(() => {
    const dCount = allConversations.directs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const gCount = allConversations.groups.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const pCount = allConversations.projectChannels.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    return dCount + gCount + pCount;
  }, [allConversations]);

  // Filtered list
  const filteredList = useMemo(() => {
    let items: ConversationItem[] = [];
    if (filterTab === 'all') {
      items = [
        ...allConversations.projectChannels,
        ...allConversations.directs,
        ...allConversations.groups,
      ];
    } else if (filterTab === 'project') {
      items = allConversations.projectChannels;
    } else if (filterTab === 'direct') {
      items = allConversations.directs;
    } else if (filterTab === 'group') {
      items = allConversations.groups;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;

    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.lastMessageSnippet && c.lastMessageSnippet.toLowerCase().includes(q)) ||
        (c.projectName && c.projectName.toLowerCase().includes(q)),
    );
  }, [allConversations, filterTab, searchQuery]);

  return (
    <>
      {/* ── 1. Floating Chat Window (Messenger Popover) ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Quick Chat"
          className="fixed bottom-[72px] right-4 md:bottom-[76px] md:right-5 z-50 w-80 sm:w-[350px] h-[480px] max-h-[calc(100vh-6rem)] rounded-lg border border-border bg-background shadow-raised-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {/* Header */}
          <div className="h-11 px-3 border-b border-border bg-background flex items-center justify-between shrink-0 select-none">
            {selectedConversation ? (
              <div className="flex items-center gap-2 min-w-0">
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => setSelectedConversation(null)}
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Back to conversations</TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-1.5 min-w-0">
                  {selectedConversation.type === 'project_channel' ? (
                    <Hash className="size-3.5 text-foreground shrink-0" />
                  ) : (
                    <Avatar className="size-6 shrink-0">
                      <AvatarImage src={selectedConversation.avatar || selectedConversation.otherUser?.avatar || undefined} />
                      <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                        {selectedConversation.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="text-13 font-semibold text-foreground truncate max-w-[160px]">
                    {selectedConversation.name}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-foreground shrink-0" />
                <span className="text-13 font-semibold text-foreground">Messages</span>
                {totalBadgeCount > 0 && (
                  <span
                    className="px-1.5 py-0.2 rounded-full text-11 font-mono font-medium bg-muted text-foreground border border-border tabular-nums"
                    title={`${totalUnreadMessages} unread messages, ${pendingFriendRequests} pending requests`}
                  >
                    {totalBadgeCount}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-1">
              {pendingFriendRequests > 0 && (
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Link
                      href="/chat"
                      onClick={() => setIsOpen(false)}
                      aria-label={`${pendingFriendRequests} pending friend request${pendingFriendRequests > 1 ? 's' : ''}`}
                      className="h-6 px-1.5 rounded-md text-11 font-medium bg-muted text-foreground hover:bg-muted/80 flex items-center gap-1 border border-border transition-colors"
                    >
                      <UserPlus className="size-3 text-foreground" />
                      <span className="font-mono text-11 font-bold tabular-nums">{pendingFriendRequests}</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {pendingFriendRequests} pending friend request{pendingFriendRequests > 1 ? 's' : ''}
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <Link
                    href={selectedConversation ? `/chat?id=${selectedConversation.id}` : '/chat'}
                    onClick={() => setIsOpen(false)}
                    aria-label="Open full messenger"
                    className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <Maximize2 className="size-3.5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open full messenger</TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close chat"
                  >
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Close chat</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Body */}
          {selectedConversation ? (
            <FloatingConversationView
              conversation={selectedConversation}
              currentUserId={user?.id}
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-background">
              {/* Search */}
              <div className="p-2 pb-1.5 border-b border-border bg-background">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 size-3 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-7 pl-7 pr-2.5 text-12 font-normal rounded-md bg-background border border-border shadow-2xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="px-2 shrink-0 grid grid-cols-4 border-b border-border bg-background">
                {(['all', 'project', 'direct', 'group'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={cn(
                      'py-1.5 text-center text-11 transition-colors cursor-pointer capitalize outline-none truncate',
                      filterTab === tab
                        ? 'text-foreground font-medium border-b-2 border-foreground -mb-[1px]'
                        : 'text-muted-foreground hover:text-foreground font-normal border-b-2 border-transparent -mb-[1px]',
                    )}
                  >
                    {tab === 'project' ? 'Projects' : tab === 'direct' ? 'Direct' : tab === 'group' ? 'Groups' : 'All'}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5 sidebar-scrollbar">
                {filteredList.length === 0 ? (
                  <div className="py-8 px-2">
                    <PlaneEmptyState
                      variant="search"
                      isCompact
                      title="No conversations"
                      description="No conversations found."
                    />
                  </div>
                ) : (
                  filteredList.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className="w-full px-2 py-1.5 rounded-md flex items-center gap-2 hover:bg-muted text-left transition-colors cursor-pointer outline-none group"
                    >
                      {conv.type === 'project_channel' ? (
                        <div className="size-7 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                          <Hash className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                        </div>
                      ) : (
                        <div className="relative shrink-0">
                          <Avatar className="size-7">
                            <AvatarImage src={conv.avatar || conv.otherUser?.avatar || undefined} />
                            <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                              {conv.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-12 font-medium text-foreground truncate">
                            {conv.name}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-11 font-mono font-medium tabular-nums bg-muted text-foreground border border-border shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        {conv.lastMessageSnippet && (
                          <p className="text-11 text-muted-foreground truncate">
                            {conv.lastSenderName ? `${conv.lastSenderName}: ` : ''}
                            {conv.lastMessageSnippet}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Floating Action Button Trigger ── */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Messages"
            className={cn(
              'fixed bottom-4 right-4 md:bottom-5 md:right-5 z-40 flex items-center justify-center size-[52px] rounded-full bg-background border border-border shadow-raised-200 hover:bg-muted text-foreground transition-[transform,background-color,border-color,box-shadow] duration-200 hover:scale-105 active:scale-95 cursor-pointer outline-none select-none',
              isOpen && 'bg-muted ring-2 ring-primary/30',
            )}
          >
            {isOpen ? (
              <X className="size-6 text-foreground shrink-0" />
            ) : (
              <MessageSquare className="size-6 text-foreground shrink-0" />
            )}
            {!isOpen && totalBadgeCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground font-mono text-11 font-semibold flex items-center justify-center ring-2 ring-background shadow-xs pointer-events-none"
                title={`${totalUnreadMessages} unread messages, ${pendingFriendRequests} pending requests`}
              >
                {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          {totalBadgeCount > 0 ? (
            <div className="flex flex-col gap-0.5 text-11">
              <span className="font-semibold text-foreground">Messages</span>
              {totalUnreadMessages > 0 && (
                <span className="text-muted-foreground">{totalUnreadMessages} unread message{totalUnreadMessages > 1 ? 's' : ''}</span>
              )}
              {pendingFriendRequests > 0 && (
                <span className="text-muted-foreground">{pendingFriendRequests} friend request{pendingFriendRequests > 1 ? 's' : ''}</span>
              )}
            </div>
          ) : (
            'Messages'
          )}
        </TooltipContent>
      </Tooltip>
    </>
  );
}

// ── Subcomponent: Compact Conversation View inside Floating Widget ──
function FloatingConversationView({
  conversation,
  currentUserId,
}: {
  conversation: ConversationItem;
  currentUserId?: string;
}) {
  const [content, setContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error } = useInfiniteMessages(conversation.id);
  const { emitTyping } = useChatSocket(conversation.id);
  const sendMessageMutation = useSendMessage(conversation.id);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten messages
  const flatMessages = useMemo(() => {
    if (!data?.pages) return [];
    const all = data.pages.flatMap((p) => p.messages);
    return [...all].reverse();
  }, [data]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [flatMessages.length]);

  // Cleanup typing timer on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    };
  }, []);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || sendMessageMutation.isPending) return;

    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    emitTyping(false);

    sendMessageMutation.mutate({ content: trimmed });
    setContent('');

    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);

    if (val.trim().length > 0) {
      emitTyping(true);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        emitTyping(false);
      }, 1500);
    } else {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      emitTyping(false);
    }
  };

  const handleBlur = () => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    emitTyping(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 sidebar-scrollbar"
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="h-full flex items-center justify-center p-4">
            <PlaneErrorState
              title="Unable to load messages"
              description="Could not load message history."
              error={error}
            />
          </div>
        ) : flatMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <PlaneEmptyState
              variant="chat"
              isCompact
              title="No messages yet"
              description="Send a message to start the conversation."
            />
          </div>
        ) : (
          flatMessages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn('flex flex-col max-w-[85%] space-y-0.5', isSelf ? 'ml-auto items-end' : 'mr-auto items-start')}
              >
                {!isSelf && (
                  <span className="text-11 text-muted-foreground px-1 truncate">
                    {msg.sender?.name || 'User'}
                  </span>
                )}
                <div
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-12 leading-relaxed whitespace-pre-wrap break-words',
                    isSelf
                      ? 'bg-background border border-border text-foreground shadow-2xs'
                      : 'bg-muted border border-border/50 text-foreground',
                  )}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border bg-background flex items-center gap-1.5 shrink-0">
        <input
          type="text"
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 h-8 px-2.5 text-12 font-normal rounded-md bg-background border border-border shadow-2xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          autoFocus
        />
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              disabled={!content.trim() || sendMessageMutation.isPending}
              onClick={handleSend}
              className="size-8 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shrink-0 shadow-none transition-transform active:scale-95 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Send (Enter)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
