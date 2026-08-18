'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Button,
} from '@/shared/components/ui';
import {
  Search,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import {
  listChatSessions,
  renameChatSession,
  deleteChatSession,
} from '@/features/editor/services/ai.service';
import type { ChatSession } from '@/features/editor/types/editor-ai.types';

function timeGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Previous 7 days';
  if (diffDays < 30) return 'Previous 30 days';
  return 'Older';
}

function groupChats(chats: ChatSession[]): Record<string, ChatSession[]> {
  const groups: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    'Previous 30 days': [],
    Older: [],
  };
  for (const chat of chats) {
    const group = timeGroup(chat.updatedAt || chat.createdAt || new Date().toISOString());
    if (!groups[group]) groups[group] = [];
    groups[group].push(chat);
  }
  return groups;
}

export interface ChatHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string | null;
  pageId?: string | null;
  activeChatId?: string | null;
  onSelectChat?: (chat: ChatSession) => void;
  title?: string;
  description?: string;
  enableGlobalSearch?: boolean;
}

export function ChatHistory({
  open,
  onOpenChange,
  workspaceId,
  pageId,
  activeChatId,
  onSelectChat,
  title = 'Chat History',
  description = 'View and manage previous conversations with Assistant',
  enableGlobalSearch = true,
}: ChatHistoryProps) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchChats = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const data = await listChatSessions(workspaceId);
      setChats(data);
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) {
      fetchChats();
      setSearch('');
      setEditingId(null);
    }
  }, [open, fetchChats]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleSelect = (chat: ChatSession) => {
    if (onSelectChat) {
      onSelectChat(chat);
      onOpenChange(false);
    }
  };

  const handleStartRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    try {
      await renameChatSession(chatId, editTitle.trim());
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: editTitle.trim() } : c))
      );
    } catch (err) {
      console.error('Failed to rename chat:', err);
    } finally {
      setEditingId(null);
    }
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;
    try {
      await deleteChatSession(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, search]);

  const grouped = useMemo(() => groupChats(filtered), [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] p-0 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 pb-3 border-b border-border/40">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-xs text-muted-foreground">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 h-9 text-sm bg-muted/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs">Loading conversations...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <MessageSquare className="size-8 stroke-[1.5] opacity-40" />
              <span className="text-sm">No conversations found</span>
            </div>
          ) : (
            Object.entries(grouped).map(([group, groupChatsList]) => {
              if (groupChatsList.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground/70 px-2 py-1 select-none">
                    {group}
                  </h4>
                  <div className="space-y-0.5">
                    {groupChatsList.map((chat) => {
                      const isActive = chat.id === activeChatId;
                      const isEditing = chat.id === editingId;

                      return (
                        <div
                          key={chat.id}
                          onClick={() => !isEditing && handleSelect(chat)}
                          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-sm ${
                            isActive
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                            <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                            {isEditing ? (
                              <div
                                className="flex items-center gap-1 flex-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Input
                                  ref={inputRef}
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(e as any, chat.id);
                                    if (e.key === 'Escape') handleCancelRename(e as any);
                                  }}
                                  className="h-7 text-xs py-1"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  onClick={(e) => handleSaveRename(e, chat.id)}
                                >
                                  <Check className="size-3.5 text-emerald-500" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  onClick={handleCancelRename}
                                >
                                  <X className="size-3.5 text-rose-500" />
                                </Button>
                              </div>
                            ) : (
                              <span className="truncate flex-1">{chat.title}</span>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                onClick={(e) => handleStartRename(e, chat)}
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => handleDelete(e, chat.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated alias for backward compatibility */
export const ChatHistoryModal = ChatHistory;
export default ChatHistory;
