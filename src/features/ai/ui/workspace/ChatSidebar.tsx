'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, PanelLeft, Search, SquarePen, X } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { SessionHistoryList } from '../shared/SessionHistoryList';

export function ChatSidebar() {
  const { chatId } = useParams<{ chatId?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const activeChatId = chatId ?? null;
  const recentsId = useId();

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleOpenSearch = () => {
    setSearchVisible(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const handleNewChat = () => {
    threadPool.get('draft:workspace')?.reset();
    if (pathname !== '/ai') {
      router.push('/ai');
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  const handleSelectChat = (targetChatId: string) => {
    router.push(`/ai/${targetChatId}`);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  const handleRenameChat = async (targetChatId: string, title: string) => {
    await renameMutation.mutateAsync({ chatId: targetChatId, title });
    toast.success('Chat renamed');
  };

  const handleDeleteChat = async (targetChatId: string) => {
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
    <aside
      aria-label="AI conversations"
      className="fixed inset-y-0 left-0 z-50 md:relative md:inset-auto md:z-auto w-60 max-w-[85vw] shrink-0 h-full border-r border-border bg-background shadow-lg md:shadow-none flex flex-col overflow-hidden select-none"
    >
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
              className="size-8 relative before:absolute before:-inset-1.5 md:before:hidden flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-12">
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
              className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground text-13 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
            >
              <SquarePen className="size-4 text-foreground/85 shrink-0" aria-hidden="true" />
              <span>New chat</span>
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleOpenSearch}
                  className="size-8 relative before:absolute before:-inset-1.5 md:before:hidden flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai shrink-0"
                  aria-label="Search conversations"
                >
                  <Search className="size-4 shrink-0" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-12">
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
                  className="size-8 relative before:absolute before:-inset-1.5 md:before:hidden flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai shrink-0"
                  aria-label="New chat"
                >
                  <SquarePen className="size-4 text-foreground/85 shrink-0" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-12">
                New chat
              </TooltipContent>
            </Tooltip>

            <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background focus-within:border-ai focus-within:ring-1 focus-within:ring-ai/30 transition-colors">
              <Search
                className="size-4 text-muted-foreground shrink-0 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Search conversations"
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
                className="size-4 relative before:absolute before:-inset-2.5 md:before:hidden flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
                aria-label="Close search"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Recents Section */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 pt-2">
        <button
          type="button"
          aria-expanded={!isRecentsCollapsed}
          aria-controls={!isRecentsCollapsed ? recentsId : undefined}
          onClick={() => setIsRecentsCollapsed((prev) => !prev)}
          className="flex items-center justify-between w-full py-1 px-1 rounded-sm text-11 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ai"
        >
          <span>Recents</span>
          <ChevronDown
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
              isRecentsCollapsed && '-rotate-90',
            )}
            aria-hidden="true"
          />
        </button>

        {!isRecentsCollapsed && (
          <div id={recentsId} className="flex-1 overflow-y-auto mt-1.5 pb-3">
            <SessionHistoryList
              chats={filteredChats}
              activeChatId={activeChatId}
              loading={loading}
              searchQuery={searchQuery}
              onSelect={handleSelectChat}
              onRename={handleRenameChat}
              onDelete={handleDeleteChat}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

export default ChatSidebar;
