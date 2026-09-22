'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  MessageSquare,
  Plus,
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
    } catch (err) {
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
    <div className='flex flex-col h-full bg-background select-none'>
      {/* Search & Actions Header */}
      <div className='p-3 border-b border-border space-y-2 shrink-0'>
        <div className='flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search threads...'
              className='w-full h-8 pl-8 pr-3 text-12 rounded-md border border-border bg-muted/50 focus:bg-background outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all'
            />
          </div>
          <button
            type='button'
            onClick={onNewChat}
            className='flex items-center gap-1 h-8 px-2.5 text-12 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 shadow-2xs'
            title='New Chat'
          >
            <Plus className='size-3.5' />
            <span>New</span>
          </button>
        </div>

        {/* Scope Filter Tabs */}
        {currentProjectId && (
          <div className='flex items-center gap-1 p-0.5 rounded-md bg-muted text-11 font-medium text-muted-foreground'>
            <button
              type='button'
              onClick={() => setScopeFilter('project')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors',
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
                'flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors',
                scopeFilter === 'all'
                  ? 'bg-background text-foreground shadow-2xs font-medium'
                  : 'hover:text-foreground'
              )}
            >
              <Globe className='size-3' />
              <span>All Projects</span>
            </button>
          </div>
        )}
      </div>

      {/* Threads List */}
      <div className='flex-1 overflow-y-auto min-h-0 p-2 space-y-1'>
        {loading ? (
          <div className='flex items-center justify-center h-32 text-muted-foreground'>
            <Loader2 className='size-4 animate-spin mr-2' />
            <span className='text-12'>Loading history...</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-48 text-center px-4'>
            <MessageSquare className='size-8 text-muted-foreground/40 mb-2' />
            <p className='text-12 font-medium text-foreground'>No chat sessions found</p>
            <p className='text-11 text-muted-foreground mt-0.5'>
              Start a new conversation to ask questions or analyze papers.
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
                  'group flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-12 transition-all cursor-pointer border border-transparent',
                  isActive
                    ? 'bg-accent/70 border-border text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )}
              >
                <div className='flex items-center gap-2 min-w-0 flex-1'>
                  <MessageSquare className='size-3.5 shrink-0 opacity-70' />
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
                      className='h-6 flex-1 px-1.5 text-11 rounded border border-primary bg-background text-foreground outline-none'
                      autoFocus
                    />
                  ) : (
                    <span className='truncate text-12'>{chat.title || 'Untitled Chat'}</span>
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
    </div>
  );
}
