'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import type { ChatSession } from '../../types/session';

export interface SessionHistoryListProps {
  chats: readonly ChatSession[];
  activeChatId: string | null;
  loading: boolean;
  searchQuery: string;
  onSelect: (chatId: string) => void;
  onRename: (chatId: string, title: string) => Promise<void>;
  onDelete: (chatId: string) => Promise<void>;
}

export function SessionHistoryList({
  chats,
  activeChatId,
  loading,
  searchQuery,
  onSelect,
  onRename,
  onDelete,
}: SessionHistoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (chat: ChatSession) => {
    setEditingId(chat.id);
    setEditTitle(chat.title || '');
  };

  const handleSaveRename = async (chatId: string) => {
    if (savingRef.current || editingId !== chatId) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    savingRef.current = true;
    setEditingId(null);
    try {
      await onRename(chatId, trimmed);
    } catch {
      toast.error('Failed to rename chat');
    } finally {
      savingRef.current = false;
    }
  };

  const handleDelete = async (chatId: string) => {
    try {
      await onDelete(chatId);
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading conversations"
        className="space-y-1 py-1"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-full rounded-md bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="py-6 px-2 text-center text-12 text-muted-foreground">
        {searchQuery.trim() ? 'No matching chats' : 'No recent chats'}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {chats.map((chat) => {
        const isActive = activeChatId === chat.id;
        const isEditing = editingId === chat.id;
        const displayTitle = chat.title || 'Untitled chat';

        return (
          <div
            key={chat.id}
            className={cn(
              'group relative flex h-8 items-center gap-1 rounded-md px-1 text-13',
              isActive
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal',
            )}
          >
            {isEditing ? (
              <>
                <input
                  ref={editInputRef}
                  type="text"
                  aria-label="Rename conversation"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSaveRename(chat.id);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingId(null);
                    }
                  }}
                  onBlur={() => void handleSaveRename(chat.id)}
                  className="h-6 flex-1 min-w-0 bg-background px-1.5 text-12 rounded border border-ai focus:outline-none focus-visible:ring-1 focus-visible:ring-ai text-foreground"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleSaveRename(chat.id)}
                  className="size-6 relative before:absolute before:-inset-2 md:before:hidden flex items-center justify-center rounded hover:bg-background/80 text-foreground cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai shrink-0"
                  aria-label="Save rename"
                  title="Save rename"
                >
                  <Check className="size-3.5 text-success" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setEditingId(null)}
                  className="size-6 relative before:absolute before:-inset-2 md:before:hidden flex items-center justify-center rounded hover:bg-background/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai shrink-0"
                  aria-label="Cancel rename"
                  title="Cancel"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(chat.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={displayTitle}
                  className="flex-1 min-w-0 h-full pl-1.5 pr-7 md:pr-1.5 md:group-hover:pr-7 md:group-focus-within:pr-7 md:group-has-[[data-state=open]]:pr-7 text-left truncate rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ai cursor-pointer"
                >
                  {displayTitle}
                </button>

                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center shrink-0 opacity-100 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto has-[[data-state=open]]:opacity-100 has-[[data-state=open]]:pointer-events-auto transition-opacity motion-reduce:transition-none">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="size-6 relative before:absolute before:-inset-2 md:before:hidden rounded-md hover:bg-background/80 hover:text-foreground text-muted-foreground flex items-center justify-center cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai"
                        title={`More actions for ${displayTitle}`}
                        aria-label={`More actions for ${displayTitle}`}
                      >
                        <MoreVertical className="size-3.5 shrink-0" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 p-1">
                      <DropdownMenuItem
                        onClick={() => handleStartRename(chat)}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-12 rounded-sm cursor-pointer"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleDelete(chat.id)}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-12 rounded-sm text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
