import {
  Search,
  Plus,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Check,
  X,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { ChatSession } from "~/types/chat";
import {
  listChatSessions,
  deleteChatSession,
  renameChatSession,
} from "~/query/chat-ai";

function timeGroup(updatedAt: string): "today" | "week" | "month" | "older" {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const h = diff / 3_600_000;
  if (h < 24) return "today";
  if (h < 24 * 7) return "week";
  if (h < 24 * 30) return "month";
  return "older";
}

const GROUP_LABELS = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  older: "Older",
} as const;

function groupChats(chats: ChatSession[]) {
  const groups: Record<string, ChatSession[]> = {
    today: [],
    week: [],
    month: [],
    older: [],
  };
  for (const c of chats) groups[timeGroup(c.updatedAt)].push(c);
  return groups;
}

export default function SideBar() {
  const navigate = useNavigate();
  const { workspaceId, chatId } = useParams();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const fetchChats = useCallback(() => {
    if (!workspaceId) return;
    listChatSessions(workspaceId).then(setChats).catch(console.error);
  }, [workspaceId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, chatId]);

  // Pass a unique newChatKey so ChatView resets its state even if
  // the URL doesn't change (user is already at /ai with stale messages)
  const handleNewChat = () =>
    navigate(`/${workspaceId}/ai`, {
      state: { newChatKey: Date.now(), prevPath: location.pathname },
    });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteChatSession(id).catch(console.error);
    setChats((p) => p.filter((c) => c._id !== id));
    if (chatId === id) navigate(`/${workspaceId}/ai`);
  };

  const startRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setRenamingId(chat._id);
    setRenameValue(chat.title);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      await renameChatSession(id, trimmed).catch(console.error);
      setChats((p) =>
        p.map((c) => (c._id === id ? { ...c, title: trimmed } : c)),
      );
    }
    setRenamingId(null);
  };

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );
  const groups = groupChats(filtered);

  return (
    <aside
      className={`relative h-full flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-12" : "w-64"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-3 border-b border-sidebar-border ${collapsed ? "justify-center" : "justify-between"}`}
      >
        {!collapsed && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Chats
          </span>
        )}
        <div
          className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleNewChat}
                className="flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Plus className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "bottom"}>
              New chat
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "bottom"}>
              {collapsed ? "Expand" : "Collapse"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary/50 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 no-scrollbar">
        {collapsed ? (
          <div className="flex flex-col gap-0.5 px-1.5 pt-1">
            {chats.map((chat) => (
              <Tooltip key={chat._id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(`/${workspaceId}/ai/${chat._id}`)}
                    className={`w-full h-9 flex items-center justify-center rounded-lg transition-colors ${
                      chatId === chat._id
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-52">
                  <p className="font-medium text-xs">{chat.title}</p>
                  {chat.lastMessage && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                      {chat.lastMessage}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare className="size-8 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground/60">
              {search ? "No chats match your search" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {(["today", "week", "month", "older"] as const).map((key) => {
              const group = groups[key];
              if (!group.length) return null;
              return (
                <div key={key} className="mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-4 py-1.5">
                    {GROUP_LABELS[key]}
                  </p>
                  {group.map((chat) => (
                    <ChatItem
                      key={chat._id}
                      chat={chat}
                      isActive={chatId === chat._id}
                      isRenaming={renamingId === chat._id}
                      renameValue={renameValue}
                      onRenameChange={setRenameValue}
                      onSelect={() =>
                        navigate(`/${workspaceId}/ai/${chat._id}`)
                      }
                      onDelete={(e) => handleDelete(e, chat._id)}
                      onStartRename={(e) => startRename(e, chat)}
                      onCommitRename={() => commitRename(chat._id)}
                      onCancelRename={() => setRenamingId(null)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function ChatItem({
  chat,
  isActive,
  isRenaming,
  renameValue,
  onRenameChange,
  onSelect,
  onDelete,
  onStartRename,
  onCommitRename,
  onCancelRename,
}: {
  chat: ChatSession;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStartRename: (e: React.MouseEvent) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  return (
    <div
      className={`group relative flex items-center gap-1 px-3 py-2 mx-1.5 rounded-lg cursor-pointer transition-all duration-100 ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-foreground/70 hover:bg-secondary/60 hover:text-foreground"
      }`}
      onClick={!isRenaming ? onSelect : undefined}
    >
      {/* Active bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
      )}

      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs bg-transparent border-0 border-b border-primary/50 focus:outline-none py-0 text-foreground"
          />
        ) : (
          <>
            <p className="text-xs font-medium truncate leading-snug">
              {chat.title}
            </p>
            {chat.lastMessage && (
              <p className="text-[10px] text-muted-foreground/50 truncate leading-snug mt-0.5">
                {chat.lastMessage}
              </p>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      {isRenaming ? (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCommitRename();
            }}
            className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500"
          >
            <Check className="size-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancelRename();
            }}
            className="p-1 rounded hover:bg-secondary"
          >
            <X className="size-3 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onStartRename}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
