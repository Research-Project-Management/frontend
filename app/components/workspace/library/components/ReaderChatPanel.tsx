import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Copy, 
  Check, 
  ChevronDown, 
  Brain, 
  FileText, 
  Quote, 
  Send, 
  Loader2, 
  AlertTriangle, 
  X, 
  Sparkles,
  ArrowUp,
  Square
} from "lucide-react";
import { useParams } from "react-router";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { ChatMessage, SourceItem } from "~/types/chat";
import { 
  streamChatResponse, 
  getChatSession, 
  appendChatMessages, 
  createChatSession, 
  listChatSessions 
} from "~/query/chat-ai";
import { renderMarkdown } from "../../ai/layout/renderMarkdown";
import { cn } from "~/lib/utils";
import { Textarea } from "~/components/ui/textarea";

// Parse thinking blocks like ChatView.tsx
function parseThinkingContent(raw: string): {
  thinking: string | null;
  answer: string;
  isThinkingOpen: boolean;
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

function ThinkingBlock({ content, isOpen }: { content: string; isOpen: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-2.5 rounded-lg border border-border bg-secondary/15 overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-secondary/30 transition-colors"
      >
        <Brain className={cn("size-3.5 shrink-0 text-violet-400", isOpen && "animate-pulse")} />
        <span className="text-[10px] font-semibold text-muted-foreground flex-1">
          {isOpen ? "Thinking..." : "Thought Process"}
        </span>
        {!isOpen && (
          <ChevronDown className={cn("size-3 text-muted-foreground/60 transition-transform", collapsed && "-rotate-90")} />
        )}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 pt-0.5 border-t border-border/30">
          <p className="text-[10px] leading-relaxed text-muted-foreground/80 whitespace-pre-wrap font-mono select-text">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

function SourcesList({ sources }: { sources: SourceItem[] }) {
  if (!sources.length) return null;
  const ragSources = sources.filter((s) => s.source && !s.url);

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50">
        Sources
      </p>
      <div className="flex flex-wrap gap-1">
        {ragSources.map((s, i) =>
          s.snippet ? (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 max-w-48 truncate hover:bg-violet-500/15 transition-colors">
                  <FileText className="size-2.5 shrink-0" />
                  <span className="truncate">{s.source}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-72 p-0 overflow-hidden">
                <div className="px-2.5 py-1.5 border-b border-border bg-secondary/50 flex items-center gap-1.5">
                  <Quote className="size-3 text-violet-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-foreground/80 truncate">
                    {s.source}
                  </span>
                </div>
                <div className="px-2.5 py-2 max-h-40 overflow-y-auto">
                  <p className="text-[10px] leading-relaxed text-foreground/70 whitespace-pre-wrap select-text">
                    {s.snippet}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 max-w-48 truncate"
            >
              <FileText className="size-2.5 shrink-0" />
              <span className="truncate">{s.source}</span>
            </span>
          )
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  content: string;
  role: "user" | "assistant";
  isStreaming?: boolean;
  sources?: SourceItem[];
}

const MessageBubble = React.memo(function MessageBubble({
  content,
  role,
  isStreaming = false,
  sources,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex gap-2.5 animate-in fade-in-50 duration-200", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="shrink-0 size-6 rounded-md flex items-center justify-center mt-0.5 bg-background border shadow-sm">
          <img src="/Chat.svg" alt="AI" className="size-4" />
        </div>
      )}
      <div
        className={cn(
          "group relative max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed border select-text",
          isUser
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700/50 rounded-br-sm"
            : "bg-background text-foreground border-border rounded-bl-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-xs">{content}</p>
        ) : (
          <div className="space-y-1 text-xs">
            {(() => {
              const { thinking, answer, isThinkingOpen } = parseThinkingContent(content);
              return (
                <>
                  {thinking !== null && (
                    <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />
                  )}
                  {answer && renderMarkdown(answer)}
                  {isStreaming && !isThinkingOpen && (
                    <span className="inline-block w-1.5 h-3 bg-primary animate-pulse ml-0.5 align-middle" />
                  )}
                  {!isStreaming && sources && sources.length > 0 && (
                    <SourcesList sources={sources} />
                  )}
                </>
              );
            })()}
          </div>
        )}

        {!isUser && !isStreaming && content && (
          <div className="absolute right-2 -bottom-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-secondary/80 hover:bg-secondary border shadow-sm transition-all"
            >
              {copied ? (
                <>
                  <Check className="size-2.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-2.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

interface ReaderChatPanelProps {
  ragDocId: string;
  paperTitle: string;
  selectionContext: string;
  onClearSelectionContext: () => void;
}

export default function ReaderChatPanel({
  ragDocId,
  paperTitle,
  selectionContext,
  onClearSelectionContext,
}: ReaderChatPanelProps) {
  const { workspaceId } = useParams();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const activeSourcesRef = useRef<SourceItem[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Auto-resize input textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [inputMessage]);

  // Sync scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // Load chat session uniquely bound to this paper's ragDocId
  useEffect(() => {
    if (!workspaceId || !ragDocId) return;

    setIsLoadingHistory(true);
    listChatSessions(workspaceId)
      .then((sessions) => {
        const matching = sessions.find(
          (s) => s.documentIds?.length === 1 && s.documentIds[0] === ragDocId
        );
        if (matching) {
          setChatId(matching._id);
          return getChatSession(matching._id).then((session) => {
            setMessages(
              session.messages.map(({ role, content, sources, widgets }) => ({
                role,
                content,
                sources,
                widgets,
              }))
            );
          });
        } else {
          setChatId(null);
          setMessages([]);
        }
      })
      .catch((err) => console.error("Failed to restore reader chat session:", err))
      .finally(() => setIsLoadingHistory(false));

    return () => {
      abortRef.current?.abort();
    };
  }, [workspaceId, ragDocId]);

  // Handle incoming selection context
  useEffect(() => {
    if (selectionContext && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectionContext]);

  const handleSend = async (text: string) => {
    if (isStreaming || !workspaceId || !ragDocId) return;

    let finalPrompt = text.trim();
    if (selectionContext) {
      finalPrompt = `Regarding the following text selection from the paper:\n"${selectionContext}"\n\n${finalPrompt || "Explain or summarize this selection."}`;
      onClearSelectionContext();
    }

    if (!finalPrompt) return;

    const userMsg: ChatMessage = { role: "user", content: finalPrompt };
    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    setInputMessage("");
    streamRef.current = "";
    setStreamContent("");
    setIsStreaming(true);
    setSaveError(false);
    activeSourcesRef.current = [];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const chunk of streamChatResponse(newMessages, {
        signal: controller.signal,
        workspaceId,
        chatId: chatId ?? undefined,
        documentIds: [ragDocId],
        onMeta: (meta) => {
          if (meta.sources && meta.sources.length > 0) {
            activeSourcesRef.current = meta.sources;
          }
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
        sources: activeSourcesRef.current.length > 0 ? [...activeSourcesRef.current] : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (chatId) {
        await appendChatMessages(chatId, [userMsg, assistantMsg], [ragDocId]);
      } else {
        const title = `Paper Reader Chat: ${paperTitle.slice(0, 30)}`;
        const session = await createChatSession({
          workspaceId,
          title,
          messages: [userMsg, assistantMsg],
          documentIds: [ragDocId],
        });
        setChatId(session._id);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Reader chat error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I had trouble parsing that. Please try again.",
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      setStreamContent("");
      streamRef.current = "";
      abortRef.current = null;
      activeSourcesRef.current = [];
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputMessage);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 border-l border-border relative select-none">
      {/* Header */}
      <div className="h-13 shrink-0 border-b border-border bg-card flex items-center px-4 justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-blue-500 shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground leading-none">Flux AI Assistant</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-56 mt-0.5">
              RAG Scoped: {paperTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="size-6 animate-spin text-primary/50" />
            <p className="text-xs text-muted-foreground animate-pulse">Syncing chat history...</p>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center text-center p-6 h-full gap-3">
            <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center shadow-inner">
              <Sparkles className="size-5 text-primary" />
            </div>
            <h4 className="text-xs font-semibold">Chat about this paper</h4>
            <p className="text-[11px] leading-relaxed text-muted-foreground max-w-xs">
              Type any question below or select text in the PDF viewer to ask specifically about a paragraph.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                content={msg.content}
                role={msg.role}
                sources={msg.sources}
              />
            ))}
            {isStreaming && streamContent && (
              <MessageBubble
                content={streamContent}
                role="assistant"
                isStreaming={true}
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="shrink-0 p-3 border-t border-border bg-card">
        {/* Selection Context Chip */}
        {selectionContext && (
          <div className="mb-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs flex gap-2 items-start justify-between animate-in slide-in-from-bottom-1 duration-150">
            <div className="flex gap-1.5 items-start text-blue-700 dark:text-blue-300 min-w-0">
              <Quote className="size-3.5 shrink-0 mt-0.5 opacity-70" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[10px] leading-none mb-0.5">Selected excerpt context</span>
                <p className="text-[10px] leading-snug line-clamp-2 italic text-foreground/80 font-mono select-text">
                  "{selectionContext}"
                </p>
              </div>
            </div>
            <button
              onClick={onClearSelectionContext}
              className="shrink-0 hover:bg-blue-500/20 p-0.5 rounded text-blue-700 dark:text-blue-300 transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <div className="relative flex items-center border border-border bg-background rounded-xl p-1 shadow-sm transition-all focus-within:shadow focus-within:border-primary/45">
          <Textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={
              selectionContext
                ? "Ask AI about selection, or press enter..."
                : "Ask AI about this paper..."
            }
            className="border-none shadow-none focus-visible:ring-0 resize-none min-h-[38px] max-h-[120px] px-3 py-2 text-xs placeholder:text-muted-foreground/50 flex-1 select-text"
          />

          <button
            onClick={() => handleSend(inputMessage)}
            disabled={(!inputMessage.trim() && !selectionContext) || isStreaming}
            className="size-7.5 shrink-0 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-colors disabled:opacity-20"
          >
            {isStreaming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
