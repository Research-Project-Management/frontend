/**
 * ChatView — unified chat UI for both new chats and existing sessions.
 *
 * Replaces the old separate EmptyState / ChatAiDetail components.
 *
 * Route wiring:
 *   /:workspaceId/ai          → index.tsx  → re-exports this component (chatId = undefined)
 *   /:workspaceId/ai/:chatId  → $chatId.tsx → re-exports this component (chatId = string)
 *
 * New-chat flow:
 *   1. Welcome screen shown while no messages exist.
 *   2. User sends first message → stream immediately (component transitions to chat view).
 *   3. After stream completes → createChatSession with both messages atomically.
 *   4. navigate(/:workspaceId/ai/:id, { replace: true, state: { preloadedMessages } })
 *      so the new instance skips a redundant fetch and the Back button doesn't loop.
 *
 * Existing-session flow:
 *   1. chatId present → load history via getChatSession (or preloadedMessages from state).
 *   2. Each send → stream → appendChatMessages to backend.
 */

import { useParams, useLocation, useNavigate, useSearchParams } from "react-router";
import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  Copy,
  Check,
  ChevronDown,
  Brain,
  ExternalLink,
  FileText,
  Quote,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { ChatMessage, SourceItem, AgentAction } from "~/types/chat";
import { AGENT_CONFIGS } from "~/types/chat";
import type { AgentId } from "~/types/chat";
import {
  streamChatResponse,
  getChatSession,
  appendChatMessages,
  createChatSession,
} from "~/query/chat-ai";
import { renderMarkdown } from "./renderMarkdown";
import ChatAi from "../chatAi";
import { ActionCardsGroup } from "../ActionCard";
import { useChatMode } from "~/contexts/ChatModeContext";

