'use client';

import React, { useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowUp,
  Square,
  BookmarkPlus,
  BookOpen,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { renderMarkdown } from '@/features/workspaces/ai/utils/render-markdown';
import { useCopilotChat } from '../../hooks/use-copilot';
import { chatMessageFormSchema } from '../../schemas/reader.schema';
import type { CopilotCitation, QuickPrompt, ChatMessageFormData } from '../../types/reader.types';
import { cn } from "@/shared/lib/utils";
import { copyToClipboard } from "@/shared/lib/utils";
import { toast } from 'sonner';

const DEFAULT_QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'contributions',
    title: 'Core scientific contributions',
    icon: 'BookOpen',
    prompt: 'Summarize the 3 main scientific contributions and novel insights of this paper in bullet points with page citations.',
    description: 'Key takeaways and novelty',
  },
  {
    id: 'methodology',
    title: 'Explain methodology & formulation',
    icon: 'BookOpen',
    prompt: 'Explain the core algorithmic methodology, mathematical formulations, and system architecture used in this work.',
    description: 'Equations & model design',
  },
  {
    id: 'datasets_table',
    title: 'Extract benchmark datasets & metrics',
    icon: 'BookOpen',
    prompt: 'Extract all benchmark datasets, evaluation metrics, and comparative baseline results into a Markdown table.',
    description: 'Benchmarks and accuracy',
  },
  {
    id: 'limitations',
    title: 'Limitations & future research',
    icon: 'BookOpen',
    prompt: 'What are the main experimental limitations, computational constraints, and future research directions mentioned by the authors?',
    description: 'Constraints and open problems',
  },
];

function CitationPill({
  citation,
  onClick,
}: {
  citation: CopilotCitation;
  onClick?: (pageNumber: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick(citation.pageNumber);
      }}
      title={citation.quote ? `Quote: "${citation.quote}"` : `Jump to Page ${citation.pageNumber}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-11 font-mono text-foreground border border-border bg-background hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer select-none"
    >
      <BookOpen className="size-3 shrink-0" />
      <span className="tabular-nums">p.{citation.pageNumber}</span>
      {citation.section && (
        <span className="text-10 truncate max-w-24 font-sans text-muted-foreground/70">
          ({citation.section})
        </span>
      )}
    </button>
  );
}

export interface ChatPanelProps {
  paperId: string;
  paperTitle?: string;
  onNavigateToPage?: (pageNumber: number) => void;
  onSaveAsNote?: (noteContent: string) => void;
  className?: string;
}

export default function ChatPanel({
  paperId,
  onNavigateToPage,
  onSaveAsNote,
  className,
}: ChatPanelProps) {
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    handleCitationClick,
  } = useCopilotChat({
    paperId,
    onNavigateToPage,
  });

  useEffect(() => {
    const handleClear = () => clearMessages();
    window.addEventListener('clear-reader-chat', handleClear);
    return () => window.removeEventListener('clear-reader-chat', handleClear);
  }, [clearMessages]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
  } = useForm<ChatMessageFormData>({
    resolver: zodResolver(chatMessageFormSchema),
    defaultValues: {
      message: '',
    },
  });

  const messageValue = watch('message');
  const canSend = Boolean(messageValue && messageValue.trim().length > 0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const onSubmit = (data: ChatMessageFormData) => {
    if (isStreaming) return;
    sendMessage(data.message);
    reset({ message: '' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const handleSaveNote = async (content: string) => {
    if (onSaveAsNote) {
      onSaveAsNote(content);
    } else {
      const ok = await copyToClipboard(content);
      if (ok) {
        toast.success('Copied insight to clipboard', { id: 'reader-clipboard' });
      }
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background text-foreground min-h-0',
        className,
      )}
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 text-xs min-h-0"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-end pb-2 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Document Assistant</p>
              <p className="text-11 text-muted-foreground leading-relaxed">
                Query hypotheses, extract formulations, or summarize specific sections.
              </p>
            </div>
            <div className="space-y-1">
              {DEFAULT_QUICK_PROMPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => sendMessage(item.prompt)}
                  className="w-full text-left py-1.5 px-2.5 rounded-sm text-xs text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors border border-border cursor-pointer flex items-center justify-between group"
                >
                  <span className="truncate">{item.title}</span>
                  <ArrowRight className="size-3 text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col',
                  isUser ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'p-2.5 rounded-sm leading-relaxed text-xs max-w-[95%]',
                    isUser
                      ? 'bg-muted text-foreground'
                      : 'border border-border bg-card text-foreground',
                  )}
                >
                  <div className="select-text overflow-hidden">
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="space-y-1 text-xs">
                        {renderMarkdown(msg.content)}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3 bg-primary align-middle ml-1 animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Citations List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-border flex flex-wrap gap-1">
                      {msg.citations.map((cite, idx) => (
                        <CitationPill
                          key={idx}
                          citation={cite}
                          onClick={handleCitationClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Action for Assistant Message */}
                  {!isUser && !msg.isStreaming && (
                    <div className="pt-1.5 mt-1.5 border-t border-border flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleSaveNote(msg.content)}
                        className="inline-flex items-center gap-1 text-11 text-foreground hover:bg-muted px-1.5 py-0.5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded-sm transition-colors cursor-pointer"
                        title="Save response to paper notes"
                      >
                        <BookmarkPlus className="size-3 shrink-0" />
                        <span>Save to Notes</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyToClipboard(msg.content);
                          if (ok) toast.success('Copied response to clipboard', { id: 'reader-clipboard' });
                        }}
                        className="inline-flex items-center gap-1 text-11 text-muted-foreground hover:text-foreground hover:bg-muted px-1.5 py-0.5 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded-sm transition-colors cursor-pointer"
                        title="Copy text"
                      >
                        <Copy className="size-3 shrink-0" />
                        <span>Copy</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="p-2 border-t border-border bg-background shrink-0"
      >
        <div className="flex items-center gap-1 rounded-sm border border-border bg-background focus-within:ring-1 focus-within:ring-ring px-2 py-1">
          <textarea
            {...register('message')}
            onKeyDown={handleKeyDown}
            aria-label="Ask assistant"
            placeholder="Ask a question..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 max-h-24 min-h-7 text-foreground leading-relaxed disabled:opacity-60"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              aria-label="Stop generation"
              className="size-6 flex items-center justify-center rounded-sm text-destructive hover:bg-destructive/10 focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none transition-colors shrink-0 cursor-pointer"
            >
              <Square className="size-3 fill-current shrink-0" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="size-6 flex items-center justify-center rounded-sm text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors shrink-0 cursor-pointer"
            >
              <ArrowUp className="size-3.5 shrink-0" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between px-1 pt-1.5 text-10 text-muted-foreground/60 select-none">
          <span>Enter to send, Shift+Enter for newline</span>
        </div>
      </form>
    </div>
  );
}
