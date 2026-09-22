'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useId,
} from 'react';
import {
  PanelLeft,
  SquarePen,
  Search,
  ChevronDown,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { LayoutGroup } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { getErrorMessage } from '@/shared/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';
import { toast } from 'sonner';

import type { ChatSession } from '../../types/chat.types';
import {
  listChatSessions,
  deleteChatSession,
  renameChatSession,
} from '../../services/chat.service';
import { useAiUIStore } from '../../store';

export function Sidebar() {
  const { chatId } = useParams<{ chatId?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const activeChatId = chatId ?? null;
  const layoutGroupId = useId();

  const {
    toggleSidebar,
    searchQuery,
    setSearchQuery,
    isSearchVisible,
    toggleSearchVisible,
    setSearchVisible,
  } = useAiUIStore();

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecentsCollapsed, setIsRecentsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load chat sessions
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listChatSessions();
      setChats(list);
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

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

  // Rename session
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
      await renameChatSession(chatIdToRename, trimmed);
      setChats((prev) =>
        prev.map((c) => (c.id === chatIdToRename ? { ...c, title: trimmed } : c)),
      );
      toast.success('Chat renamed');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to rename chat');
    } finally {
      setEditingId(null);
    }
  };

  // Delete session
  const handleDelete = async (e: React.MouseEvent, targetChatId: string) => {
    e.stopPropagation();
    try {
      await deleteChatSession(targetChatId);
      setChats((prev) => prev.filter((c) => c.id !== targetChatId));
      toast.success('Chat deleted');
      if (activeChatId === targetChatId) {
        router.push('/ai');
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete chat');
    }
  };

  // Filtered chats
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
      {/* ── 1. Header: Brand (Flux AI, không icon, không border-b) ───────── */}
      <div className="h-11 px-3.5 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Flux AI
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
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

      {/* ── 2. Action Row: New Chat + Search ───────────────────────────────── */}
      <div className="px-3 py-1.5 flex items-center gap-2">
        {!isSearchVisible ? (
          <>
            {/* Expanded New Chat button */}
            <button
              type="button"
              onClick={() => {
                router.push('/ai');
              }}
              className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground text-13 font-medium transition-colors cursor-pointer outline-none shadow-2xs"
            >
              <SquarePen className="size-4 text-foreground/85 shrink-0" />
              <span>New chat</span>
            </button>

            {/* Square Search button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSearchVisible(true)}
                  className="size-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none shadow-2xs shrink-0"
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
            {/* Square New Chat button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    router.push('/ai');
                  }}
                  className="size-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground/80 hover:text-foreground transition-colors cursor-pointer outline-none shadow-2xs shrink-0"
                  aria-label="New chat"
                >
                  <SquarePen className="size-4 text-foreground/85 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                New chat
              </TooltipContent>
            </Tooltip>

            {/* Expanded Search input */}
            <div className="flex-1 flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-white dark:bg-card focus-within:border-foreground/30 transition-colors shadow-2xs">
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

      {/* ── Recents Section ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 pt-2">
        {/* Recents Header */}
        <button
          onClick={() => setIsRecentsCollapsed((prev) => !prev)}
          className="flex items-center justify-between w-full py-1 px-1 text-11 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
        >
          <span>Recents</span>
          <ChevronDown
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-200',
              isRecentsCollapsed && '-rotate-90',
            )}
          />
        </button>

        {/* Recents Chat List */}
        {!isRecentsCollapsed && (
          <div className="flex-1 overflow-y-auto space-y-0.5 mt-1.5 pb-3">
            {loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-11">Loading chats…</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="py-6 px-2 text-center text-xs text-muted-foreground">
                {searchQuery ? 'No matching chats' : 'No recent chats'}
              </div>
            ) : (
              <LayoutGroup id={layoutGroupId}>
                {filteredChats.map((chat) => {
                  const isActive = activeChatId === chat.id;
                  const isEditing = editingId === chat.id;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => router.push(`/ai/${chat.id}`)}
                      className={cn(
                        'group relative flex h-8 items-center justify-between gap-2 px-2.5 rounded-md text-13 leading-5 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isActive
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare
                          className={cn(
                            'size-3.5 shrink-0 transition-colors',
                            isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground group-hover:text-foreground',
                          )}
                        />
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(chat.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onBlur={() => handleSaveRename(chat.id)}
                            className="w-full bg-background px-1.5 py-0.5 text-xs rounded border border-primary focus:outline-none text-foreground"
                          />
                        ) : (
                          <span className="truncate tracking-tight" title={chat.title}>
                            {chat.title || 'Starting A Conversation With...'}
                          </span>
                        )}
                      </div>

                      {/* Actions on hover and keyboard focus */}
                      {!isEditing && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(e, chat)}
                            className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                            title="Rename"
                            aria-label={`Rename ${chat.title || 'conversation'}`}
                          >
                            <Pencil className="size-3.5 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, chat.id)}
                            className="size-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                            title="Delete"
                            aria-label={`Delete ${chat.title || 'conversation'}`}
                          >
                            <Trash2 className="size-3.5 shrink-0" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </LayoutGroup>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// Backward compatibility aliases
export const ChatSidebar = Sidebar;
export const FluxAiSidebar = Sidebar;
export default Sidebar;
