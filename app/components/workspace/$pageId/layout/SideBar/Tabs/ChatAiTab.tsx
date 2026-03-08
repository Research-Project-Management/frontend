import React, { useState, useRef } from "react";
import { Send, Sparkles, Loader2, User, Bot, Trash2 } from "lucide-react";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

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

export default function ChatAiTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Mock AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I can help you with that! Here's my suggestion for improving your LaTeX document...",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex w-full text-primary justify-between items-center px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span className="font-semibold">Ask AI</span>
        </div>
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full p-3">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Sparkles className="size-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-primary">AI Assistant</p>
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
                  msg.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center flex-shrink-0",
                    msg.role === "user" ? "bg-primary" : "bg-muted"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="size-3 text-primary-foreground" />
                  ) : (
                   <img src="/Chat.svg" alt="flux-ai" />
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs max-w-[85%]",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="size-6 rounded-full bg-muted flex items-center justify-center">
                 <img src="/Chat.svg" alt="flux-ai" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-muted">
                  <div className="flex gap-1">
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
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI..."
            disabled={isLoading}
            className="min-h-[60px] max-h-[120px] pr-10 text-sm resize-none"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
