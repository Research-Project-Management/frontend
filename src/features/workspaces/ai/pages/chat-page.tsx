'use client';

import { memo, useState, type ComponentType, type SVGProps } from 'react';
import {
  Copy,
  Check,
  ChevronDown,
  Brain,
  ExternalLink,
  FileText,
  Quote,
  Search,
  BookOpen,
  BarChart3,
  WandSparkles,
  ArrowRight,
  ArrowDown,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { ChatMessage, SourceItem, AgentId } from '../types/chat.types';
import { renderMarkdown } from '../utils/render-markdown';
import { ChatInput } from '../components/chat/chat-input';
import { ActionCardsGroup } from '../components/chat/action-card';
import { ResponseWidgets, buildResponseWidgetsFromActions } from '../components/chat/response-widgets';
import { useChat } from '../hooks/use-chat';

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  chat: { label: 'General Chat', color: 'bg-secondary/80 text-muted-foreground' },
  rag: { label: 'Document Search', color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  analyze: { label: 'Analysis', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  latex: { label: 'LaTeX', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  task: { label: 'Task Planning', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  web_search: { label: 'Web Search', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  action: { label: 'Workspace Agent', color: 'bg-primary/10 text-primary' },
};

function AgentBadge({ agent }: { agent: string }) {
  const info = AGENT_LABELS[agent] ?? {
    label: agent,
    color: 'bg-secondary text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${info.color}`}>
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
    <div className="mb-3 rounded-lg border border-border/40 bg-secondary/20 overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
      >
        <Brain className={`size-3.5 shrink-0 text-violet-400 ${isOpen ? 'animate-pulse' : ''}`} />
        <span className="text-[11px] font-medium text-muted-foreground flex-1">
          {isOpen ? 'Thinking…' : 'Thought process'}
        </span>
        {!isOpen && (
          <ChevronDown
            className={`size-3.5 text-muted-foreground/60 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        )}
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <p className="text-[11px] leading-relaxed text-muted-foreground/70 whitespace-pre-wrap font-mono">
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
    <div className="mt-3 pt-2.5 border-t border-border/40 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
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
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition-colors max-w-55 truncate"
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
                <button className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 max-w-55 truncate cursor-pointer hover:bg-violet-500/20 transition-colors">
                  <FileText className="size-2.5 shrink-0" />
                  <span className="truncate">{s.source}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-80 p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50 bg-secondary/60 flex items-center gap-2">
                  <Quote className="size-3 text-violet-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-foreground/80 truncate">
                    {s.source}
                  </span>
                </div>
                <div className="px-3 py-2.5 max-h-52 overflow-y-auto">
                  <p className="text-[11px] leading-relaxed text-foreground/70 whitespace-pre-wrap">
                    {s.snippet}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 max-w-55 truncate cursor-default"
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
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary/80 transition-colors"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

type WelcomeStarter = {
  id: string;
  title: string;
  description: string;
  draft: string;
  agent: AgentId;
  webSearch?: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const WELCOME_STARTERS: WelcomeStarter[] = [
  {
    id: 'paper-scout',
    title: 'Find papers',
    description: 'Prepare an academic web search with source filters enabled.',
    draft: 'Find recent papers about [topic], compare the strongest methods, and return links with short notes.',
    agent: 'web_search',
    webSearch: true,
    icon: Search,
  },
  {
    id: 'library-qa',
    title: 'Ask my library',
    description: 'Use indexed Library sources already attached to this chat.',
    draft: 'Using my selected Library sources, explain the key findings and cite the relevant papers.',
    agent: 'rag',
    icon: BookOpen,
  },
  {
    id: 'compare',
    title: 'Analyze evidence',
    description: 'Structure tradeoffs, gaps, metrics, and next experiments.',
    draft: 'Analyze these papers as evidence: what agrees, what conflicts, and what should I test next?',
    agent: 'analyze',
    icon: BarChart3,
  },
  {
    id: 'workspace',
    title: 'Plan work',
    description: 'Turn research intent into concrete workspace actions.',
    draft: 'Help me turn this research goal into project tasks, milestones, and a first-week plan.',
    agent: 'action',
    icon: WandSparkles,
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
  const [starter, setStarter] = useState<WelcomeStarter | null>(null);
  const composerMessage = starter?.draft ?? initialMessage;

  return (
    <div className="h-full flex flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <div className="flex group flex-col items-center mb-8">
        <img src="/Chat.svg" alt="AI" className="size-14 mb-5" />
        <h3 className="font-serif font-semibold text-3xl mb-2">Ask AI</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
          Pick a workflow, refine the draft, then send when it feels right.
        </p>
      </div>

      <div className="w-full max-w-2xl mb-8">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WELCOME_STARTERS.map((item) => {
            const Icon = item.icon;
            const active = starter?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStarter(item)}
                className={cn(
                  'group flex min-h-28 items-start gap-3.5 rounded-lg border bg-card p-4 text-left transition-all',
                  active
                    ? 'border-primary/40 bg-primary/5 shadow-sm'
                    : 'border-border/50 hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground group-hover:text-primary',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-medium text-foreground">{item.title}</p>
                    <ArrowRight
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1',
                        active && 'text-primary',
                      )}
                    />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  <p className="mt-2.5 line-clamp-1 text-xs text-foreground/50">{item.draft}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full">
        <ChatInput
          onSend={onSend}
          disabled={disabled}
          initialProject={initialProject}
          initialMessage={composerMessage}
          initialAgent={starter?.agent}
          initialWebSearch={starter?.webSearch}
        />
      </div>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="size-16 rounded-3xl flex items-center justify-center mb-5 bg-muted/30">
        <img src="/Chat.svg" alt="ai" className="size-8" />
      </div>
      <h2 className="text-2xl font-serif font-semibold mb-2">Start a conversation</h2>
      <p className="text-base text-muted-foreground max-w-sm leading-relaxed">
        Ask about your project, analyze papers, generate LaTeX, or plan your next research tasks.
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
      <style>{`
        @keyframes typing-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>

      {/* Message list */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full bg-primary/40"
                  style={{
                    animation: 'typing-dot 1.4s infinite ease-in-out',
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
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/30">
                      <div className="size-3.5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
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
      <div className="shrink-0 bg-background/80 backdrop-blur-sm p-4 relative">
        {showScrollButton && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:shadow hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95 transition-all duration-200"
            title="Scroll to bottom"
          >
            <ArrowDown className="size-4" />
          </button>
        )}
        <ChatInput onSend={sendMessage} disabled={isStreaming} initialProject={sessionProjectId} />
      </div>
    </div>
  );
}

export default ChatPage;
