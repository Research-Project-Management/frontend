'use client';
import { Skeleton } from '@/shared/components/ui/skeleton';

import React, { useMemo } from 'react';
import {
  PanelLeft,
  Hash,
  Search,
  Plus,
  Users,
  FolderGit2,
  ChevronDown,
  UserPlus,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useChatStore } from '../store/chat.store';
import { useFriendRequests } from '../hooks/use-chat-queries';
import { ConversationItem, FilterTab } from '../types/chat.types';
import { usePanelResize } from '@/features/library/ui/hooks/usePanelResize';
import { SidebarResizer } from '@/features/library/ui/sidebar/SidebarResizer';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';

interface ChatSidebarProps {
  conversations: {
    directs: ConversationItem[];
    groups: ConversationItem[];
    projectChannels: ConversationItem[];
  };
  isLoading?: boolean;
}

export function ChatSidebar({ conversations, isLoading }: ChatSidebarProps) {
  const {
    activeConversationId,
    setActiveConversation,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    openCreateChannelModal,
    openCreateGroupModal,
    openFriendManagerModal,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
  } = useChatStore();

  const { isDragging, handleMouseDown } = usePanelResize({
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    direction: 'right',
    minWidth: 200,
    maxWidth: 400,
  });

  const { data: friendRequests } = useFriendRequests();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const pendingFriendRequests = mounted ? (friendRequests?.incoming?.length || 0) : 0;
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

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

  // Group project channels by project
  const projectGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        projectId: string;
        projectName: string;
        projectIdentifier: string;
        channels: ConversationItem[];
      }
    > = {};

    conversations.projectChannels.forEach((ch) => {
      const pId = ch.projectId || 'other';
      if (!groups[pId]) {
        groups[pId] = {
          projectId: pId,
          projectName: ch.projectName || 'Project',
          projectIdentifier: ch.projectIdentifier || '',
          channels: [],
        };
      }
      groups[pId].channels.push(ch);
    });

    return Object.values(groups);
  }, [conversations.projectChannels]);

  // Filtering based on active tab and search query
  const query = searchQuery.toLowerCase().trim();

  const filteredDirects = useMemo(() => {
    if (filterTab !== 'all' && filterTab !== 'direct') return [];
    return conversations.directs.filter(
      (c) =>
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.otherUser?.email && c.otherUser.email.toLowerCase().includes(query)) ||
        (c.lastMessageSnippet && c.lastMessageSnippet.toLowerCase().includes(query)),
    );
  }, [conversations.directs, filterTab, query]);

  const filteredGroups = useMemo(() => {
    if (filterTab !== 'all' && filterTab !== 'group') return [];
    return conversations.groups.filter(
      (c) =>
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.lastMessageSnippet && c.lastMessageSnippet.toLowerCase().includes(query)),
    );
  }, [conversations.groups, filterTab, query]);

  const filteredProjectGroups = useMemo(() => {
    if (filterTab !== 'all' && filterTab !== 'project') return [];
    return projectGroups
      .map((group) => {
        const matchedChannels = group.channels.filter(
          (ch) =>
            !query ||
            ch.name.toLowerCase().includes(query) ||
            group.projectName.toLowerCase().includes(query) ||
            (ch.lastMessageSnippet && ch.lastMessageSnippet.toLowerCase().includes(query)),
        );
        return {
          ...group,
          channels: matchedChannels,
        };
      })
      .filter((group) => group.channels.length > 0);
  }, [projectGroups, filterTab, query]);

  const tabs: Array<{ id: FilterTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'project', label: 'Projects' },
    { id: 'direct', label: 'Direct' },
    { id: 'group', label: 'Groups' },
  ];

  return (
    <aside
      aria-label="Messages navigation"
      style={{
        width: `${sidebarWidth}px`,
        minWidth: '200px',
        maxWidth: '400px',
      }}
      className="relative z-20 shrink-0 border-r border-border flex flex-col h-full select-none"
    >
      {/* 1. Header Row (Fixed height h-11, matching Topbar & LibrarySidebar, without border-b) */}
      <div className="h-11 px-2.5 flex items-center shrink-0 select-none">
        <div
          className={cn(
            'flex items-center h-8 font-semibold text-sm tracking-tight text-foreground select-none w-full',
            isSearchExpanded || searchQuery ? 'px-0' : 'justify-between px-1',
          )}
        >
          {isSearchExpanded || searchQuery ? (
            <div className="relative flex items-center w-full h-8 rounded-md border border-border bg-background overflow-hidden font-normal text-13">
              <Search
                className="absolute top-1/2 -translate-y-1/2 size-3.5 z-10 left-2.5 translate-x-0 text-muted-foreground pointer-events-none shrink-0"
                strokeWidth={1.5}
              />
              <Input
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
                className="h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 focus-visible:border-none focus-visible:outline-none focus:outline-none outline-none shadow-none w-full placeholder:text-muted-foreground placeholder:font-normal pl-8 pr-7 text-foreground"
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
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-2 md:before:hidden"
                    aria-label="Clear search"
                  >
                    <X className="size-3 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                  Clear search
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <span className="shrink-0 font-semibold text-15 tracking-tight text-foreground">
                Messages
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                {/* Search toggle button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={expandSearch}
                      className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                      aria-label="Search conversations"
                    >
                      <Search className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                    Search conversations
                  </TooltipContent>
                </Tooltip>

                {/* Friends & Requests */}
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted relative cursor-pointer"
                      aria-label={
                        pendingFriendRequests > 0
                          ? `Friends & Requests (${pendingFriendRequests} pending)`
                          : 'Friends & Requests'
                      }
                      onClick={openFriendManagerModal}
                    >
                      <Users className="size-4 text-foreground" />
                      {pendingFriendRequests > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-11 font-semibold leading-none ring-2 ring-background shadow-2xs pointer-events-none tabular-nums">
                          {pendingFriendRequests > 99 ? '99+' : pendingFriendRequests}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {pendingFriendRequests > 0
                      ? `Friends & Requests (${pendingFriendRequests} pending)`
                      : 'Friends & Requests'}
                  </TooltipContent>
                </Tooltip>

                {/* Create Group or Add Friend */}
                <DropdownMenu>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          aria-label="Create Group or Add Friend"
                        >
                          <Plus className="size-4 text-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Create Group or Add Friend</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={openCreateGroupModal} className="cursor-pointer">
                      <Users className="size-3.5 mr-2 text-foreground" />
                      <span>Create Group</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openFriendManagerModal} className="cursor-pointer">
                      <UserPlus className="size-3.5 mr-2 text-foreground" />
                      <span>Add Friend</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Collapse sidebar button */}
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer hidden md:flex"
                      aria-label="Collapse sidebar"
                      onClick={toggleSidebar}
                    >
                      <PanelLeft className="size-4 text-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Filter Tabs (Equally distributed flat underline tabs, no nested card background) */}
      <div className="px-2 shrink-0 grid grid-cols-4 border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={cn(
              'w-full py-2 text-center text-12 transition-colors cursor-pointer relative outline-none truncate',
              filterTab === tab.id
                ? 'text-primary font-medium border-b-2 border-primary -mb-[1px]'
                : 'text-muted-foreground hover:text-foreground font-normal border-b-2 border-transparent -mb-[1px]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversations Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 sidebar-scrollbar">
        {/* Project Channels Section (Discord Style) */}
        {filteredProjectGroups.length > 0 && (
          <div className="space-y-2">
            {filteredProjectGroups.map((pg) => (
              <div key={pg.projectId} className="space-y-0.5">
                {/* Project Header Row (No uppercase, natural Title Case) */}
                <div className="flex items-center justify-between px-2 py-1 text-11 font-medium text-muted-foreground group">
                  <div className="flex items-center gap-1.5 truncate">
                    <FolderGit2 className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{pg.projectName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-muted-foreground hover:text-foreground"
                    title={`Create channel in ${pg.projectName}`}
                    onClick={() => openCreateChannelModal(pg.projectId)}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>

                {/* Sub-channels */}
                <div className="space-y-0.5 pl-1">
                  {pg.channels.map((ch) => {
                    const isSelected = activeConversationId === ch.id;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => setActiveConversation(ch)}
                        className={cn(
                          'w-full h-8 px-2 rounded-md flex items-center justify-between text-13 leading-5 transition-colors group cursor-pointer text-left outline-none',
                          isSelected
                            ? 'bg-muted text-foreground font-medium'
                            : 'text-foreground hover:bg-muted font-normal',
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={cn(
                              'font-mono text-12 font-medium shrink-0',
                              isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          >
                            #
                          </span>
                          <span className="truncate text-13">{ch.name}</span>
                        </div>
                        {ch.unreadCount > 0 && (
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded-full text-11 font-mono font-medium tabular-nums shrink-0',
                              isSelected
                                ? 'bg-background text-foreground border border-border shadow-2xs'
                                : 'bg-muted text-foreground border border-border',
                            )}
                          >
                            {ch.unreadCount > 99 ? '99+' : ch.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom Groups Section */}
        {filteredGroups.length > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1 text-11 font-medium text-muted-foreground">
              <span>
                Groups <span className="font-mono text-11 font-normal text-muted-foreground/70">({filteredGroups.length})</span>
              </span>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    onClick={openCreateGroupModal}
                    aria-label="Create new group"
                  >
                    <Plus className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Create new group</TooltipContent>
              </Tooltip>
            </div>
            {filteredGroups.map((g) => {
              const isSelected = activeConversationId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveConversation(g)}
                  className={cn(
                    'w-full p-2 rounded-md flex items-center gap-2.5 transition-colors text-left cursor-pointer outline-none',
                    isSelected
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground hover:bg-muted font-normal',
                  )}
                >
                  <Avatar className="size-7 rounded-md shrink-0">
                    <AvatarImage src={g.avatar || undefined} />
                    <AvatarFallback className="rounded-md text-11 font-medium bg-muted text-foreground">
                      {g.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-13 leading-5 truncate text-foreground">
                        {g.name}
                      </span>
                      {g.unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-11 font-mono font-medium tabular-nums bg-muted text-foreground border border-border shrink-0">
                          {g.unreadCount}
                        </span>
                      )}
                    </div>
                    {g.lastMessageSnippet && (
                      <p className="text-11 text-muted-foreground truncate">
                        {g.lastSenderName ? `${g.lastSenderName}: ` : ''}
                        {g.lastMessageSnippet}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Direct Messages Section */}
        {filteredDirects.length > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1 text-11 font-medium text-muted-foreground">
              <span>
                Direct Messages <span className="font-mono text-11 font-normal text-muted-foreground/70">({filteredDirects.length})</span>
              </span>
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                    onClick={openFriendManagerModal}
                    aria-label="Find friends"
                  >
                    <Plus className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Find friends</TooltipContent>
              </Tooltip>
            </div>
            {filteredDirects.map((d) => {
              const isSelected = activeConversationId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveConversation(d)}
                  className={cn(
                    'w-full p-2 rounded-md flex items-center gap-2.5 transition-colors text-left cursor-pointer outline-none',
                    isSelected
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground hover:bg-muted font-normal',
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="size-7 rounded-full">
                      <AvatarImage src={d.avatar || d.otherUser?.avatar || undefined} />
                      <AvatarFallback className="text-11 font-medium bg-muted text-foreground">
                        {d.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-13 leading-5 truncate text-foreground">
                        {d.name}
                      </span>
                      {d.unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-11 font-mono font-medium tabular-nums bg-muted text-foreground border border-border shrink-0">
                          {d.unreadCount}
                        </span>
                      )}
                    </div>
                    {d.lastMessageSnippet && (
                      <p className="text-11 text-muted-foreground truncate">
                        {d.lastMessageSnippet}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading &&
          filteredProjectGroups.length === 0 &&
          filteredGroups.length === 0 &&
          filteredDirects.length === 0 && (
            <div className="py-6 px-3">
              <PlaneEmptyState
                variant={searchQuery ? 'search' : 'chat'}
                isCompact
                title={searchQuery ? 'No matches found' : 'No conversations'}
                description={
                  searchQuery
                    ? 'No channels, direct messages, or groups match your query.'
                    : 'Start by adding friends or creating a group.'
                }
              />
            </div>
          )}
      </div>

      {/* Drag Handle for Resizing (synchronized with LibrarySidebar) */}
      <SidebarResizer
        width={sidebarWidth}
        setWidth={setSidebarWidth}
        isDragging={isDragging}
        onMouseDown={handleMouseDown}
      />
    </aside>
  );
}
