'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { ChevronRight, FolderKanban, Globe, Search, SquarePen, X } from 'lucide-react';
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
    return chats.filter((c) => (c.title || '').toLowerCase().includes(q));
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
      <div className="p-3 pb-2 flex items-center gap-1.5 shrink-0">
        {isSearchOpen ? (
          <>
            <button
              type="button"
              onClick={onNewChat}
              className="size-8 relative before:absolute before:-inset-1.5 md:before:hidden shrink-0 rounded-md border border-border/80 bg-background hover:bg-muted/50 text-foreground flex items-center justify-center cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
              aria-label="New chat"
              title="New chat"
            >
              <SquarePen className="size-3.5 text-foreground/80" aria-hidden="true" />
            </button>

            <div className="flex-1 relative flex items-center h-8 rounded-md border border-border bg-background focus-within:border-ai focus-within:ring-1 focus-within:ring-ai/30 px-2 transition-colors">
              <Search
                className="size-3.5 text-foreground/70 shrink-0 mr-1.5"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Search chats"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="flex-1 bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none font-normal"
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
                className="size-4 relative before:absolute before:-inset-2.5 md:before:hidden flex items-center justify-center text-foreground/70 hover:text-foreground cursor-pointer rounded transition-colors ml-1 outline-none focus-visible:ring-1 focus-visible:ring-ai"
                aria-label="Close search"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onNewChat}
              className="flex-1 h-8 px-2.5 relative before:absolute before:-inset-1.5 md:before:hidden rounded-md border border-border/80 bg-background hover:bg-muted/50 text-foreground text-12 font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
              aria-label="New chat"
            >
              <SquarePen className="size-3.5 text-foreground/80" aria-hidden="true" />
              <span>New chat</span>
            </button>

            <button
              type="button"
              onClick={handleOpenSearch}
              className="size-8 relative before:absolute before:-inset-1.5 md:before:hidden shrink-0 rounded-md border border-border/80 bg-background hover:bg-muted/50 text-foreground/80 flex items-center justify-center cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
              title="Search chats"
              aria-label="Search chats"
            >
              <Search className="size-3.5" aria-hidden="true" />
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
      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1 select-none">
        <button
          type="button"
          aria-expanded={isRecentsOpen}
          aria-controls={isRecentsOpen ? recentsId : undefined}
          onClick={() => setIsRecentsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-muted/40 transition-colors text-left cursor-pointer group outline-none focus-visible:ring-1 focus-visible:ring-ai"
        >
          <span className="text-13 font-semibold text-foreground/90 tracking-tight">
            Recents
          </span>
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
              isRecentsOpen && 'rotate-90',
            )}
            aria-hidden="true"
          />
        </button>

        {isRecentsOpen && (
          <div id={recentsId} className="mt-1">
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
