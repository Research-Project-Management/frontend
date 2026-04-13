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
  Pin,
  PinOff,
  Sparkles,
} from "lucide-react";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
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

// ── Time grouping ───────────────────────────────────────────────────────────────

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

// ── Pinned chats storage ────────────────────────────────────────────────────────

function getPinnedIds(): Set<string> {
  try {
    const stored = localStorage.getItem("flux-ai-pinned-chats");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function savePinnedIds(ids: Set<string>) {
  localStorage.setItem("flux-ai-pinned-chats", JSON.stringify([...ids]));
}

// ── Main SideBar ────────────────────────────────────────────────────────────────

export default function SideBar() {
  const navigate = useNavigate();
  const { workspaceId, chatId } = useParams();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(getPinnedIds);

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
    // Clean from pinned
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      savePinnedIds(next);
      return next;
    });
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

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePinnedIds(next);
      return next;
    });
  };

  // Filter + group
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)),
    );
  }, [chats, search]);

  const pinned = useMemo(
    () => filtered.filter((c) => pinnedIds.has(c._id)),
    [filtered, pinnedIds],
  );
  const unpinned = useMemo(
    () => filtered.filter((c) => !pinnedIds.has(c._id)),
    [filtered, pinnedIds],
  );
  const groups = useMemo(() => groupChats(unpinned), [unpinned]);

  return (
    <aside
      className={`relative h-full flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-12" : "w-64"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-3 ${collapsed ? "justify-center" : "justify-between"}`}
      >
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground/80 tracking-tight">
              History
            </span>
          </div>
        )}
        <div
          className={`flex items-center gap-0.5 ${collapsed ? "flex-col" : ""}`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleNewChat}
                className={`flex items-center justify-center rounded-lg text-primary-foreground transition-all ${
                  collapsed
                    ? "size-8 bg-primary hover:bg-primary/90"
                    : "size-7 bg-primary hover:bg-primary/90"
                }`}
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
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search chats…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-secondary/50 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40 transition-colors"
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
            {/* Pinned section */}
            {pinned.length > 0 && (
              <div className="mb-1">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-4 py-1.5 flex items-center gap-1">
                  <Pin className="size-2.5" />
                  Pinned
                </p>
                {pinned.map((chat) => (
                  <ChatItem
                    key={chat._id}
                    chat={chat}
                    isActive={chatId === chat._id}
                    isPinned
                    isRenaming={renamingId === chat._id}
                    renameValue={renameValue}
                    onRenameChange={setRenameValue}
                    onSelect={() => navigate(`/${workspaceId}/ai/${chat._id}`)}
                    onDelete={(e) => handleDelete(e, chat._id)}
                    onStartRename={(e) => startRename(e, chat)}
                    onCommitRename={() => commitRename(chat._id)}
                    onCancelRename={() => setRenamingId(null)}
                    onTogglePin={(e) => togglePin(e, chat._id)}
                  />
                ))}
              </div>
            )}

            {/* Time-grouped sections */}
            {(["today", "week", "month", "older"] as const).map((key) => {
              const group = groups[key];
              if (!group.length) return null;
              return (
                <div key={key} className="mb-1">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider px-4 py-1.5">
                    {GROUP_LABELS[key]}
                  </p>
                  {group.map((chat) => (
                    <ChatItem
                      key={chat._id}
                      chat={chat}
                      isActive={chatId === chat._id}
                      isPinned={false}
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
                      onTogglePin={(e) => togglePin(e, chat._id)}
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

// ── Chat Item ───────────────────────────────────────────────────────────────────

function ChatItem({
  chat,
  isActive,
  isPinned,
  isRenaming,
  renameValue,
  onRenameChange,
  onSelect,
  onDelete,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onTogglePin,
}: {
  chat: ChatSession;
  isActive: boolean;
  isPinned: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStartRename: (e: React.MouseEvent) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-2 mx-1.5 rounded-lg cursor-pointer transition-all duration-100 ${
        isActive
          ? "bg-[#3370ff]/10 text-[#3370ff] dark:bg-[#3370ff]/15"
          : "text-foreground/70 hover:bg-secondary/60 hover:text-foreground"
      }`}
      onClick={!isRenaming ? onSelect : undefined}
    >
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
            onClick={onTogglePin}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title={isPinned ? "Unpin" : "Pin"}
          >
            {isPinned ? (
              <PinOff className="size-3" />
            ) : (
              <Pin className="size-3" />
            )}
          </button>
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
