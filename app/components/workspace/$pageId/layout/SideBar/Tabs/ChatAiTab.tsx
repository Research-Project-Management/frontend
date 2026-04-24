import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Copy, Check, Square, Trash2, X } from "lucide-react";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { streamChatResponse } from "~/query/chat-ai";
import { usePageContext } from "../../PageContext";
import { useWorkspaceActionsStore } from "~/stores/workspace-actions";
import type { ChatMessage } from "~/types/chat";
import { renderMarkdown } from "~/components/workspace/ai/layout/renderMarkdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const suggestions = [
  "Fix grammar in my document",
  "Explain this LaTeX command",
  "Improve this paragraph",
  "Add citations for this claim",
];

// ── Typing indicator — matches ChatView style ─────────────────────────────────
function TypingIndicator() {
  return (
    <>
      <style>{`
        @keyframes sidebar-typing-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
      <div className="flex items-center gap-1 px-1 py-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary/50"
            style={{
              animation: "sidebar-typing-dot 1.4s infinite ease-in-out",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ── Message bubble — matches ChatView MessageBubble ───────────────────────────
function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="shrink-0 size-7 rounded-lg flex items-center justify-center mt-0.5">
          <img src="/Chat.svg" alt="flux-ai" />
        </div>
      )}

      <div
        className={cn(
          "group relative",
          isUser
            ? "max-w-[85%] bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-br-md px-4 py-2.5 border border-zinc-200 dark:border-zinc-600"
            : "max-w-[90%]",
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <div className="text-sm leading-relaxed space-y-0.5">
            {message.content
              ? (
                <>
                  {renderMarkdown(message.content)}
                  {isStreaming && (
                    <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                  )}
                </>
              )
              : isStreaming && <TypingIndicator />}
          </div>
        )}

        {/* Copy button — hover only, AI messages only */}
        {!isUser && !isStreaming && message.content && (
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
}

export default function ChatAiTab({ onClose }: { onClose?: () => void }) {
  const { currentPage, getEditorContent } = usePageContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { pendingAiText, clearPendingAiText } = useWorkspaceActionsStore();

  // Pre-fill input when "Ask AI" is triggered from editor context menu
  useEffect(() => {
    if (!pendingAiText) return;
    setInput(pendingAiText);
    clearPendingAiText();
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [pendingAiText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    abortControllerRef.current = new AbortController();

    // Build context: recent chat history + optional editor snippet
    const editorSnippet = getEditorContent.current?.() ?? "";
    const systemContent = editorSnippet
      ? `You are a helpful LaTeX writing assistant. The user's current document starts with:\n\`\`\`latex\n${editorSnippet.slice(0, 3000)}\n\`\`\``
      : "You are a helpful LaTeX writing assistant.";

    const apiMessages: ChatMessage[] = [
      { role: "user", content: systemContent },
      ...updatedMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    let accumulated = "";

    try {
      const stream = streamChatResponse(apiMessages, {
        projectId: typeof currentPage?.project === "string"
          ? currentPage.project
          : currentPage?.project?._id,
        signal: abortControllerRef.current.signal,
      });

      for await (const chunk of stream) {
        accumulated += chunk;
        setStreamingContent(accumulated);
      }

      // Commit final message
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "assistant", content: accumulated },
        ]);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // user stopped — commit partial
        if (accumulated) {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 1).toString(), role: "assistant", content: accumulated },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    handleStop();
    setMessages([]);
    setStreamingContent("");
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-8 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/Chat.svg" alt="Chat AI" className="size-5" />
          <span className="font-semibold">Flux AI</span>
        </div>
        <div className="flex items-center gap-0.5">
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={clearChat}
                  className="p-1 hover:bg-primary/10 rounded cursor-pointer text-muted-foreground hover:text-primary"
                >
                  <Trash2 className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear Chat</TooltipContent>
            </Tooltip>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full p-3">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <img src="/Chat.svg" alt="flux-ai" className="size-12 mb-4" />
              <p className="text-sm font-medium text-primary">Flux AI</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask questions about your document
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Suggestions:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs px-2 py-1.5 rounded-full bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming response */}
            {isLoading && (
              <div className="flex gap-3 animate-in fade-in-0 duration-300">
                <div className="shrink-0 size-7 rounded-lg flex items-center justify-center mt-0.5">
                  <img src="/Chat.svg" alt="flux-ai" />
                </div>
                {streamingContent ? (
                  <div className="max-w-[90%] text-sm leading-relaxed space-y-0.5">
                    {renderMarkdown(streamingContent)}
                    <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                  </div>
                ) : (
                  <TypingIndicator />
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-shadow duration-300 focus-within:shadow-md focus-within:border-primary/30">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="border-none shadow-none focus-visible:ring-0 resize-none min-h-11 max-h-40 px-4 py-3 text-xs placeholder:text-muted-foreground/50"
            placeholder="Ask AI about your document..."
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <button
              onClick={isLoading ? handleStop : handleSend}
              disabled={!isLoading && !input.trim()}
              className="size-8 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Square className="size-3.5" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
