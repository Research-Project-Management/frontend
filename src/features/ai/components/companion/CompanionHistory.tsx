'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  SquarePen,
  ChevronRight,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  FolderKanban,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import type { ChatSession } from '../../types/chat.types';
import {
  listChatSessions,
  deleteChatSession,
  renameChatSession,
} from '../../services/chat.service';
import { useAiCompanionStore } from '../../store/ai-companion.store';

interface CompanionHistoryProps {
  currentProjectId?: string;
  onNewChat: () => void;
}

export function CompanionHistory({
  currentProjectId,
  onNewChat,
}: CompanionHistoryProps) {
  const { activeChatId, setActiveChatId, setHistoryView } =
    useAiCompanionStore();

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRecentsOpen, setIsRecentsOpen] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<'project' | 'all'>(
    currentProjectId ? 'project' : 'all'
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listChatSessions(
        scopeFilter === 'project' && currentProjectId
          ? currentProjectId
          : undefined
      );
      setChats(list || []);
    } catch (e) {
      console.error('[CompanionHistory] Failed to load chats:', e);
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, scopeFilter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => (c.title || '').toLowerCase().includes(q));
  }, [chats, search]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteChatSession(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
      }
      toast.success('Chat deleted');
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  const handleStartRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title || '');
  };

  const handleSaveRename = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await renameChatSession(id, editTitle.trim());
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editTitle.trim() } : c))
      );
      setEditingId(null);
      toast.success('Chat renamed');
    } catch {
      toast.error('Failed to rename chat');
    }
  };

  return (
    <div className='flex flex-col h-full bg-background select-none overflow-hidden'>
      {/* ── Action Buttons Row: [ New chat ] [ Search ] ───────────────── */}
      <div className='p-3 pb-2 flex items-center gap-2 shrink-0'>
        {isSearchOpen ? (
          <>
            <button
              type='button'
              onClick={onNewChat}
              className='size-9 shrink-0 rounded-md border border-border/80 bg-background hover:bg-muted/50 text-foreground flex items-center justify-center cursor-pointer transition-colors shadow-2xs outline-none focus-visible:ring-1 focus-visible:ring-primary'
              aria-label='New chat'
              title='New chat'
            >
              <SquarePen className='size-4 text-foreground/80' />
            </button>

            <div className='flex-1 relative flex items-center h-9 rounded-md border border-border bg-background focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 px-2.5 transition-all shadow-2xs'>
              <Search className='size-4 text-foreground/70 shrink-0 mr-2' />
              <input
                type='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search'
                className='flex-1 bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none font-normal'
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsSearchOpen(false);
                    setSearch('');
                  }
                }}
              />
              <button
                type='button'
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearch('');
                }}
                className='size-5 flex items-center justify-center text-foreground/70 hover:text-foreground cursor-pointer rounded transition-colors ml-1'
                aria-label='Close search'
              >
                <X className='size-3.5' />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type='button'
              onClick={onNewChat}
              className='flex-1 h-9 px-3 rounded-md border border-border/80 bg-background hover:bg-muted/50 text-foreground text-13 font-normal flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs outline-none focus-visible:ring-1 focus-visible:ring-primary'
              aria-label='New chat'
            >
              <SquarePen className='size-4 text-foreground/80' />
              <span>New chat</span>
            </button>

            <button
              type='button'
              onClick={() => setIsSearchOpen(true)}
              className='size-9 shrink-0 rounded-md border border-border/80 bg-background hover:bg-muted/50 text-foreground/80 flex items-center justify-center cursor-pointer transition-colors shadow-2xs outline-none focus-visible:ring-1 focus-visible:ring-primary'
              title='Search chats'
              aria-label='Search chats'
            >
              <Search className='size-4' />
            </button>
          </>
        )}
      </div>

      {/* ── Scope Filter Tabs (if in project) ─────────────────────────── */}
      {currentProjectId && (
        <div className='px-3 pb-2 shrink-0'>
          <div className='flex items-center gap-1 p-0.5 rounded-md bg-muted text-11 font-medium text-muted-foreground'>
            <button
              type='button'
              onClick={() => setScopeFilter('project')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors cursor-pointer',
                scopeFilter === 'project'
                  ? 'bg-background text-foreground shadow-2xs font-medium'
                  : 'hover:text-foreground'
              )}
            >
              <FolderKanban className='size-3' />
              <span>Current Project</span>
            </button>
            <button
              type='button'
              onClick={() => setScopeFilter('all')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors cursor-pointer',
                scopeFilter === 'all'
                  ? 'bg-background text-foreground shadow-2xs font-medium'
                  : 'hover:text-foreground'
              )}
            >
              <Globe className='size-3' />
              <span>All Projects</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Recents Collapsible Section ──────────────────────────────── */}
      <div className='flex-1 overflow-y-auto min-h-0 px-2 py-1 select-none'>
        {/* Recents Header */}
        <button
          type='button'
          onClick={() => setIsRecentsOpen((v) => !v)}
          className='w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-muted/40 transition-colors text-left cursor-pointer group'
        >
          <span className='text-13 font-semibold text-foreground/90 tracking-tight'>
            Recents
          </span>
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              isRecentsOpen && 'rotate-90'
            )}
          />
        </button>

        {/* Recents Content */}
        {isRecentsOpen && (
          <div className='mt-1 space-y-0.5'>
            {loading ? (
              <div className='flex items-center justify-center py-8 text-muted-foreground'>
                <Loader2 className='size-4 animate-spin mr-2' />
                <span className='text-12'>Loading history...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-8 text-center px-4'>
                <p className='text-12 font-normal text-muted-foreground'>
                  {search ? 'No matching chats' : 'No recent chats'}
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isActive = chat.id === activeChatId;
                const isEditing = editingId === chat.id;

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      if (isEditing) return;
                      setActiveChatId(chat.id);
                      setHistoryView(false);
                    }}
                    className={cn(
                      'group flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-13 transition-colors cursor-pointer',
                      isActive
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <div className='flex items-center gap-2 min-w-0 flex-1'>
                      {isEditing ? (
                        <input
                          type='text'
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(e as any, chat.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className='h-6 flex-1 px-1.5 text-12 rounded border border-primary bg-background text-foreground outline-none'
                          autoFocus
                        />
                      ) : (
                        <span className='truncate text-13'>{chat.title || 'Untitled chat'}</span>
                      )}
                    </div>

                    <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity shrink-0'>
                      {isEditing ? (
                        <>
                          <button
                            type='button'
                            onClick={(e) => handleSaveRename(e, chat.id)}
                            className='size-6 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary'
                            title='Save rename'
                            aria-label='Save new title'
                          >
                            <Check className='size-3.5 text-success' />
                          </button>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                            }}
                            className='size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary'
                            title='Cancel'
                            aria-label='Cancel rename'
                          >
                            <X className='size-3.5' />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type='button'
                            onClick={(e) => handleStartRename(e, chat)}
                            className='size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary'
                            title='Rename conversation'
                            aria-label={`Rename ${chat.title || 'conversation'}`}
                          >
                            <Pencil className='size-3.5' />
                          </button>
                          <button
                            type='button'
                            onClick={(e) => handleDelete(e, chat.id)}
                            className='size-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary'
                            title='Delete conversation'
                            aria-label={`Delete ${chat.title || 'conversation'}`}
                          >
                            <Trash2 className='size-3.5' />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
