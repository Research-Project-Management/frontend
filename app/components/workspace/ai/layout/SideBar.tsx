import { Brain, Search, Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router";

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
];

export default function SideBar() {
  const navigate = useNavigate();
  const { workspaceId, chatId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = MOCK_CHATS.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleNewChat = () => {
    // Navigate to root AI page where user can choose mode or start fresh
    navigate(`/workspace/${workspaceId}/ai`);
  };

  return (
    <aside className="w-60 border-r border-border h-full bg-background p-3 overflow-x-hidden flex flex-col gap-4">
      {/* New Chat Button */}
      <Button
        onClick={handleNewChat}
        className="w-full justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl"
      >
        <Plus className="size-4" />
        <span className="text-[11px] font-bold uppercase tracking-widest">
          New Chat
        </span>
      </Button>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="SEARCH HISTORY..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-[10px] font-bold bg-secondary/30 border-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/20 uppercase tracking-tight"
        />
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-6 no-scrollbar">
        {/* Wiki Mode History */}
        {filteredChats.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Brain className="size-3 text-primary/40" />
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Chat History
              </h3>
            </div>
            <div className="space-y-2">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() =>
                    navigate(`/workspace/${workspaceId}/ai/${chat.id}`)
                  }
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 group cursor-pointer border border-transparent bg-origin-border ${
                    chatId === chat.id
                      ? "[background:linear-gradient(#fefce8,#fefce8)_padding-box,linear-gradient(to_right,#f3df00,transparent)_border-box] shadow-sm shadow-yellow-500/5"
                      : "hover:bg-[#fefce8]/80 [background:linear-gradient(#fefce8,#fefce8)_padding-box,linear-gradient(to_right,#f3df00,transparent)_border-box] opacity-80 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-bold truncate ${chatId === chat.id ? "text-primary" : "text-foreground/80"}`}
                      >
                        {chat.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-medium">
                        {chat.lastMessage}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No chats yet</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