// ── Agent metadata ──────────────────────────────────────────────────────────────

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  chat: {
    label: "General Chat",
    color: "bg-secondary/80 text-muted-foreground",
  },
  rag: {
    label: "Document Search",
    color: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  analyze: {
    label: "Analysis",
    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  latex: {
    label: "LaTeX",
    color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  task: {
    label: "Task Planning",
    color: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  web_search: {
    label: "Web Search",
    color: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  action: {
    label: "Workspace Agent",
    color: "bg-[#3370ff]/12 text-[#3370ff]",
  },
  latex_editor: {
    label: "LaTeX Editor AI",
    color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
};

function AgentBadge({ agent }: { agent: string }) {
  const info = AGENT_LABELS[agent] ?? {
    label: agent,
    color: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${info.color}`}
    >
      {info.label}
    </span>
  );
}

// ── Think-block parser ──────────────────────────────────────────────────────────

function parseThinkingContent(raw: string): {
  thinking: string | null;
  answer: string;
  isThinkingOpen: boolean; // true while still streaming inside <think>
} {
  const openIdx = raw.indexOf("<think>");
  if (openIdx === -1)
    return { thinking: null, answer: raw, isThinkingOpen: false };

  const closeIdx = raw.indexOf("</think>", openIdx);
  if (closeIdx === -1) {
    return {
      thinking: raw.slice(openIdx + 7),
      answer: "",
      isThinkingOpen: true,
    };
  }
  return {
    thinking: raw.slice(openIdx + 7, closeIdx).trim(),
    answer: raw.slice(closeIdx + 8).trimStart(),
    isThinkingOpen: false,
  };
}

function ThinkingBlock({
  content,
  isOpen,
}: {
  content: string;
  isOpen: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-3 rounded-xl border border-border/40 bg-secondary/20 overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
      >
        <Brain
          className={`size-3.5 shrink-0 text-violet-400 ${isOpen ? "animate-pulse" : ""}`}
        />
        <span className="text-[11px] font-medium text-muted-foreground flex-1">
          {isOpen ? "Thinking\u2026" : "Thought process"}
        </span>
        {!isOpen && (
          <ChevronDown
            className={`size-3.5 text-muted-foreground/60 transition-transform ${collapsed ? "-rotate-90" : ""}`}
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

// ── Sources list ───────────────────────────────────────────────────────────────

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
            title={[s.authors, s.snippet].filter(Boolean).join("\n")}
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
              <PopoverContent
                side="top"
                align="start"
                className="w-80 p-0 overflow-hidden"
              >
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

// ── Message bubble ──────────────────────────────────────────────────────────────

const MessageBubble = memo(function MessageBubble({
  content,
  role,
  isStreaming = false,
  sources,
}: {
  content: string;
  role: "user" | "assistant";
  isStreaming?: boolean;
  sources?: SourceItem[];
}) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${isUser ? "justify-end" : "justify-start"
        }`}
    >
      {!isUser && (
        <div className="shrink-0 size-7 rounded-lg flex items-center justify-center mt-0.5">
          <img src="/Chat.svg" alt="flux-ai" />
        </div>
      )}

      <div
        className={`group relative ${isUser
            ? "max-w-[85%] bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-br-md px-4 py-2.5 border border-zinc-200 dark:border-zinc-600"
            : "max-w-[90%]"
          }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        ) : (
          <div className="text-sm leading-relaxed space-y-0.5">
            {(() => {
              const { thinking, answer, isThinkingOpen } =
                parseThinkingContent(content);
              return (
                <>
                  {thinking !== null && (
                    <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />
                  )}
                  {answer && renderMarkdown(answer)}
                  {isStreaming && !isThinkingOpen && (
                    <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                  )}
                  {!isStreaming && sources && sources.length > 0 && (
                    <SourcesList sources={sources} />
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Copy button — hover only, AI messages only */}
        {!isUser && !isStreaming && content && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary/80 transition-colors"
            >
              {copied ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Typing indicator (three bouncing dots) ──────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-primary/50"
          style={{
            animation: "typing-dot 1.4s infinite ease-in-out",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Welcome Screen with Agent Cards ─────────────────────────────────────────────

/** Shown when the user arrives at /ai with no prior messages. */
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
  const handleAgentPrompt = (agentId: AgentId, prompt: string) => {
    onSend(prompt, undefined, undefined, agentId);
  };

  // Pick the 4 most useful agents for the welcome screen
  const featuredAgents = AGENT_CONFIGS.filter((a) =>
    ["action", "rag", "analyze", "web_search"].includes(a.id)
  );

  return (
    <div className="h-full flex flex-col items-center justify-center overflow-y-auto">
      {/* Hero */}
      <div className="flex group flex-col items-center mb-10">
        <img
          src="/Chat.svg"
          alt="Flux AI"
          className="size-16 mb-4 group-hover:rotate-180 transition-transform duration-1000"
        />
        <h3 className="font-semibold text-xl mb-1.5">Ask Flux AI</h3>
        <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
          Chat with your docs, manage your workspace, or search the web.
        </p>
      </div>

      {/* Agent capability cards — 2×2 grid */}
      <div className="w-full max-w-xl px-6 mb-10">
        <div className="grid grid-cols-2 gap-3">
          {featuredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onPromptClick={(prompt) => handleAgentPrompt(agent.id, prompt)}
            />
          ))}
        </div>
      </div>

      <div className="w-full">
        <ChatAi onSend={onSend} disabled={disabled} initialProject={initialProject} initialMessage={initialMessage} />
      </div>
    </div>
  );
}

/** A single agent capability card on the welcome page */
function AgentCard({
  agent,
  onPromptClick,
}: {
  agent: (typeof AGENT_CONFIGS)[number];
  onPromptClick: (prompt: string) => void;
}) {
  return (
    <div
      className={`rounded-xl p-4 transition-colors group/card cursor-default ${agent.bg}`}
    >
      <p className={`text-[11px] font-bold mb-1.5 tracking-wide uppercase ${agent.color}`}>
        {agent.label}
      </p>
      <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
        {agent.description}
      </p>
      <div className="flex flex-col gap-1.5">
        {agent.quickPrompts.slice(0, 2).map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="text-[11px] text-left px-2.5 py-1.5 rounded-lg bg-background/60 hover:bg-background/90 text-foreground/60 hover:text-foreground transition-all truncate"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Shown when a session exists but contains no messages. */
function EmptyConversation() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="size-14 rounded-2xl flex items-center justify-center mb-4">
        <img src="/Chat.svg" alt="flux-ai" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Start a conversation</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Ask about your project, analyze papers, generate LaTeX, or plan your
        next research tasks.
      </p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function ChatView() {
  const { chatId, workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || undefined;
  const initialProject = searchParams.get("project") || undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const {
    enabledDocumentIds,
    fluxDataEnabled,
    setFluxDataEnabled,
    restoreSourceIds,
    clearSources,
  } = useChatMode();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamContent, setStreamContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeActions, setActiveActions] = useState<AgentAction[]>([]);
  // chatStarted: true once the user sends the first message in a new session
  // prevents WelcomeScreen from re-appearing when session creation fails
  const [chatStarted, setChatStarted] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // projectId của session hiện tại — được đọc khi load history
  const [sessionProjectId, setSessionProjectId] = useState<string | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const activeSourcesRef = useRef<SourceItem[]>([]);
  // Mirror of `messages` kept in sync during render so handleSend can always
  // read the latest list without needing it in its own dependency array.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const scrollRafRef = useRef<number | null>(null);
  const autoSentRef = useRef(false);

  // Abort any in-progress stream when the component unmounts (e.g. navigating away)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // newChatKey is set by SideBar when user clicks "New Chat" while already at /ai
  const newChatKey = location.state?.newChatKey as number | undefined;

  // Load history when the session changes; also reset when forced by newChatKey
  useEffect(() => {
    if (!chatId) {
      // Reset all state when returning to the welcome screen
      setMessages([]);
      setStreamContent("");
      setIsStreaming(false);
      setActiveAgent(null);
      setChatStarted(false);
      setSaveError(false);
      setFluxDataEnabled(false);
      setSessionProjectId(undefined);
      clearSources();
      abortRef.current?.abort();
      abortRef.current = null;
      streamRef.current = "";
      activeSourcesRef.current = [];
      return;
    }

    // Prefer messages already passed via navigation state to avoid an extra fetch.
    // This is set by the new-chat flow after session creation.
    const preloaded: ChatMessage[] | undefined =
      location.state?.preloadedMessages;
    if (preloaded && preloaded.length > 0) {
      setMessages(preloaded);
      return;
    }

    setIsLoadingHistory(true);
    getChatSession(chatId)
      .then((session) => {
        setMessages(
          session.messages.map(({ role, content, sources }) => ({
            role,
            content,
            sources,
          })),
        );
        // Lưu projectId của session để truyền cho dropdown trong ChatAi
        if (session.projectId) {
          setSessionProjectId(session.projectId);
        }
        // Restore uploaded document IDs so the AI still has context from prior uploads
        if (session.documentIds?.length > 0) {
          restoreSourceIds(session.documentIds);
          setFluxDataEnabled(true);
        } else {
          setFluxDataEnabled(false);
          clearSources();
        }
      })
      .catch((err) => console.error("Failed to load history:", err))
      .finally(() => setIsLoadingHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, newChatKey]);

  useEffect(() => {
    if (scrollRafRef.current !== null)
      cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      scrollRafRef.current = null;
    });
  }, [messages, streamContent]);


  const handleSend = useCallback(
    async (text: string, projectId?: string, webSearchSites?: string[], intentHint?: string) => {
      if (isStreaming) return;

      const userMsg: ChatMessage = { role: "user", content: text };
      const newMessages = [...messagesRef.current, userMsg];
      setMessages(newMessages);
      streamRef.current = "";
      setStreamContent("");
      setIsStreaming(true);
      setActiveAgent(null);
      setActiveActions([]);
      setChatStarted(true);
      setSaveError(false);
      activeSourcesRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const chunk of streamChatResponse(newMessages, {
          signal: controller.signal,
          projectId,
          workspaceId,
          // RAG isolation — scope retrieval to this chat session only
          chatId: chatId ?? undefined,
          documentIds:
            fluxDataEnabled && enabledDocumentIds.length > 0
              ? enabledDocumentIds
              : undefined,
          webSearchSites,
          intentHint,
          onMeta: (meta) => {
            setActiveAgent(meta.agent);
            if (meta.sources && meta.sources.length > 0) {
              activeSourcesRef.current = meta.sources;
            }
          },
          onAction: (action) => {
            setActiveActions((prev) => [...prev, action]);
          },
        })) {
          streamRef.current += chunk;
          setStreamContent(streamRef.current);
        }

        const finalContent = streamRef.current;
        if (!finalContent) return;

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: finalContent,
          sources:
            activeSourcesRef.current.length > 0
              ? [...activeSourcesRef.current]
              : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (chatId) {
          // Existing session — persist the new exchange
          appendChatMessages(
            chatId,
            [userMsg, assistantMsg],
            fluxDataEnabled && enabledDocumentIds.length > 0
              ? enabledDocumentIds
              : undefined,
          ).catch((err) => console.error("Failed to save messages:", err));
        } else if (workspaceId) {
          // New chat — create session atomically with the first exchange already inside
          const title = text.trim().slice(0, 60) || "New Chat";
          try {
            const session = await createChatSession({
              workspaceId,
              title,
              projectId,
              messages: [userMsg, assistantMsg],
              documentIds:
                fluxDataEnabled && enabledDocumentIds.length > 0
                  ? enabledDocumentIds
                  : undefined,
            });
            // replace: true so Back doesn't loop to the welcome screen
            navigate(`/${workspaceId}/ai/${session._id}`, {
              replace: true,
              state: { preloadedMessages: [userMsg, assistantMsg] },
            });
          } catch (err) {
            console.error("Failed to create session:", err);
            setSaveError(true);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Chat error:", error);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Sorry, an error occurred. Please try again.",
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamContent("");
        streamRef.current = "";
        abortRef.current = null;
        setActiveAgent(null);
        setActiveActions([]);
        activeSourcesRef.current = [];
      }
    },
    [
      isStreaming,
      chatId,
      workspaceId,
      navigate,
      enabledDocumentIds,
      fluxDataEnabled,
    ],
  );
  // Stable ref to latest handleSend so auto-send effect doesn't get canceled
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  // Auto-send when ?q= is present (from dashboard chat input)
  useEffect(() => {
    if (initialQ && !chatId) {
      const timer = setTimeout(() => {
        handleSendRef.current(initialQ, initialProject, undefined, undefined);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Welcome screen: no session, not streaming, and no chat started yet ───────
  // chatStarted prevents the welcome screen from re-appearing after a failed
  // session-save (which would otherwise erase the visible conversation).
  if (!chatId && !isStreaming && !chatStarted) {
    return <WelcomeScreen onSend={handleSend} disabled={false} initialMessage={initialQ} initialProject={initialProject} />;
  }

  // ── Chat view ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Keyframe definition (needs to be in the DOM whenever dots are visible) */}
      <style>{`
        @keyframes typing-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2 rounded-full bg-primary/40"
                  style={{
                    animation: "typing-dot 1.4s infinite ease-in-out",
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
              />
            ))}

            {/* Streaming response — shown while tokens arrive */}
            {isStreaming && (streamContent || activeActions.length > 0) && (
              <div className="space-y-1">
                {activeAgent && (
                  <div className="pl-10">
                    <AgentBadge agent={activeAgent} />
                  </div>
                )}

                {/* Action cards from agent tool calls */}
                {activeActions.length > 0 && (
                  <div className="pl-10">
                    <ActionCardsGroup
                      actions={activeActions}
                      isStreaming={isStreaming}
                    />
                  </div>
                )}

                {streamContent && (
                  <MessageBubble
                    content={streamContent}
                    role="assistant"
                    isStreaming
                  />
                )}
              </div>
            )}

            {/* Typing indicator — shown before first token arrives */}
            {isStreaming && !streamContent && activeActions.length === 0 && (
              <div className="flex flex-col gap-1.5 animate-in fade-in-0 duration-300">
                {activeAgent && (
                  <div className="pl-10">
                    <AgentBadge agent={activeAgent} />
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="shrink-0 size-7 rounded-lg flex items-center justify-center">
                    <img src="/Chat.svg" alt="flux-ai" />
                  </div>
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Save-error banner */}
      {saveError && !chatId && (
        <div className="shrink-0 px-4 py-1.5 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive text-center">
            Could not save this conversation to the server. Your messages are
            visible but not persisted.
          </p>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0  bg-background/80 backdrop-blur-sm p-4">
        <ChatAi onSend={handleSend} disabled={isStreaming} initialProject={sessionProjectId} />
      </div>
    </div>
  );
}
