import {
  Check,
  MessageSquare,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import {
  deleteChatSession,
  listChatSessions,
  renameChatSession,
} from "~/query/chat-ai";
import type { ChatSession } from "~/types/chat";

type TimeGroup = "today" | "week" | "month" | "older";

const GROUP_LABELS: Record<TimeGroup, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  older: "Older",
};

const PINNED_STORAGE_KEY = "flux-ai-pinned-chats";

function timeGroup(updatedAt: string): TimeGroup {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const hours = diff / 3_600_000;
  if (hours < 24) return "today";
  if (hours < 24 * 7) return "week";
  if (hours < 24 * 30) return "month";
  return "older";
}

function groupChats(chats: ChatSession[]) {
  const groups: Record<TimeGroup, ChatSession[]> = {
    today: [],
    week: [],
    month: [],
    older: [],
  };
  for (const chat of chats) groups[timeGroup(chat.updatedAt)].push(chat);
  return groups;
}

function getPinnedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(PINNED_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function savePinnedIds(ids: Set<string>) {
  localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...ids]));
}

interface ChatHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string | null;
  activeChatId?: string | null;
  onSelectChat?: (chat: ChatSession) => void;
  title?: string;
  description?: string;
}

export default function ChatHistoryModal({
  open,
  onOpenChange,
  workspaceId: workspaceIdProp,
  activeChatId,
  onSelectChat,
  title = "Chat History",
  description = "Find, rename, pin, or delete previous Flux AI conversations.",
}: ChatHistoryModalProps) {
  const navigate = useNavigate();
  const params = useParams();
  const workspaceId = workspaceIdProp ?? params.workspaceId;
  const currentChatId = activeChatId ?? params.chatId ?? null;

  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(getPinnedIds);

  const fetchChats = useCallback(() => {
    if (!workspaceId) return;
    setIsLoading(true);
    listChatSessions(workspaceId)
      .then(setChats)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    if (open) fetchChats();
  }, [fetchChats, open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return chats.filter(
      (chat) =>
        chat.title.toLowerCase().includes(q) ||
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(q)),
    );
  }, [chats, search]);

  const pinned = useMemo(
    () => filtered.filter((chat) => pinnedIds.has(chat._id)),
    [filtered, pinnedIds],
  );
  const unpinned = useMemo(
    () => filtered.filter((chat) => !pinnedIds.has(chat._id)),
    [filtered, pinnedIds],
  );
  const groups = useMemo(() => groupChats(unpinned), [unpinned]);

  const handleSelect = (chat: ChatSession) => {
    if (onSelectChat) {
      onSelectChat(chat);
      onOpenChange(false);
      return;
    }
    if (!workspaceId) return;
    onOpenChange(false);
    navigate(`/${workspaceId}/ai/${chat._id}`);
  };

  const handleDelete = async (id: string) => {
    await deleteChatSession(id).catch(console.error);
    setChats((prev) => prev.filter((chat) => chat._id !== id));
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      savePinnedIds(next);
      return next;
    });
    if (currentChatId === id && workspaceId) {
      navigate(`/${workspaceId}/ai`);
    }
  };

  const startRename = (chat: ChatSession) => {
    setRenamingId(chat._id);
    setRenameValue(chat.title);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      await renameChatSession(id, trimmed).catch(console.error);
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === id ? { ...chat, title: trimmed } : chat,
        ),
      );
    }
    setRenamingId(null);
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePinnedIds(next);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pb-3 pt-5 border-b border-border/60">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded-md border border-border/60 bg-secondary/30 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/40"
            />
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="flex gap-1">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="size-2 rounded-full bg-primary/40"
                    style={{
                      animation: "typing-dot 1.4s infinite ease-in-out",
                      animationDelay: `${index * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <MessageSquare className="mb-3 size-8 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground">
                {search ? "No chats match your search" : "No conversations yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pinned.length > 0 && (
                <ChatGroup
                  label="Pinned"
                  chats={pinned}
                  pinnedIds={pinnedIds}
                  currentChatId={currentChatId}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onRenameChange={setRenameValue}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onStartRename={startRename}
                  onCommitRename={commitRename}
                  onCancelRename={() => setRenamingId(null)}
                  onTogglePin={togglePin}
                />
              )}

              {(["today", "week", "month", "older"] as TimeGroup[]).map(
                (key) => {
                  const group = groups[key];
                  if (!group.length) return null;
                  return (
                    <ChatGroup
                      key={key}
                      label={GROUP_LABELS[key]}
                      chats={group}
                      pinnedIds={pinnedIds}
                      currentChatId={currentChatId}
                      renamingId={renamingId}
                      renameValue={renameValue}
                      onRenameChange={setRenameValue}
                      onSelect={handleSelect}
                      onDelete={handleDelete}
                      onStartRename={startRename}
                      onCommitRename={commitRename}
                      onCancelRename={() => setRenamingId(null)}
                      onTogglePin={togglePin}
                    />
                  );
                },
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChatGroup({
  label,
  chats,
  pinnedIds,
  currentChatId,
  renamingId,
  renameValue,
  onRenameChange,
  onSelect,
  onDelete,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onTogglePin,
}: {
  label: string;
  chats: ChatSession[];
  pinnedIds: Set<string>;
  currentChatId: string | null;
  renamingId: string | null;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onSelect: (chat: ChatSession) => void;
  onDelete: (id: string) => void;
  onStartRename: (chat: ChatSession) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <section>
      <p className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label === "Pinned" && <Pin className="size-3" />}
        {label}
      </p>
      <div className="space-y-1">
        {chats.map((chat) => (
          <ChatHistoryItem
            key={chat._id}
            chat={chat}
            isActive={currentChatId === chat._id}
            isPinned={pinnedIds.has(chat._id)}
            isRenaming={renamingId === chat._id}
            renameValue={renameValue}
            onRenameChange={onRenameChange}
            onSelect={() => onSelect(chat)}
            onDelete={() => onDelete(chat._id)}
            onStartRename={() => onStartRename(chat)}
            onCommitRename={() => onCommitRename(chat._id)}
            onCancelRename={onCancelRename}
            onTogglePin={() => onTogglePin(chat._id)}
          />
        ))}
      </div>
    </section>
  );
}

function ChatHistoryItem({
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
  onRenameChange: (value: string) => void;
  onSelect: () => void;
  onDelete: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onTogglePin: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-foreground/75 hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <button
        onClick={isRenaming ? undefined : onSelect}
        className="flex flex-1 items-center gap-2 min-w-0 text-left"
      >
        <MessageSquare className="size-4 shrink-0 opacity-60" />
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(event) => onRenameChange(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") onCommitRename();
                if (event.key === "Escape") onCancelRename();
              }}
              className="w-full border-0 border-b border-primary/50 bg-transparent py-0 text-sm text-foreground outline-none"
            />
          ) : (
            <>
              <p className="truncate text-sm font-medium leading-snug">
                {chat.title}
              </p>
              {chat.lastMessage && (
                <p className="mt-0.5 truncate text-[11px] leading-snug text-muted-foreground/60">
                  {chat.lastMessage}
                </p>
              )}
            </>
          )}
        </div>
      </button>

      {isRenaming ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={onCommitRename}
            className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={onCancelRename}
            className="rounded p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onTogglePin}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={isPinned ? "Unpin" : "Pin"}
          >
            {isPinned ? (
              <PinOff className="size-3.5" />
            ) : (
              <Pin className="size-3.5" />
            )}
          </button>
          <button
            onClick={onStartRename}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Rename"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
