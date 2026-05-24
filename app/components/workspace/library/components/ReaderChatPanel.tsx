import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  FileText,
  Quote,
  X,
  ArrowUp,
  Square,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { ChatMessage, SourceItem } from "~/types/chat";
import {
  streamChatResponse,
  getChatSession,
  appendChatMessages,
  createChatSession,
  listChatSessions,
  deleteChatSession,
} from "~/query/chat-ai";
import { renderMarkdown } from "../../ai/layout/renderMarkdown";
import { cn } from "~/lib/utils";

// ── Think-block parser ────────────────────────────────────────────────────────

function getVisibleAssistantContent(raw: string) {
  const closeIdx = raw.indexOf("</think>");
  if (closeIdx !== -1) return raw.slice(closeIdx + 8).trimStart();
  return raw.replace(/<think>[\s\S]*$/, "").trimStart();
}

// ── Sources ──────────────────────────────────────────────────────────────────

function SourcesList({ sources }: { sources: SourceItem[] }) {
  const ragSources = sources.filter((s) => s.source && !s.url);
  if (!ragSources.length) return null;

  return (
    <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        Sources
      </p>
      <div className="flex flex-wrap gap-1">
        {ragSources.map((s, i) =>
          s.snippet ? (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button className="inline-flex max-w-48 items-center gap-1 truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary transition-colors hover:bg-primary/15">
                  <FileText className="size-2.5 shrink-0" />
                  <span className="truncate">{s.source}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-72 p-0 overflow-hidden">
                <div className="flex items-center gap-1.5 border-b border-border bg-muted/45 px-2.5 py-1.5">
                  <Quote className="size-3 shrink-0 text-primary" />
                  <span className="truncate text-[10px] font-semibold text-foreground/80">
                    {s.source}
                  </span>
                </div>
                <div className="px-2.5 py-2 max-h-40 overflow-y-auto">
                  <p className="select-text whitespace-pre-wrap text-[10px] leading-relaxed text-foreground/70">
                    {s.snippet}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span
              key={i}
              className="inline-flex max-w-48 items-center gap-1 truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
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

// ── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({
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
      className={cn(
        "flex gap-2.5",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "group relative select-text",
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            : "max-w-[92%]"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[13px]">{content}</p>
        ) : (
          <div className="space-y-1 text-[13px] leading-relaxed">
            {(() => {
              const answer = getVisibleAssistantContent(content);
              return (
                <>
                  {answer && renderMarkdown(answer)}
                  {isStreaming && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-text-bottom" />
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
          <button
            onClick={handleCopy}
            className="mt-1 flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-colors hover:bg-secondary/80 hover:text-foreground group-hover:opacity-100"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
});

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-primary/50"
          style={{ animation: "typing-dot 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface ReaderChatPanelProps {
  ragDocId: string;
  paperTitle: string;
  selectionContext: string;
  onClearSelectionContext: () => void;
  showHeader?: boolean;
  autoFocus?: boolean;
}

export default function ReaderChatPanel({
  ragDocId,
  paperTitle,
  selectionContext,
  onClearSelectionContext,
  showHeader = true,
  autoFocus = true,
}: ReaderChatPanelProps) {
  const { workspaceId } = useParams();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const activeSourcesRef = useRef<SourceItem[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [inputMessage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  // Load existing chat session for this paper
  useEffect(() => {
    if (!workspaceId || !ragDocId) return;

    setIsLoadingHistory(true);
    listChatSessions(workspaceId)
      .then((sessions) => {
        // Find a session that matches this ragDocId
        const matching = sessions.find(
          (s: any) => s.documentIds?.length === 1 && s.documentIds[0] === ragDocId
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
      .catch((err) => console.error("Failed to restore reader chat:", err))
      .finally(() => setIsLoadingHistory(false));

    return () => {
      abortRef.current?.abort();
    };
  }, [workspaceId, ragDocId]);

  // Focus textarea when selection context arrives
  useEffect(() => {
    if (autoFocus && selectionContext && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, selectionContext]);

  // Auto-focus on mount or document changes
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [autoFocus, ragDocId]);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // Re-focus after AI finishes streaming
  useEffect(() => {
    if (autoFocus && !isStreaming) {
      textareaRef.current?.focus();
    }
  }, [autoFocus, isStreaming]);

  // Focus-on-type: Automatically focus the chat input when the user starts typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!autoFocus || isStreaming) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key.length === 1 && e.key !== " ") {
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [autoFocus, isStreaming]);

  const handleSend = async (text: string) => {
    if (isStreaming || !workspaceId || !ragDocId) return;

    const selectedText = selectionContext.trim();
    const hasSelectedText = selectedText.length > 0;
    const finalPrompt = text.trim() || (hasSelectedText ? "Explain the selected passage." : "");
    if (!finalPrompt) return;

    const userMsg: ChatMessage = { role: "user", content: finalPrompt };
    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    setInputMessage("");
    streamRef.current = "";
    setStreamContent("");
    setIsStreaming(true);
    activeSourcesRef.current = [];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const chunk of streamChatResponse(newMessages, {
        signal: controller.signal,
        workspaceId,
        chatId: chatId ?? undefined,
        documentIds: [ragDocId],
        intentHint: "rag",
        selection: hasSelectedText ? selectedText : undefined,
        cursorContext: hasSelectedText
          ? `The user selected this passage in the reader. Use it as the focus, but answer from the indexed paper context.`
          : undefined,
        onMeta: (meta) => {
          if (meta.sources?.length) {
            activeSourcesRef.current = meta.sources;
          }
        },
      })) {
        streamRef.current += chunk;
        setStreamContent(streamRef.current);
      }

      if (hasSelectedText) {
        onClearSelectionContext();
      }

      const finalContent = streamRef.current;
      if (!finalContent) return;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: finalContent,
        sources: activeSourcesRef.current.length > 0 ? [...activeSourcesRef.current] : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Persist to backend
      try {
        if (chatId) {
          await appendChatMessages(chatId, [userMsg, assistantMsg], [ragDocId]);
        } else {
          const title = `Paper: ${paperTitle.slice(0, 40)}`;
          const session = await createChatSession({
            workspaceId,
            title,
            messages: [userMsg, assistantMsg],
            documentIds: [ragDocId],
          });
          setChatId(session._id);
        }
      } catch (saveErr) {
        console.warn("Failed to persist chat:", saveErr);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Chat stream error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "An error occurred while processing your request. Please try again.",
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

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputMessage);
    }
  };

  const handleClearChat = useCallback(async () => {
    setShowClearConfirm(false);
    const activeChatId = chatId;
    setMessages([]);
    setChatId(null);
    setStreamContent("");
    streamRef.current = "";

    if (activeChatId) {
      try {
        await deleteChatSession(activeChatId);
        toast.success("Conversation cleared");
      } catch (err) {
        console.error("Failed to delete chat session:", err);
        toast.error("Could not clear conversation from server");
      }
    }
  }, [chatId]);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <style>{`
        @keyframes typing-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>

      {/* Header */}
      {showHeader && (
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/Chat.svg" alt="Flux AI" className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Flux AI
            </span>
          </div>
          {showClearConfirm ? (
            <div className="flex h-8 items-center gap-0.5 rounded-md border border-destructive/20 bg-destructive/10 px-1">
              <button
                onClick={handleClearChat}
                title="Confirm clear conversation"
                className="flex size-6 items-center justify-center rounded text-destructive hover:bg-destructive/15 transition-colors"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                title="Cancel"
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (messages.length > 0) {
                  setShowClearConfirm(true);
                } else {
                  handleClearChat();
                }
              }}
              title="Clear conversation"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {isLoadingHistory && (
        <div className="absolute left-0 right-0 top-0 z-10 h-0.5 overflow-hidden">
          <div className="mx-auto h-full w-3/5 animate-pulse bg-primary/50" />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isStreaming && !isLoadingHistory ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="group flex flex-col items-center">
                <img
                  src="/Chat.svg"
                  alt="Flux AI"
                  className="mb-2 size-10 transition-transform duration-1000 group-hover:rotate-180"
                />
                <p className="text-sm font-semibold">Flux AI Reader</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                  Ask about this indexed paper.
                </p>
              </div>
            </div>
            <div className="w-full space-y-1.5">
              {["Summarize the key findings", "Explain the methodology", "What are the limitations?"].map(
                (prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInputMessage(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="group flex w-full items-center gap-2 rounded-xl border border-border/40 bg-secondary/20 px-3 py-2 text-left text-[11px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    <span className="shrink-0 text-primary/40 transition-colors group-hover:text-primary">›</span>
                    <span className="truncate">{prompt}</span>
                  </button>
                )
              )}
            </div>
            <p className="text-center text-[10px] text-muted-foreground/30">
              Select text in the PDF to focus the next answer.
            </p>
          </div>
        ) : (
          <div className="space-y-4 px-3 py-4">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                content={msg.content}
                role={msg.role}
                sources={msg.sources}
              />
            ))}
            {isStreaming && (
              <div className="flex gap-2.5">
                <div className="max-w-[92%]">
                  {streamContent ? (
                    <MessageBubble content={streamContent} role="assistant" isStreaming={true} />
                  ) : (
                    <TypingIndicator />
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="relative shrink-0 border-t border-border/40 px-3 pb-3 pt-2">
        {/* Selection context chip */}
        {selectionContext && (
          <div className="group relative mb-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/35 px-2.5 py-1.5">
              <FileText className="size-3 shrink-0 text-primary/60" />
              <span className="truncate text-[10px] font-mono text-muted-foreground">
                selected passage
              </span>
              <span className="shrink-0 text-[9px] text-muted-foreground/45">
                {selectionContext.split(/\s+/).filter(Boolean).length}w
              </span>
              <button
                onClick={onClearSelectionContext}
                className="ml-auto rounded p-px text-muted-foreground/40 transition-colors hover:text-foreground"
                title="Clear selected context"
              >
                <X className="size-2.5" />
              </button>
            </div>
            <div className="pointer-events-none absolute bottom-full left-0 right-0 z-50 mb-1 hidden group-hover:block">
              <div className="rounded-xl border border-border bg-popover p-2.5 text-[10px] font-mono shadow-xl">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <FileText className="size-3 text-primary/70" />
                  <span className="text-muted-foreground">Reader selection</span>
                  <span className="ml-auto text-muted-foreground/40">{selectionContext.length}ch</span>
                </div>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap leading-relaxed text-muted-foreground/70">
                  {selectionContext}
                </pre>
              </div>
            </div>
          </div>
        )}

        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-shadow duration-300 focus-within:border-primary/30 focus-within:shadow-md">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoadingHistory}
            placeholder={
              selectionContext
                ? "Ask about the selected text..."
                : "Ask Flux AI about this paper..."
            }
            className="max-h-[140px] w-full resize-none bg-transparent px-4 pb-1 pt-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
          />

          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <span className="font-mono text-[10px] text-muted-foreground/30">
              {messages.length > 0 ? `${messages.length} msg` : "paper chat"}
            </span>
            <button
              onClick={isStreaming ? handleStop : () => handleSend(inputMessage)}
              disabled={(!inputMessage.trim() && !selectionContext && !isStreaming) || isLoadingHistory}
              className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-20"
            >
              {isStreaming ? <Square className="size-3.5" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
