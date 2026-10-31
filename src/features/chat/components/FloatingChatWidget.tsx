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
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { useChatStore } from '../store/chat.store';

export default function FloatingChatWidget() {
  const pathname = usePathname();
  const { user } = useAuth();

  const { isFloatingChatOpen, setFloatingChatOpen } = useChatStore();
  const isOpen = isFloatingChatOpen;
  const setIsOpen = setFloatingChatOpen;
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [messageInput, setMessageInput] = useState('');

  const expandSearch = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const handleClearSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery('');
    setIsSearchExpanded(false);
  };

  const { data: conversationsData } = useConversations();
  const { totalUnreadMessages, pendingFriendRequests, totalBadgeCount } = useChatBadgeCounts();

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

  // If on the full /chat page, do not render the floating widget
  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    return null;
  }

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
          <div className={cn(
            "h-11 px-2.5 bg-background flex items-center justify-between shrink-0 select-none",
            selectedConversation ? "border-b border-border px-3" : ""
          )}>
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
            ) : isSearchExpanded || searchQuery ? (
              <div className="relative flex items-center w-full h-8 rounded-md border border-border bg-background overflow-hidden font-normal text-13">
                <Search
                  className="absolute top-1/2 -translate-y-1/2 size-3.5 z-10 left-2.5 text-muted-foreground pointer-events-none shrink-0"
                  strokeWidth={1.5}
                />
                <input
                  ref={searchInputRef}
                  autoFocus
                  placeholder="Search conversations..."
                  aria-label="Search conversations"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      setIsSearchExpanded(false);
                    }
                  }}
                  onBlur={() => {
                    if (!searchQuery) {
                      setIsSearchExpanded(false);
                    }
                  }}
                  className="h-full text-12 font-normal py-0 leading-none border-none bg-transparent focus:outline-none outline-none shadow-none w-full placeholder:text-muted-foreground pl-8 pr-7 text-foreground"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={handleClearSearch}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer rounded-md outline-none"
                      aria-label="Clear search"
                    >
                      <X className="size-3 shrink-0" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear search</TooltipContent>
                </Tooltip>
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

            {(!isSearchExpanded && !searchQuery || selectedConversation) && (
              <div className="flex items-center gap-1">
                {!selectedConversation && (
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                        onClick={expandSearch}
                        aria-label="Search conversations"
                      >
                        <Search className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Search conversations</TooltipContent>
                  </Tooltip>
                )}

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
                        <span className="font-mono text-11 font-semibold tabular-nums">{pendingFriendRequests}</span>
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
                      aria-label="Toàn màn hình"
                      className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                    >
                      <Maximize2 className="size-3.5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Toàn màn hình</TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => setIsOpen(false)}
                      aria-label="Thu gọn"
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Thu gọn</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Body */}
          {selectedConversation ? (
            <FloatingConversationView
              conversation={selectedConversation}
              currentUserId={user?.id}
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-background">

              {/* Tabs */}
              <div className="px-2 shrink-0 grid grid-cols-4 border-b border-border bg-background">
                {(['all', 'project', 'direct', 'group'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={cn(
                      'py-1.5 text-center text-11 transition-colors cursor-pointer capitalize outline-none truncate',
                      filterTab === tab
                        ? 'text-primary font-medium border-b-2 border-primary -mb-[1px]'
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
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toast.info('File attachment feature is currently in development')}
              className="size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer shrink-0"
              aria-label="Attachments"
            >
              <Paperclip className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Attach file</TooltipContent>
        </Tooltip>
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
