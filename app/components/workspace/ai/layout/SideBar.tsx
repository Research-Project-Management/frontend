import {
  Brain,
  Search,
  Plus,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type ChatSession = {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
};

// Mock data - replace with actual data from API/store
const MOCK_CHATS: ChatSession[] = [
  {
    id: "1",
    title: "Project Setup Help",
    lastMessage: "How do I configure the database?",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "2",
    title: "Documentation Q&A",
    lastMessage: "What are the API endpoints?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "3",
    title: "Code Review Session",
    lastMessage: "Can you review this component?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26),
  },
  {
    id: "4",
    title: "Bug Investigation",
    lastMessage: "Getting a null pointer error",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50),
  },
];

function groupChatsByDate(chats: ChatSession[]) {
  const now = new Date();
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const older: ChatSession[] = [];

  chats.forEach((chat) => {
    const diff = now.getTime() - chat.timestamp.getTime();
    const hours = diff / 3600000;
    if (hours < 24) today.push(chat);
    else if (hours < 48) yesterday.push(chat);
    else older.push(chat);
  });

  return { today, yesterday, older };
}

export default function SideBar() {
  const navigate = useNavigate();
  const { workspaceId, chatId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const filteredChats = MOCK_CHATS.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const grouped = groupChatsByDate(filteredChats);

  const handleNewChat = () => {
    navigate(`/workspace/${workspaceId}/ai`);
  };

  return (
    <aside
      className={`relative h-full border-r border-border bg-background flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      {/* Top section */}
      <div className="flex flex-col gap-2 p-2 border-b border-border/60">
        {/* New Chat */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleNewChat}
                size="icon"
                className="w-full h-9 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                variant="ghost"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            onClick={handleNewChat}
            variant="ghost"
            className="w-full justify-start gap-2.5 h-9 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3"
          >
            <Plus className="size-4 shrink-0" />
            <span className="text-xs font-semibold">New Chat</span>
          </Button>
        )}

        {/* Search — only in expanded */}
        {!collapsed && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-secondary/40 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
            />
          </div>
        )}
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 no-scrollbar">
        {collapsed ? (
          /* Icon-only rail when collapsed */
          <div className="flex flex-col gap-1 px-2">
            {MOCK_CHATS.map((chat) => (
              <Tooltip key={chat.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() =>
                      navigate(`/workspace/${workspaceId}/ai/${chat.id}`)
                    }
                    className={`w-full h-9 flex items-center justify-center rounded-lg transition-colors ${
                      chatId === chat.id
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-48">
                  <p className="font-medium text-xs">{chat.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {chat.lastMessage}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center mb-3">
              <Brain className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              No chats found
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Start a new conversation
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-2">
            <ChatGroup
              label="Today"
              chats={grouped.today}
              chatId={chatId}
              workspaceId={workspaceId}
              navigate={navigate}
            />
            <ChatGroup
              label="Yesterday"
              chats={grouped.yesterday}
              chatId={chatId}
              workspaceId={workspaceId}
              navigate={navigate}
            />
            <ChatGroup
              label="Older"
              chats={grouped.older}
              chatId={chatId}
              workspaceId={workspaceId}
              navigate={navigate}
            />
          </div>
        )}
      </div>

      {/* Bottom collapse toggle */}
      <div className="p-2 border-t border-border/60">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCollapsed((v) => !v)}
              className={`flex items-center gap-2 h-8 w-full rounded-lg px-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${collapsed ? "justify-center" : ""}`}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4 shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="size-4 shrink-0" />
                  <span className="text-xs font-medium">Collapse</span>
                </>
              )}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}

function ChatGroup({
  label,
  chats,
  chatId,
  workspaceId,
  navigate,
}: {
  label: string;
  chats: ChatSession[];
  chatId?: string;
  workspaceId?: string;
  navigate: (path: string) => void;
}) {
  if (chats.length === 0) return null;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Clock className="size-3 text-muted-foreground/40" />
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          {label}
        </span>
      </div>
      {chats.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isActive={chatId === chat.id}
          onSelect={() => navigate(`/workspace/${workspaceId}/ai/${chat.id}`)}
        />
      ))}
    </div>
  );
}

function ChatItem({
  chat,
  isActive,
  onSelect,
}: {
  chat: ChatSession;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all duration-150 group relative ${
        isActive
          ? "bg-primary/12 text-primary"
          : "text-foreground/70 hover:bg-secondary/70 hover:text-foreground"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
      )}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium truncate leading-snug ${
              isActive ? "text-primary" : ""
            }`}
          >
            {chat.title}
          </p>
          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5 leading-snug">
            {chat.lastMessage}
          </p>
        </div>
        <button
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0 p-0.5 rounded hover:bg-destructive/10"
        >
          <X className="size-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </button>
  );
}
