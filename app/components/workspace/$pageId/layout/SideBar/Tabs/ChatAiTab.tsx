import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Sparkles, Square, Trash2, User, X } from "lucide-react";
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

export default function ChatAiTab({ onClose }: { onClose?: () => void }) {
  const { currentPage, getEditorContent } = usePageContext();
  const [messages, setMessages] = useState<Message[]>([]);
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
  }, [messages]);

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

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

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

    try {
      const stream = streamChatResponse(apiMessages, {
        projectId: currentPage?.projectId ?? undefined,
        signal: abortControllerRef.current.signal,
      });

      for await (const chunk of stream) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // user stopped — keep partial response
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Sorry, something went wrong. Please try again.",
                }
              : m,
          ),
        );
      }
    } finally {
      setIsLoading(false);
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
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex w-full text-primary justify-between items-center px-3 h-8 shrink-0">
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
        {messages.length === 0 ? (
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
          <div className="p-3 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "flex-row-reverse" : "",
                )}
              >
                {msg.role !== "user" && (
                  <img
                    src="/Chat.svg"
                    alt="Flux AI"
                    className="size-6 shrink-0 mt-0.5"
                  />
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-xs max-w-[88%]",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose-xs leading-relaxed space-y-1.5">
                      {msg.content
                        ? renderMarkdown(msg.content)
                        : isLoading && (
                            <div className="flex gap-1 py-1">
                              <span
                                className="size-1.5 bg-foreground/40 rounded-full animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              />
                              <span
                                className="size-1.5 bg-foreground/40 rounded-full animate-bounce"
                                style={{ animationDelay: "150ms" }}
                              />
                              <span
                                className="size-1.5 bg-foreground/40 rounded-full animate-bounce"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                          )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input — matches chatAi.tsx style */}
      <div className="p-3 border-t border-border">
        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-shadow duration-300 focus-within:shadow-md focus-within:border-primary/30">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="border-none shadow-none focus-visible:ring-0 resize-none min-h-11 max-h-40 px-4 py-3 text-xs placeholder:text-muted-foreground/50 "
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
