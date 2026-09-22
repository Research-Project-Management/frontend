'use client';

import { memo, useState } from 'react';
import {
  Copy,
  Check,
  ChevronDown,
  Brain,
  ExternalLink,
  FileText,
  Quote,
  CornerDownRight,
  ArrowDown,
  Loader2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { ChatMessage, SourceItem, AgentId } from '../types/chat.types';
import { renderMarkdown } from '../utils/render-markdown';
import { ChatInput } from '../components/chat/chat-input';
import { ActionCardsGroup } from '../components/chat/action-card';
import { ResponseWidgets, buildResponseWidgetsFromActions } from '../components/chat/response-widgets';
import { useChat } from '../hooks/use-chat';

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  chat: { label: 'General Chat', color: 'bg-secondary/80 text-muted-foreground' },
  rag: { label: 'Document Search', color: 'bg-primary/10 text-primary' },
  analyze: { label: 'Analysis', color: 'bg-success/15 text-success' },
  latex: { label: 'LaTeX', color: 'bg-warning/15 text-warning' },
  work_item: { label: 'Work Item Planning', color: 'bg-destructive/10 text-destructive' },
  web_search: { label: 'Web Search', color: 'bg-primary/15 text-primary' },
  action: { label: 'Workspace Agent', color: 'bg-primary/10 text-primary' },
};

function AgentBadge({ agent }: { agent: string }) {
  const info = (AGENT_LABELS as Record<string, { label: string; color: string }>)[agent] ?? {
    label: agent,
    color: 'bg-secondary text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${info.color}`}>
      {info.label}
    </span>
  );
}

function parseThinkingContent(raw: string): {
  thinking: string | null;
  answer: string;
  isThinkingOpen: boolean;
} {
  const openIdx = raw.indexOf('<think>');
  if (openIdx === -1) return { thinking: null, answer: raw, isThinkingOpen: false };

  const closeIdx = raw.indexOf('</think>', openIdx);
  if (closeIdx === -1) {
    return {
      thinking: raw.slice(openIdx + 7),
      answer: '',
      isThinkingOpen: true,
    };
  }
  return {
    thinking: raw.slice(openIdx + 7, closeIdx).trim(),
    answer: raw.slice(closeIdx + 8).trimStart(),
    isThinkingOpen: false,
  };
}

