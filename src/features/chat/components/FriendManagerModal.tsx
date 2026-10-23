'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Check,
  X,
  MessageSquare,
  Clock,
  Loader2,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { useChatStore } from '../store/chat.store';
import { useFriends, useFriendRequests, useCreateDirect } from '../hooks/use-chat-queries';
import { chatService } from '../services/chat.service';
import { SearchedUser } from '../types/chat.types';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

type ModalTab = 'search' | 'requests' | 'friends';

export function FriendManagerModal() {
  const {
    isFriendManagerModalOpen,
    closeFriendManagerModal,
    setActiveConversation,
  } = useChatStore();

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ModalTab>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { data: friends = [], isLoading: isLoadingFriends } = useFriends();
  const { data: friendRequests, isLoading: isLoadingRequests } = useFriendRequests();
  const createDirectMutation = useCreateDirect();

  // Execute user search or suggested connections lookup
  const executeSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const users = await chatService.searchUsers(query);
      setSearchResults(users);
    } catch (err: any) {
      console.error('Search users error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Auto switch to requests tab if there are incoming requests when modal opens
  useEffect(() => {
    if (isFriendManagerModalOpen && friendRequests?.incoming && friendRequests.incoming.length > 0) {
      setActiveTab('requests');
    }
  }, [isFriendManagerModalOpen, friendRequests?.incoming?.length]);

  // Facebook-style: Load suggested connections immediately when modal opens on search tab
  useEffect(() => {
    if (isFriendManagerModalOpen && activeTab === 'search' && !searchQuery.trim()) {
      executeSearch('');
    }
  }, [isFriendManagerModalOpen, activeTab, executeSearch]);

  // Snappy real-time typeahead (150ms debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(searchQuery);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, executeSearch]);

  // Instant trigger if user presses Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(searchQuery);
    }
  };

  // One-click clear search to quickly return to suggestions
  const handleClearSearch = () => {
    setSearchQuery('');
    executeSearch('');
  };

  // Send friend request
  const handleSendRequest = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    try {
      await chatService.sendFriendRequest(targetUserId);
      toast.success('Friend request sent');
      // Update local search results
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === targetUserId
            ? { ...u, friendship: { id: '', status: 'pending', isRequester: true } }
            : u,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ['chat-friend-requests'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send friend request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept request
  const handleAcceptRequest = async (requestId: string) => {
    setActionLoadingId(requestId);
    try {
      await chatService.acceptFriendRequest(requestId);
      toast.success('Friend request accepted');
      queryClient.invalidateQueries({ queryKey: ['chat-friends'] });
      queryClient.invalidateQueries({ queryKey: ['chat-friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to accept friend request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Decline request
  const handleDeclineRequest = async (requestId: string) => {
    setActionLoadingId(requestId);
    try {
      await chatService.declineFriendRequest(requestId);
      toast.info('Friend request declined');
      queryClient.invalidateQueries({ queryKey: ['chat-friend-requests'] });
    } catch (err: any) {
      toast.error(err?.message || 'Error declining request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Start direct conversation with friend
  const handleStartChat = async (targetUserId: string) => {
    try {
      const conv = await createDirectMutation.mutateAsync(targetUserId);
      setActiveConversation(conv as any);
      closeFriendManagerModal();
    } catch (err: any) {
      toast.error(err?.message || 'Could not open conversation');
    }
  };

  const incomingCount = friendRequests?.incoming?.length || 0;

  return (
    <Dialog open={isFriendManagerModalOpen} onOpenChange={closeFriendManagerModal}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-lg border border-border bg-background shadow-raised-200">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-15 font-semibold text-foreground">
            <UserPlus className="size-4 text-foreground shrink-0" />
            <span>Friends & Connections</span>
          </DialogTitle>

          {/* Navigation Tabs (Plane.so segmented control style) */}
          <div className="flex items-center gap-1 pt-2">
            <button
              onClick={() => setActiveTab('search')}
              className={cn(
                'h-7 px-2.5 rounded-md text-13 transition-colors cursor-pointer outline-none',
                activeTab === 'search'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal',
              )}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={cn(
                'h-7 px-2.5 rounded-md text-13 transition-colors cursor-pointer outline-none',
                activeTab === 'requests'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal',
              )}
            >
              Requests {incomingCount > 0 && `(${incomingCount})`}
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={cn(
                'h-7 px-2.5 rounded-md text-13 transition-colors cursor-pointer outline-none',
                activeTab === 'friends'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-normal',
              )}
            >
              Friends ({friends.length})
            </button>
          </div>
        </DialogHeader>

        {/* Tab 1: Search Users */}
        {activeTab === 'search' && (
          <div className="p-4 space-y-3">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 size-3.5 text-foreground shrink-0 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name or email..."
                className="pl-8 pr-8 text-13 h-8 rounded-md bg-background border border-border shadow-2xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
              />
              {isSearching ? (
                <div className="absolute right-2.5 flex items-center justify-center pointer-events-none">
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                </div>
              ) : searchQuery ? (
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-2.5 size-4 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors outline-none"
                      aria-label="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Clear search</TooltipContent>
                </Tooltip>
              ) : null}
            </div>

            {/* Header label: Suggestions vs Search Results */}
            <div className="flex items-center justify-between px-0.5 text-11 font-medium text-muted-foreground">
              <span>{searchQuery.trim() ? 'Search Results' : 'Suggested Connections'}</span>
              <span>{searchResults.length} {searchResults.length === 1 ? 'user' : 'users'}</span>
            </div>

            <div className="min-h-56 max-h-72 overflow-y-auto space-y-1.5 pr-1 sidebar-scrollbar">
              {isSearching && searchResults.length === 0 ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-12 text-muted-foreground px-4">
                  {searchQuery.trim()
                    ? 'No users found matching your search'
                    : 'No suggestions available. Suggestions appear when you share projects or mutual friends.'}
                </div>
              ) : (
                searchResults.map((user) => {
                  const status = user.friendship?.status;
                  const isRequester = user.friendship?.isRequester;
                  const isActionLoading = actionLoadingId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Avatar className="size-7">
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                            {user.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="text-13 font-medium text-foreground truncate">
                            {user.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-11 text-muted-foreground truncate">
                            <span className="truncate">{user.email}</span>
                            {user.connectionContext?.sharedProjects && user.connectionContext.sharedProjects.length > 0 ? (
                              <>
                                <span className="shrink-0">•</span>
                                <span className="font-normal text-muted-foreground truncate" title={user.connectionContext.sharedProjects.join(', ')}>
                                  {user.connectionContext.sharedProjects[0]}
                                  {user.connectionContext.sharedProjects.length > 1 ? ` (+${user.connectionContext.sharedProjects.length - 1})` : ''}
                                </span>
                              </>
                            ) : user.connectionContext?.mutualFriendsCount && user.connectionContext.mutualFriendsCount > 0 ? (
                              <>
                                <span className="shrink-0">•</span>
                                <span className="font-normal text-muted-foreground truncate">
                                  {user.connectionContext.mutualFriendsCount} mutual friend{user.connectionContext.mutualFriendsCount > 1 ? 's' : ''}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {status === 'accepted' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-12 px-2.5 rounded-md shadow-2xs"
                            onClick={() => handleStartChat(user.id)}
                          >
                            <MessageSquare className="size-3 mr-1" />
                            Message
                          </Button>
                        ) : status === 'pending' ? (
                          <Badge
                            variant="outline"
                            className="h-6 text-11 font-mono font-medium bg-muted text-muted-foreground rounded-sm border border-border gap-1"
                          >
                            <Clock className="size-2.5" />
                            {isRequester ? 'Request Sent' : 'Pending Approval'}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-12 px-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shadow-none"
                            disabled={isActionLoading}
                            onClick={() => handleSendRequest(user.id)}
                          >
                            {isActionLoading ? (
                              <Loader2 className="size-3 animate-spin mr-1" />
                            ) : (
                              <UserPlus className="size-3 mr-1" />
                            )}
                            Add Friend
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Requests */}
        {activeTab === 'requests' && (
          <div className="p-4 space-y-4 max-h-80 overflow-y-auto sidebar-scrollbar">
            {/* Incoming */}
            <div className="space-y-2">
              <h4 className="text-11 font-medium text-muted-foreground">
                Received Requests ({incomingCount})
              </h4>
              {isLoadingRequests ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : incomingCount === 0 ? (
                <p className="text-12 text-muted-foreground py-2 text-center">
                  No pending friend requests.
                </p>
              ) : (
                friendRequests?.incoming.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-2 rounded-md border border-border bg-background"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Avatar className="size-7">
                        <AvatarImage src={req.user.avatar || undefined} />
                        <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                          {req.user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <p className="text-13 font-medium text-foreground">{req.user.name}</p>
                        <p className="text-11 text-muted-foreground truncate">{req.user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="default"
                            className="size-7 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover shadow-none"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAcceptRequest(req.id)}
                            aria-label="Accept"
                          >
                            <Check className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Accept</TooltipContent>
                      </Tooltip>

                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className="size-7 rounded-md text-muted-foreground hover:text-foreground shadow-2xs"
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleDeclineRequest(req.id)}
                            aria-label="Decline"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Decline</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Outgoing */}
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-11 font-medium text-muted-foreground">
                Sent Requests ({friendRequests?.outgoing.length || 0})
              </h4>
              {friendRequests?.outgoing.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/40"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Avatar className="size-7">
                      <AvatarImage src={req.user.avatar || undefined} />
                      <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                        {req.user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-13 font-medium text-foreground truncate">
                      {req.user.name}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-11 font-mono font-medium bg-muted text-muted-foreground border-border rounded-sm">
                    Pending
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Friends List */}
        {activeTab === 'friends' && (
          <div className="p-4 max-h-80 overflow-y-auto space-y-2 sidebar-scrollbar">
            {isLoadingFriends ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <div className="py-8 text-center text-12 text-muted-foreground">
                You don't have any friends yet. Switch to the "Search" tab to find colleagues!
              </div>
            ) : (
              friends.map((item) => (
                <div
                  key={item.friendshipId}
                  className="flex items-center justify-between p-2 rounded-md border border-border bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative shrink-0">
                      <Avatar className="size-7">
                        <AvatarImage src={item.friend.avatar || undefined} />
                        <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                          {item.friend.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                    </div>
                    <div className="truncate">
                      <p className="text-13 font-medium text-foreground">{item.friend.name}</p>
                      <p className="text-11 text-muted-foreground truncate">
                        {item.friend.institution || item.friend.email}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-12 px-2.5 rounded-md shadow-2xs"
                    onClick={() => handleStartChat(item.friend.id)}
                  >
                    <MessageSquare className="size-3 mr-1" />
                    Message
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
