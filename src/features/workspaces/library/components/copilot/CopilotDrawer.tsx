'use client';

import React, { useRef, useEffect } from 'react';
import {
  Sparkles,
  ArrowUp,
  Square,
  Trash2,
  BookmarkPlus,
  Bot,
  User,
} from 'lucide-react';
import { useCopilotChat } from '../../hooks/reader/use-copilot-chat';
import { CopilotQuickPrompts } from './CopilotQuickPrompts';
import { CopilotCitationPill } from './CopilotCitationPill';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

interface CopilotDrawerProps {
  paperId: string;
  paperTitle: string;
  onNavigateToPage?: (pageNumber: number) => void;
  onSaveAsNote?: (noteContent: string) => void;
  className?: string;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  paperId,
  paperTitle,
  onNavigateToPage,
  onSaveAsNote,
  className,
}) => {
  const {
    messages,
    input,
    setInput,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    handleCitationClick,
  } = useCopilotChat({
    paperId,
    onNavigateToPage,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSaveNote = (content: string) => {
    if (onSaveAsNote) {
      onSaveAsNote(content);
      toast.success('Saved to Paper Literature Notes');
    } else {
      navigator.clipboard.writeText(content);
      toast.success('Copied insight to clipboard');
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border-l border-border/80 text-foreground relative z-20',
        className,
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="size-6 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border/60">
            <Sparkles className="size-3.5 text-foreground" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold truncate leading-tight">
              AI Copilot
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {paperTitle || 'Active Paper'}
            </span>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearMessages}
            title="Clear Chat History"
            aria-label="Clear chat history"
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* ── Message Area ─────────────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center gap-6 py-4">
            <div className="text-center space-y-1.5 px-2">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2 text-foreground border border-border/60">
                <Bot className="size-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Ask anything about this paper
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Grounded academic dialogue with strict page citations, formula explanations, and tabular summaries.
              </p>
            </div>
            <CopilotQuickPrompts onSelectPrompt={(p) => sendMessage(p)} />
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2.5 max-w-[95%]',
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto flex-row',
                )}
              >
                <div
                  className={cn(
                    'size-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold mt-0.5',
                    isUser
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground border border-border',
                  )}
                >
                  {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5 text-muted-foreground" />}
                </div>
                <div
                  className={cn(
                    'p-3 rounded-lg leading-relaxed text-xs space-y-2',
                    isUser
                      ? 'bg-foreground text-background rounded-tr-none'
                      : 'bg-muted/30 border border-border rounded-tl-none text-foreground',
                  )}
                >
                  <div className="whitespace-pre-wrap select-text">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3 bg-primary/70 align-middle ml-1 animate-pulse" />
                    )}
                  </div>

                  {/* Citations List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
                      {msg.citations.map((cite, idx) => (
                        <CopilotCitationPill
                          key={idx}
                          citation={cite}
                          onClick={handleCitationClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Action Bar for Assistant Message */}
                  {!isUser && !msg.isStreaming && (
                    <div className="pt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleSaveNote(msg.content)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                      >
                        <BookmarkPlus className="size-3" />
                        <span>Save to Notes</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Input Box ────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-border bg-background">
        <div className="flex items-end gap-1.5 p-1.5 rounded-lg border border-border bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-border transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or cite page..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/60 max-h-28 min-h-[32px]"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              aria-label="Stop generating response"
              className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!input.trim()}
              onClick={() => sendMessage()}
              aria-label="Send message"
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ArrowUp className="size-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1.5">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
