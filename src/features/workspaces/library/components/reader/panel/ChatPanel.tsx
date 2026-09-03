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
  BookOpen,
  Lightbulb,
  FunctionSquare,
  Table2,
  AlertCircle,
} from 'lucide-react';
import { useCopilotChat } from '../../../hooks/reader/use-copilot';
import type { CopilotCitation, QuickPrompt } from '../../../types/copilot.types';
import { cn } from '@/shared/lib/utils';
import { useLibraryClipboard } from '../../../hooks/library/use-clipboard';

// ── Default Quick Prompts ────────────────────────────────────────────────────

const DEFAULT_QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'contributions',
    title: 'Core Contributions',
    icon: 'Sparkles',
    prompt: 'Summarize the 3 main scientific contributions and novel insights of this paper in bullet points with page citations.',
    description: 'Key takeaways and novelty',
  },
  {
    id: 'methodology',
    title: 'Explain Methodology',
    icon: 'FunctionSquare',
    prompt: 'Explain the core algorithmic methodology, mathematical formulations, and system architecture used in this work.',
    description: 'Equations & model design',
  },
  {
    id: 'datasets_table',
    title: 'Extract Datasets & Metrics',
    icon: 'Table2',
    prompt: 'Extract all benchmark datasets, evaluation metrics, and comparative baseline results into a Markdown table.',
    description: 'Benchmarks and accuracy',
  },
  {
    id: 'limitations',
    title: 'Limitations & Future Work',
    icon: 'AlertCircle',
    prompt: 'What are the main experimental limitations, computational constraints, and future research directions mentioned by the authors?',
    description: 'Constraints and open problems',
  },
];

// ── Citation Pill ────────────────────────────────────────────────────────────

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
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-muted text-foreground border border-border hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-95 transition-colors cursor-pointer select-none"
    >
      <BookOpen className="size-3 text-foreground shrink-0" />
      <span className="tabular-nums">p. {citation.pageNumber}</span>
      {citation.section && (
        <span className="text-[11px] text-muted-foreground font-normal truncate max-w-28 font-sans">
          ({citation.section})
        </span>
      )}
    </button>
  );
}

// ── Quick Prompts ────────────────────────────────────────────────────────────

function QuickPromptsView({
  onSelectPrompt,
  disabled = false,
}: {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="size-3.5 text-foreground shrink-0" />;
      case 'FunctionSquare':
        return <FunctionSquare className="size-3.5 text-foreground shrink-0" />;
      case 'Table2':
        return <Table2 className="size-3.5 text-foreground shrink-0" />;
      case 'AlertCircle':
        return <AlertCircle className="size-3.5 text-foreground shrink-0" />;
      default:
        return <Lightbulb className="size-3.5 text-foreground shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground px-1">
        Quick Academic Starters
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {DEFAULT_QUICK_PROMPTS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            className="flex flex-col items-start p-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {getIcon(item.icon)}
              <span className="text-xs font-medium text-foreground group-hover:text-foreground transition-colors">
                {item.title}
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {item.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main ChatPanel Component ─────────────────────────────────────────────────

export interface ChatPanelProps {
  paperId: string;
  paperTitle: string;
  onNavigateToPage?: (pageNumber: number) => void;
  onSaveAsNote?: (noteContent: string) => void;
  className?: string;
}

export default function ChatPanel({
  paperId,
  paperTitle,
  onNavigateToPage,
  onSaveAsNote,
  className,
}: ChatPanelProps) {
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

  const { copyToClipboard } = useLibraryClipboard();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSaveNote = (content: string) => {
    if (onSaveAsNote) {
      onSaveAsNote(content);
    } else {
      copyToClipboard(content, 'Copied insight to clipboard');
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
          <div className="size-6 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border">
            <Sparkles className="size-3.5 text-foreground" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold truncate leading-tight text-foreground">
              AI Assistant
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
            className="p-1.5 rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Trash2 className="size-3.5 text-foreground" />
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
              <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2 text-foreground border border-border">
                <Bot className="size-5 text-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Ask anything about this paper
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Grounded academic dialogue with strict page citations, formula explanations, and tabular summaries.
              </p>
            </div>
            <QuickPromptsView onSelectPrompt={(p) => sendMessage(p)} />
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
                    'size-6 rounded-full flex items-center justify-center shrink-0 text-xs font-medium mt-0.5',
                    isUser
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-foreground border border-border',
                  )}
                >
                  {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5 text-foreground" />}
                </div>
                <div
                  className={cn(
                    'p-3 rounded-md leading-relaxed text-xs space-y-2',
                    isUser
                      ? 'bg-foreground text-background rounded-tr-none'
                      : 'bg-card border border-border rounded-tl-none text-foreground',
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
                        <CitationPill
                          key={idx}
                          citation={cite}
                          onClick={handleCitationClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Action Bar for Assistant Message */}
                  {!isUser && !msg.isStreaming && (
                    <div className="pt-1 flex items-center gap-2 text-xs text-foreground">
                      <button
                        type="button"
                        onClick={() => handleSaveNote(msg.content)}
                        className="inline-flex items-center gap-1 hover:text-foreground/80 transition-colors cursor-pointer"
                      >
                        <BookmarkPlus className="size-3 text-foreground" />
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
        <div className="flex items-end gap-1.5 p-1.5 rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-border transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or cite page..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/60 max-h-28 min-h-[32px] text-foreground"
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
}
