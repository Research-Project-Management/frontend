'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  MoreVertical,
  PanelLeft,
  Pencil,
  Search,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useActiveAiSpace } from '../../context/space';
import { threadPool } from '../../engine/pool';
import {
  useAiSessions,
  useDeleteAiSession,
  useRenameAiSession,
} from '../../engine/queries';
import { useAiUIStore } from '../../engine/shell';
import type { ChatSession } from '../../types/session';

export function ChatSidebar() {
  const { chatId } = useParams<{ chatId?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const activeChatId = chatId ?? null;

  const { spaceId: activeSpaceId } = useActiveAiSpace();
  const { data: chats = [], isLoading: loading } = useAiSessions(activeSpaceId);
  const renameMutation = useRenameAiSession(activeSpaceId);
  const deleteMutation = useDeleteAiSession(activeSpaceId);

  const toggleSidebar = useAiUIStore((s) => s.toggleSidebar);
  const searchQuery = useAiUIStore((s) => s.searchQuery);
  const setSearchQuery = useAiUIStore((s) => s.setSearchQuery);
  const isSearchVisible = useAiUIStore((s) => s.isSearchVisible);
  const setSearchVisible = useAiUIStore((s) => s.setSearchVisible);

  const [isRecentsCollapsed, setIsRecentsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (isSearchVisible && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchVisible]);

  const handleNewChat = () => {
    threadPool.get('draft:workspace')?.reset();
    if (pathname === '/ai') return;
    router.push('/ai');
  };

  const handleStartRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = async (chatIdToRename: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await renameMutation.mutateAsync({ chatId: chatIdToRename, title: trimmed });
      toast.success('Chat renamed');
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, targetChatId: string) => {
    e.stopPropagation();
    await deleteMutation.mutateAsync(targetChatId);
    threadPool.delete(targetChatId);
    toast.success('Chat deleted');
    if (activeChatId === targetChatId) {
      router.push('/ai');
    }
  };

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)),
    );
  }, [chats, searchQuery]);

  return (
    <aside className="w-60 shrink-0 h-full border-r border-border bg-background flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="h-11 px-3.5 flex items-center justify-between">
        <span className="text-13 font-semibold tracking-tight text-foreground">
          AI Assistant
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleSidebar}
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="size-4 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Collapse sidebar
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Action Row: New Chat + Search */}
      <div className="px-3 py-1.5 flex items-center gap-2">
        {!isSearchVisible ? (
          <>
            <button
              type="button"
              onClick={handleNewChat}
              className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground text-13 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <SquarePen className="size-4 text-foreground/85 shrink-0" />
              <span>New chat</span>
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSearchVisible(true)}
                  className="size-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
                  aria-label="Search conversations"
                >
                  <Search className="size-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Search
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="size-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
                  aria-label="New chat"
                >
                  <SquarePen className="size-4 text-foreground/85 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                New chat
              </TooltipContent>
            </Tooltip>

            <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background transition-colors">
              <Search className="size-4 text-muted-foreground shrink-0 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setSearchVisible(false);
                  }
                }}
                placeholder="Search"
                className="w-full bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchVisible(false);
                }}
                className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors"
                aria-label="Close search"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Recents Section */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 pt-2">
        <button
          type="button"
          onClick={() => setIsRecentsCollapsed((prev) => !prev)}
          className="flex items-center justify-between w-full py-1 px-1 text-11 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
        >
          <span>Recents</span>
          <ChevronDown
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-150',
              isRecentsCollapsed && '-rotate-90',
            )}
          />
        </button>

        {!isRecentsCollapsed && (
          <div className="flex-1 overflow-y-auto space-y-0.5 mt-1.5 pb-3">
            {loading ? (
              <div className="space-y-1 py-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-full rounded-md bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="py-6 px-2 text-center text-xs text-muted-foreground">
                {searchQuery ? 'No matching chats' : 'No recent chats'}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isActive = activeChatId === chat.id;
                const isEditing = editingId === chat.id;

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      if (!isEditing) router.push(`/ai/${chat.id}`);
                    }}
                    className={cn(
                      'group relative flex h-8 items-center justify-between gap-2 px-2.5 rounded-md text-13 leading-5 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal',
                    )}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveRename(chat.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => void handleSaveRename(chat.id)}
                          className="w-full bg-background px-1.5 py-0.5 text-xs rounded border border-primary focus:outline-none text-foreground"
                        />
                      ) : (
                        <span className="truncate tracking-tight" title={chat.title}>
                          {chat.title || 'New Chat'}
                        </span>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100 transition-opacity duration-150 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="size-6 rounded-md hover:bg-background/80 hover:text-foreground text-muted-foreground flex items-center justify-center cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                              title="More actions"
                              aria-label="More actions"
                            >
                              <MoreVertical className="size-3.5 shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 p-1">
                            <DropdownMenuItem
                              onClick={(e) => handleStartRename(e, chat)}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-sm cursor-pointer"
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => void handleDelete(e, chat.id)}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-sm text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export default ChatSidebar;