function ThinkingBlock({ content, isOpen }: { content: string; isOpen: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-3 rounded-md border border-border bg-muted/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={isOpen ? 'AI is thinking' : 'Toggle thought process'}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        <Brain className={`size-3.5 shrink-0 text-primary ${isOpen ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
        <span className="text-xs font-medium text-muted-foreground flex-1">
          {isOpen ? 'Thinking…' : 'Thought process'}
        </span>
        {!isOpen && (
          <ChevronDown
            className={`size-3.5 text-muted-foreground/60 transition-transform ${collapsed ? '-rotate-90' : ''} shrink-0`}
          />
        )}
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 pt-1 border-t border-border">
          <p className="text-xs leading-relaxed text-muted-foreground/70 whitespace-pre-wrap font-mono">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

function SourcesList({ sources }: { sources: SourceItem[] }) {
  if (!sources.length) return null;

  const webSources = sources.filter((s) => s.url);
  const ragSources = sources.filter((s) => s.source && !s.url);

  return (
    <div className="mt-3 pt-2.5 border-t border-border space-y-2">
      <p className="text-xs font-semibold text-muted-foreground/80">
        Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {webSources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={[s.authors, s.snippet].filter(Boolean).join('\n')}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors max-w-55 truncate"
          >
            <ExternalLink className="size-2.5 shrink-0" />
            <span className="truncate">{s.title || s.url}</span>
            {s.year && <span className="shrink-0 opacity-60">{s.year}</span>}
          </a>
        ))}
        {ragSources.map((s, i) =>
          s.snippet ? (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary max-w-55 truncate cursor-pointer hover:bg-primary/20 transition-colors">
                  <FileText className="size-2.5 shrink-0" />
                  <span className="truncate">{s.source}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-80 p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/60 flex items-center gap-2">
                  <Quote className="size-3 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground/80 truncate">
                    {s.source}
                  </span>
                </div>
                <div className="px-3 py-2.5 max-h-52 overflow-y-auto">
                  <p className="text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap">
                    {s.snippet}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary max-w-55 truncate cursor-default"
            >
              <FileText className="size-2.5 shrink-0" />
              <span className="truncate">{s.source}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({
  content,
  role,
  isStreaming = false,
  sources,
  widgets,
}: {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
  sources?: SourceItem[];
  widgets?: ChatMessage['widgets'];
}) {
  const [copied, setCopied] = useState(false);
  const isUser = role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`group relative ${
          isUser
            ? 'max-w-[85%] bg-muted text-foreground rounded-lg rounded-br-md px-4 py-2.5 border border-border'
            : 'max-w-[90%]'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="text-sm leading-relaxed space-y-0.5">
            {(() => {
              const { thinking, answer, isThinkingOpen } = parseThinkingContent(content);
              const hasWidgets = Boolean(widgets?.length);
              return (
                <>
                  {thinking !== null && <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />}
                  <ResponseWidgets widgets={widgets} />
                  {answer && !hasWidgets && renderMarkdown(answer)}
                  {isStreaming && !isThinkingOpen && (
                    <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                  )}
                  {!isStreaming && sources && sources.length > 0 && <SourcesList sources={sources} />}
                </>
              );
            })()}
          </div>
        )}

        {!isUser && !isStreaming && content && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              {copied ? <Check className="size-3 text-success shrink-0" /> : <Copy className="size-3 shrink-0" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const SUGGESTIONS = [
  {
    id: '1',
    text: 'Create a Sticky with details of all Urgent work items across this project',
  },
  {
    id: '2',
    text: 'Synthesize recent papers from the Project Library and summarize key evidence',
  },
  {
    id: '3',
    text: 'Draft research work items and milestone targets for the current Cycle',
  },
];

function WelcomeScreen({
  onSend,
  disabled,
  initialMessage,
  initialProject,
}: {
  onSend: (text: string, projectId?: string, webSearchSites?: string[], intentHint?: string) => void;
  disabled: boolean;
  initialMessage?: string;
  initialProject?: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center overflow-y-auto px-4 py-8">
      {/* Centered Heading */}
      <h1 className="text-24 sm:text-28 font-semibold tracking-tight text-foreground text-center mb-8">
        What can I do for you?
      </h1>

      {/* Main Input Box */}
      <div className="w-full max-w-2xl">
        <ChatInput
          onSend={onSend}
          disabled={disabled}
          initialProject={initialProject}
          initialMessage={initialMessage}
          className="max-w-2xl"
        />
      </div>

      {/* Suggestions Section */}
      <div className="w-full max-w-2xl mt-6">
        <p className="text-11 font-medium text-muted-foreground mb-3 select-none">
          Suggestions
        </p>
        <div className="space-y-0.5">
          {SUGGESTIONS.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSend(item.text, initialProject)}
              className={cn(
                "w-full flex items-start gap-2.5 py-2.5 px-2 -mx-2 rounded-md text-left text-13 leading-5 text-foreground hover:bg-muted transition-colors cursor-pointer",
                idx !== SUGGESTIONS.length - 1 && "border-b border-border/40"
              )}
            >
              <CornerDownRight className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="leading-snug">{item.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <p className="text-11 text-muted-foreground text-center select-none mt-12">
        Flux AI can make mistakes, please double-check responses.
      </p>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="mb-4 flex items-center justify-center select-none">
        <img
          src="/Chat.svg"
          alt="Flux AI conversation icon"
          className="size-14 object-contain"
        />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">Start a conversation</h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        Ask about your project, analyze papers, generate LaTeX, or plan your next research work items.
      </p>
    </div>
  );
}

export function ChatPage() {
  const {
    chatId,
    initialQ,
    initialProject,
    messages,
    streamContent,
    isStreaming,
    isLoadingHistory,
    activeAgent,
    activeActions,
    showScrollButton,
    chatStarted,
    saveError,
    sessionProjectId,
    messagesEndRef,
    scrollContainerRef,
    sendMessage,
    handleScroll,
    handleScrollToBottom,
  } = useChat();

  if (!chatId && !isStreaming && !chatStarted) {
    return (
      <WelcomeScreen
        onSend={sendMessage}
        disabled={false}
        initialMessage={initialQ}
        initialProject={initialProject}
      />
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Message list */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full bg-primary/40 animate-typing-dot motion-reduce:animate-none"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <EmptyConversation />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                content={msg.content}
                role={msg.role}
                sources={msg.sources}
                widgets={msg.widgets}
              />
            ))}

            {isStreaming && (
              <div className="space-y-1">
                {activeAgent && (
                  <div className="pl-0">
                    <AgentBadge agent={activeAgent} />
                  </div>
                )}

                {activeActions.length > 0 && (
                  <div className="pl-0">
                    <ActionCardsGroup actions={activeActions} isStreaming={isStreaming} />
                  </div>
                )}

                {streamContent ? (
                  <MessageBubble
                    content={streamContent}
                    role="assistant"
                    isStreaming
                    widgets={buildResponseWidgetsFromActions(activeActions)}
                  />
                ) : activeActions.length === 0 && (
                  <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border">
                      <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground">Thinking…</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {saveError && !chatId && (
        <div className="shrink-0 px-4 py-1.5 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive text-center">
            Could not save this conversation to the server. Your messages are visible but not persisted.
          </p>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] relative">
        {showScrollButton && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors"
            title="Scroll to bottom"
          >
            <ArrowDown className="size-4 shrink-0" />
          </button>
        )}
        <ChatInput onSend={sendMessage} disabled={isStreaming} initialProject={sessionProjectId} />
      </div>
    </div>
  );
}

export default ChatPage;
