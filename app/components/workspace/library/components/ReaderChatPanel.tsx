import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain,
  ChevronDown,
  Copy,
  Check,
  FileText,
  Loader2,
  Quote,
  Sparkles,
  X,
  ArrowUp,
  RotateCcw,
} from "lucide-react";
import { useParams } from "react-router";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { ChatMessage, SourceItem } from "~/types/chat";
import {
  streamChatResponse,
  getChatSession,
  appendChatMessages,
  createChatSession,
  listChatSessions,
} from "~/query/chat-ai";
import { renderMarkdown } from "../../ai/layout/renderMarkdown";
import { cn } from "~/lib/utils";

// ── Think-block parser ────────────────────────────────────────────────────────

function parseThinkingContent(raw: string) {
  const openIdx = raw.indexOf("<think>");
  if (openIdx === -1) return { thinking: null, answer: raw, isThinkingOpen: false };
  const closeIdx = raw.indexOf("</think>", openIdx);
  if (closeIdx === -1) {
    return { thinking: raw.slice(openIdx + 7), answer: "", isThinkingOpen: true };
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
    <div className="mb-2.5 rounded-lg border border-[#dadce0] dark:border-zinc-700/50 bg-[#f8f9fa] dark:bg-zinc-800/50 overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#f1f3f4] dark:hover:bg-zinc-700/30 transition-colors"
      >
        <Brain className={cn("size-3.5 shrink-0 text-violet-500", isOpen && "animate-pulse")} />
        <span className="text-[11px] font-medium text-[#5f6368] dark:text-zinc-400 flex-1">
          {isOpen ? "Thinking…" : "Thought process"}
        </span>
        {!isOpen && (
          <ChevronDown
            className={cn(
              "size-3 text-[#5f6368]/60 dark:text-zinc-500 transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        )}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 pt-0.5 border-t border-[#eeeeee] dark:border-zinc-700/30">
          <p className="text-[10px] leading-relaxed text-[#5f6368]/80 dark:text-zinc-400/70 whitespace-pre-wrap font-mono select-text">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sources ──────────────────────────────────────────────────────────────────

function SourcesList({ sources }: { sources: SourceItem[] }) {
  const ragSources = sources.filter((s) => s.source && !s.url);
  if (!ragSources.length) return null;

  return (
    <div className="mt-2 pt-2 border-t border-[#eeeeee] dark:border-zinc-700/30 space-y-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#5f6368]/50 dark:text-zinc-500">
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
                <div className="px-2.5 py-1.5 border-b border-[#dadce0] dark:border-zinc-700 bg-[#f8f9fa] dark:bg-zinc-800 flex items-center gap-1.5">
                  <Quote className="size-3 text-violet-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-[#202222]/80 dark:text-zinc-200 truncate">
                    {s.source}
                  </span>
                </div>
                <div className="px-2.5 py-2 max-h-40 overflow-y-auto">
                  <p className="text-[10px] leading-relaxed text-[#202222]/70 dark:text-zinc-300 whitespace-pre-wrap select-text">
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
    <div className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="shrink-0 size-6 rounded-md flex items-center justify-center mt-0.5 bg-white dark:bg-zinc-800 border border-[#dadce0] dark:border-zinc-700">
          <img src="/Chat.svg" alt="AI" className="size-4" />
        </div>
      )}
      <div
        className={cn(
          "group relative max-w-[88%] rounded-xl px-3 py-2.5 text-sm leading-relaxed select-text",
          isUser
            ? "bg-[#3370ff] text-white rounded-br-sm"
            : "bg-white dark:bg-zinc-800/80 text-[#202222] dark:text-zinc-100 border border-[#dadce0] dark:border-zinc-700/50 rounded-bl-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[13px]">{content}</p>
        ) : (
          <div className="space-y-1 text-[13px]">
            {(() => {
              const { thinking, answer, isThinkingOpen } = parseThinkingContent(content);
              return (
                <>
                  {thinking !== null && <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />}
                  {answer && renderMarkdown(answer)}
                  {isStreaming && !isThinkingOpen && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#3370ff] animate-pulse ml-0.5 align-middle rounded-sm" />
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
          <div className="absolute right-2 -bottom-5 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[9px] text-[#5f6368] hover:text-[#202222] dark:text-zinc-400 dark:hover:text-zinc-100 px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-[#dadce0] dark:border-zinc-700 shadow-sm transition-all"
            >
              {copied ? (
                <>
                  <Check className="size-2.5 text-[#1e8e3e]" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-2.5" /> Copy
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Main component ───────────────────────────────────────────────────────────

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
    if (selectionContext && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectionContext]);

  // Auto-focus on mount or document changes
  useEffect(() => {
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [ragDocId]);

  // Re-focus after AI finishes streaming
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  // Focus-on-type: Automatically focus the chat input when the user starts typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isStreaming) return;

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
  }, [isStreaming]);

  const handleSend = async (text: string) => {
    if (isStreaming || !workspaceId || !ragDocId) return;

    let finalPrompt = text.trim();
    if (selectionContext) {
      finalPrompt = `Regarding this excerpt from the paper:\n"${selectionContext}"\n\n${finalPrompt || "Explain or summarize this passage."}`;
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
          if (meta.sources?.length) {
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

  const handleClearChat = () => {
    setMessages([]);
    setChatId(null);
    setStreamContent("");
    streamRef.current = "";
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-zinc-950">
      {/* Header */}
      <div className="h-[53px] shrink-0 border-b border-[#dadce0] dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-lg bg-white dark:bg-zinc-800 border border-[#dadce0] dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-sm">
            <img src="/Chat.svg" alt="Flux AI" className="size-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-semibold text-[#202222] dark:text-zinc-100 leading-none">
              Flux AI
            </span>
            <span className="text-[10px] text-[#5f6368] dark:text-zinc-400 truncate max-w-48 mt-0.5">
              {paperTitle}
            </span>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="p-1.5 rounded-md hover:bg-[#f1f3f4] dark:hover:bg-zinc-800 text-[#5f6368] dark:text-zinc-400 transition-colors"
            title="Clear conversation"
          >
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="size-6 animate-spin text-[#3370ff]/50" />
            <p className="text-xs text-[#5f6368] dark:text-zinc-400 animate-pulse">Loading history…</p>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center text-center p-6 h-full gap-4">
            <div className="size-12 bg-[#3370ff]/8 rounded-2xl flex items-center justify-center">
              <Sparkles className="size-6 text-[#3370ff]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-[13px] font-semibold text-[#202222] dark:text-zinc-100">
                Ask about this paper
              </h4>
              <p className="text-[11px] leading-relaxed text-[#5f6368] dark:text-zinc-400 max-w-52">
                Type a question below or select text in the PDF and click "Ask AI".
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-56">
              {["Summarize the key findings", "Explain the methodology", "What are the limitations?"].map(
                (prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="text-left text-[11px] px-3 py-2 rounded-lg border border-[#dadce0] dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-[#202222] dark:text-zinc-200 hover:bg-[#f1f3f4] dark:hover:bg-zinc-700/50 hover:border-[#3370ff]/30 transition-all"
                  >
                    {prompt}
                  </button>
                )
              )}
            </div>
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
              <MessageBubble content={streamContent} role="assistant" isStreaming={true} />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 p-3 border-t border-[#dadce0] dark:border-zinc-700 bg-white dark:bg-zinc-900">
        {/* Selection context chip */}
        {selectionContext && (
          <div className="mb-2 p-2.5 rounded-lg bg-[#3370ff]/5 border border-[#3370ff]/15 text-xs flex gap-2 items-start justify-between">
            <div className="flex gap-1.5 items-start text-[#3370ff] min-w-0">
              <Quote className="size-3.5 shrink-0 mt-0.5 opacity-70" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[10px] leading-none mb-1">Selected text</span>
                <p className="text-[10px] leading-snug line-clamp-2 italic text-[#202222]/70 dark:text-zinc-300 select-text">
                  "{selectionContext}"
                </p>
              </div>
            </div>
            <button
              onClick={onClearSelectionContext}
              className="shrink-0 hover:bg-[#3370ff]/10 p-0.5 rounded text-[#3370ff] transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <div className="relative flex items-end gap-2 bg-[#f8f9fa] dark:bg-zinc-800 border border-[#dadce0] dark:border-zinc-700 rounded-xl px-3 py-2 transition-all focus-within:border-[#3370ff]/50 focus-within:shadow-[0_0_0_2px_rgba(51,112,255,0.08)]">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={
              selectionContext
                ? "Ask about the selected text…"
                : "Ask about this paper…"
            }
            className="flex-1 bg-transparent border-none outline-none resize-none min-h-[24px] max-h-[120px] text-[13px] text-[#202222] dark:text-zinc-100 placeholder:text-[#5f6368]/50 dark:placeholder:text-zinc-500 leading-relaxed select-text"
          />

          {isStreaming ? (
            <button
              onClick={handleStop}
              className="size-7 shrink-0 flex items-center justify-center rounded-lg bg-[#d93025] text-white transition-colors hover:bg-[#d93025]/90"
              title="Stop generating"
            >
              <div className="size-2.5 rounded-sm bg-white" />
            </button>
          ) : (
            <button
              onClick={() => handleSend(inputMessage)}
              disabled={!inputMessage.trim() && !selectionContext}
              className="size-7 shrink-0 flex items-center justify-center rounded-lg bg-[#3370ff] text-white transition-colors hover:bg-[#3370ff]/90 disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ArrowUp className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
