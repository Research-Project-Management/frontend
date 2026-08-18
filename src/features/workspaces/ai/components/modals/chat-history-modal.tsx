'use client';

import {
  MessageSquare,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  deleteChatSession,
  listChatSessions,
  renameChatSession,
} from '../../services/chat.service';
import type { ChatSession } from '../../types/chat.types';

type TimeGroup = 'today' | 'week' | 'month' | 'older';

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  older: 'Older',
};

function timeGroup(updatedAt: string): TimeGroup {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const hours = diff / 3_600_000;
  if (hours < 24) return 'today';
  if (hours < 24 * 7) return 'week';
  if (hours < 24 * 30) return 'month';
  return 'older';
}

function groupChats(chats: ChatSession[]) {
  const groups: Record<TimeGroup, ChatSession[]> = {
    today: [],
    week: [],
    month: [],
    older: [],
  };
  for (const chat of chats) groups[timeGroup(chat.updatedAt)].push(chat);
  return groups;
}

export interface ChatHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string | null;
  activeChatId?: string | null;
  onSelectChat?: (chat: ChatSession) => void;
  title?: string;
  description?: string;
}

export function ChatHistoryModal({
  open,
  onOpenChange,
  workspaceId,
  activeChatId,
  onSelectChat,
  title = 'Chat History',
  description = 'Search and resume previous AI research conversations.',
}: ChatHistoryModalProps) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const fetchChats = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const data = await listChatSessions(workspaceId);
      setChats(data);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [open, workspaceId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleSelect = (chat: ChatSession) => {
    if (onSelectChat) {
      onSelectChat(chat);
    } else if (workspaceId) {
      router.push(`/${workspaceId}/ai/${chat.id}`);
    }
    onOpenChange(false);
  };

  const handleStartRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await renameChatSession(id, trimmed);
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
      );
    } catch {
      // rollback
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteChatSession(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeChatId === id && workspaceId) {
        router.push(`/${workspaceId}/ai`);
      }
    } catch {
      // ignore
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q),
    );
  }, [chats, search]);

  const grouped = useMemo(() => groupChats(filtered), [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
          <div className="relative mt-2">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chat topics or messages..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-secondary/30 text-xs focus:outline-none focus:border-primary"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Loading chat sessions...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {search ? 'No chats found matching query.' : 'No conversations recorded.'}
            </div>
          ) : (
            (Object.keys(grouped) as TimeGroup[]).map((groupKey) => {
              const items = grouped[groupKey];
              if (items.length === 0) return null;

              return (
                <div key={groupKey} className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                    {GROUP_LABELS[groupKey]}
                  </div>
                  <div className="space-y-1">
                    {items.map((chat) => {
                      const isActive = activeChatId === chat.id;
                      const isEditing = editingId === chat.id;

                      return (
                        <div
                          key={chat.id}
                          onClick={() => handleSelect(chat)}
                          className={cn(
                            'group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-xs cursor-pointer transition-colors',
                            isActive
                              ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                              : 'border-transparent hover:border-border hover:bg-secondary/40 text-foreground/90',
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
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
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-background px-1.5 py-0.5 rounded border border-primary text-xs focus:outline-none"
                              />
                            ) : (
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-foreground">
                                  {chat.title || 'Untitled Session'}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground/80 mt-0.5">
                                  {chat.lastMessage || 'No messages'}
                                </p>
                              </div>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => handleStartRename(e, chat)}
                                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                                title="Rename"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, chat.id)}
                                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
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

export default ChatHistoryModal;
