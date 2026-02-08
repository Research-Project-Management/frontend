import { useNavigate, useParams } from "react-router";
import ChatAi from "../chatAi";
import { useState, useRef, useEffect } from "react";
import { User, Bot } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: { title: string; page: number }[];
};

// Mock messages - replace with actual data
const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Hello! Can you help me with my project?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    role: "assistant",
    content:
      "Of course! I'd be happy to help you with your project. What specifically would you like assistance with?",
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
  },
];

export default function ChatAiDetail() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="shrink-0 size-8 rounded-full flex items-center justify-center bg-purple-100">
                <Bot className="size-4 text-purple-600" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Sources:
                  </p>
                  <div className="space-y-1">
                    {message.sources.map((source, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        <span className="font-mono bg-background/50 px-1.5 py-0.5 rounded">
                          [{idx + 1}]
                        </span>{" "}
                        {source.title} (p. {source.page})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs opacity-70">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>

            {message.role === "user" && (
              <div className="shrink-0 size-8 rounded-full bg-primary flex items-center justify-center">
                <User className="size-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t bg-card p-4">
        <ChatAi />
      </div>
    </div>
  );
}
