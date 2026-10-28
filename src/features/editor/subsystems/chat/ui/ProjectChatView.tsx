'use client';

/**
 * ProjectChatView.tsx
 *
 * Real-Time Manuscript Collaborator Chat View.
 * Connects directly to ManuscriptRealtimeGateway (`project:chat:send`, `project:chat:history`, `project:chat:message`)
 * via YjsSocketIOProvider.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import {
  acquireYjsProvider,
  releaseYjsProvider,
  type YjsSocketIOProvider,
  type ProjectChatMessage,
} from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { Button } from '@/shared/components/ui/button';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';

export interface ProjectChatViewProps {
  projectId?: string | null;
  pageId?: string | null;
  currentUserId?: string;
}

export function ProjectChatView({
  projectId,
  pageId,
  currentUserId,
}: ProjectChatViewProps) {
  const effectiveProjectId = projectId || pageId || '';
  const chatRoomId = effectiveProjectId ? `chat:${effectiveProjectId}` : '';

  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<YjsSocketIOProvider | null>(null);

  useEffect(() => {
    if (!effectiveProjectId || !chatRoomId) return;

    const { provider } = acquireYjsProvider(effectiveProjectId, chatRoomId);
    providerRef.current = provider;

    void provider.getChatHistory().then((history) => {
      if (Array.isArray(history) && history.length > 0) {
        setMessages(history);
      }
    });

    const unsub = provider.subscribeChatMessages((msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      unsub();
      providerRef.current = null;
      releaseYjsProvider(effectiveProjectId, chatRoomId);
    };
  }, [effectiveProjectId, chatRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !effectiveProjectId || !chatRoomId || isSending) return;

    setIsSending(true);
    setDraft('');
    try {
      const provider = providerRef.current;
      if (provider) {
        const sent = await provider.sendChatMessage(text);
        if (sent) {
          setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden min-h-0 bg-background">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4 select-none">
            <PlaneEmptyState
              variant="chat"
              isCompact
              title="Project Chat"
              description="Send real-time messages to collaborators working in this manuscript."
            />
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = Boolean(currentUserId && msg.userId === currentUserId);
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col rounded-md border border-border/70 p-2.5 text-xs',
                  isOwn ? 'bg-primary/5 border-primary/20 ml-4' : 'bg-card mr-4',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className="font-semibold text-[11px] truncate"
                    style={msg.userColor ? { color: msg.userColor } : undefined}
                  >
                    {msg.userName || 'Collaborator'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {msg.text}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="p-2.5 border-t border-border bg-background flex items-center gap-1.5 shrink-0"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message collaborators..."
          aria-label="Message collaborators"
          className="h-8 text-xs bg-background flex-1"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!draft.trim() || isSending}
          className="h-8 px-2.5 shrink-0"
          aria-label="Send message"
        >
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}

export default ProjectChatView;
