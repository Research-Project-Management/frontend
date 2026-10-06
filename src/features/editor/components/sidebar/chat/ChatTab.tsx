'use client';

/**
 * ChatTab.tsx
 *
 * Overleaf-parity Project Collaborator Chat Tab:
 * - Real-time peer-to-peer chat for all team members in the current project
 * - Live message stream with presence color indicators, avatars, and timestamps
 * - Fluid keyboard shortcuts (Enter to send, Shift+Enter for new line)
 * - Auto-scroll on new incoming messages
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Send, Users, Loader2 } from 'lucide-react';
import { useProjectChat } from '@/features/editor/hooks/use-project-chat';
import { cn } from '@/shared/lib/utils';
import { PlaneEmptyState, PlaneErrorState } from '@/shared/components/ui';
import { SidebarPanelHeader } from '../common/SidebarPanelHeader';

interface ChatTabProps {
  onClose?: () => void;
}

export default function ChatTab({ onClose }: ChatTabProps) {
  const params = useParams<{ projectId?: string }>();
  const projectId = params?.projectId;

  const { messages, isConnected, isSending, sendMessage, currentUser } = useProjectChat(
    projectId,
    true
  );

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setInputText('');
    await sendMessage(trimmed);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground select-none">
      {/* ── Header ── */}
      <SidebarPanelHeader
        title="Project Chat"
        onClose={onClose}
        closeAriaLabel="Close project chat"
      />

      {/* ── Message Stream ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {!isConnected ? (
          <div className="h-full flex items-center justify-center p-2">
            <PlaneErrorState
              title="Chat disconnected"
              description="Unable to reach the live collaborator chat service. Check your network or refresh."
              error={new Error('WebSocket connection interrupted')}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <PlaneEmptyState
              variant="chat"
              isCompact
              title="No chat messages yet"
              description="Chat with collaborators in real-time as you write and edit this manuscript."
            />
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isSelf = msg.userId === currentUser?.id;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const isSameSender = prevMsg && prevMsg.userId === msg.userId;

            return (
              <div
                key={msg.id}
                className={cn('flex flex-col', isSelf ? 'items-end' : 'items-start')}
              >
                {!isSameSender && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {!isSelf && (
                      <div
                        className="size-4.5 rounded-full flex items-center justify-center text-10 font-semibold text-white shrink-0"
                        style={{ backgroundColor: msg.userColor || 'var(--primary)' }}
                      >
                        {getInitials(msg.userName)}
                      </div>
                    )}
                    <span className="text-11 font-medium text-muted-foreground">
                      {isSelf ? 'You' : msg.userName}
                    </span>
                    <span className="text-10 text-muted-foreground/60">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-1.5 text-xs whitespace-pre-wrap leading-relaxed select-text shadow-2xs break-words',
                    isSelf
                      ? 'bg-primary text-primary-foreground rounded-tr-xs'
                      : 'bg-muted text-foreground border border-border/50 rounded-tl-xs'
                  )}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ── */}
      <div className="border-t border-border p-2.5 bg-background shrink-0">
        <div className="flex items-end gap-1.5 rounded-md border border-input bg-background p-1.5 shadow-2xs focus-within:ring-1 focus-within:ring-primary">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            className="flex-1 max-h-24 min-h-[28px] resize-none bg-transparent px-1.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/70 outline-none"
          />

          <button
            type="button"
            disabled={!inputText.trim() || isSending}
            onClick={handleSend}
            aria-label="Send message"
            className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {isSending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
