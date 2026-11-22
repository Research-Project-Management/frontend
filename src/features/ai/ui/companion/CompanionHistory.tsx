'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, FolderKanban, Globe, Search, SquarePen, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { threadPool } from '../../engine/pool';
import {
  useAiSessions,
  useDeleteAiSession,
  useRenameAiSession,
} from '../../engine/queries';
import { useAiCompanionStore } from '../../engine/shell';
import { SessionHistoryList } from '../shared/SessionHistoryList';

export interface CompanionHistoryProps {
  currentSpaceId?: string | null;
  onNewChat: () => void;
}

export function CompanionHistory({
  currentSpaceId,
  onNewChat,
}: CompanionHistoryProps) {
  const activeChatId = useAiCompanionStore((s) => s.activeChatId);
  const setActiveChatId = useAiCompanionStore((s) => s.setActiveChatId);
  const setHistoryView = useAiCompanionStore((s) => s.setHistoryView);
  const recentsId = useId();

  const [scopeFilter, setScopeFilter] = useState<'project' | 'all'>(
    currentSpaceId ? 'project' : 'all',
  );
  const querySpaceId =
    scopeFilter === 'project' && currentSpaceId ? currentSpaceId : null;

  const { data: chats = [], isLoading: loading } = useAiSessions(querySpaceId);
  const renameMutation = useRenameAiSession(querySpaceId);
  const deleteMutation = useDeleteAiSession(querySpaceId);

  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRecentsOpen, setIsRecentsOpen] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)),
    );
  }, [chats, search]);

  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setHistoryView(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    threadPool.delete(id);
    if (activeChatId === id) {
      setActiveChatId(null);
    }
    toast.success('Chat deleted');
  };

  const handleRename = async (id: string, title: string) => {
    await renameMutation.mutateAsync({ chatId: id, title });
    toast.success('Chat renamed');
  };

  return (
    <div className="flex flex-col h-full bg-background select-none overflow-hidden">
      {/* Action Buttons Row */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2 shrink-0">
        {isSearchOpen ? (
          <>
            <button
              type="button"
              onClick={onNewChat}
              className="size-8 relative before:absolute before:-inset-1.5 md:before:hidden flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai shrink-0"
              aria-label="New chat"
              title="New chat"
            >
              <SquarePen className="size-4 text-foreground/85 shrink-0" aria-hidden="true" />
            </button>

            <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background focus-within:border-ai focus-within:ring-1 focus-within:ring-ai/30 transition-colors">
              <Search
                className="size-4 text-muted-foreground shrink-0 pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Search chats"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                    setSearch('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearch('');
                }}
                className="size-4 relative before:absolute before:-inset-2.5 md:before:hidden flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
                aria-label="Close search"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onNewChat}
              className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground text-13 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
              aria-label="New chat"
            >
              <SquarePen className="size-4 text-foreground/85 shrink-0" aria-hidden="true" />
              <span>New chat</span>
            </button>

            <button
              type="button"
              onClick={handleOpenSearch}
              className="size-8 relative before:absolute before:-inset-1.5 md:before:hidden flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai shrink-0"
              title="Search chats"
              aria-label="Search chats"
            >
              <Search className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Scope Filter Tabs */}
      {currentSpaceId && (
        <div className="px-3 pb-2 shrink-0">
          <div
            role="tablist"
            aria-label="Conversation scope"
            className="flex items-center gap-1 p-0.5 rounded-md bg-muted text-11 font-medium text-muted-foreground"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scopeFilter === 'project'}
              onClick={() => setScopeFilter('project')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai',
                scopeFilter === 'project'
                  ? 'bg-background text-foreground font-medium'
                  : 'hover:text-foreground',
              )}
            >
              <FolderKanban className="size-3" aria-hidden="true" />
              <span>Current Project</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scopeFilter === 'all'}
              onClick={() => setScopeFilter('all')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai',
                scopeFilter === 'all'
                  ? 'bg-background text-foreground font-medium'
                  : 'hover:text-foreground',
              )}
            >
              <Globe className="size-3" aria-hidden="true" />
              <span>All Projects</span>
            </button>
          </div>
        </div>
      )}

      {/* Recents Collapsible List */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 pt-2 select-none">
        <button
          type="button"
          aria-expanded={isRecentsOpen}
          aria-controls={isRecentsOpen ? recentsId : undefined}
          onClick={() => setIsRecentsOpen((v) => !v)}
          className="flex items-center justify-between w-full py-1 px-1 rounded-sm text-11 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ai"
        >
          <span>Recents</span>
          <ChevronDown
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
              !isRecentsOpen && '-rotate-90',
            )}
            aria-hidden="true"
          />
        </button>

        {isRecentsOpen && (
          <div id={recentsId} className="flex-1 overflow-y-auto mt-1.5 pb-3">
            <SessionHistoryList
              chats={filteredChats}
              activeChatId={activeChatId}
              loading={loading}
              searchQuery={search}
              onSelect={handleSelectChat}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}
