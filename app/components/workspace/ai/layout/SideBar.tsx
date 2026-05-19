import {
  Search,
  SquarePen,
  Trash2,
  MessageSquare,
  Pencil,
  Check,
  X,
  FolderOpen,
  ChevronDown,
} from "lucide-react";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useId,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router";
import { cn } from "~/lib/utils";
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
import { useWorkspaceProjects, useWorkspace } from "~/query/workspace";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(updatedAt: string): string {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return "now";
  if (h < 24) return `${Math.floor(h)}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
}

type ProjectGroup = { projectId: string | null; chats: ChatSession[] };

function groupByProject(chats: ChatSession[]): ProjectGroup[] {
  const map = new Map<string | null, ChatSession[]>();
  for (const c of chats) {
    const k = c.projectId ?? null;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  const result: ProjectGroup[] = [];
  for (const [pid, cs] of map)
    if (pid !== null) result.push({ projectId: pid, chats: cs });
  result.sort(
    (a, b) =>
      new Date(b.chats[0].updatedAt).getTime() -
      new Date(a.chats[0].updatedAt).getTime(),
  );
  const noproj = map.get(null);
  if (noproj?.length) result.push({ projectId: null, chats: noproj });
  return result;
}

function loadSet(k: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(k) ?? "[]")); }
  catch { return new Set(); }
}
function saveSet(k: string, s: Set<string>) {
  localStorage.setItem(k, JSON.stringify([...s]));
}

// ── Color palette for projects ────────────────────────────────────────────────
// Cycles through distinct hues for visual separation
const PROJECT_COLORS = [
  { dot: "#3370ff", bg: "#eef2ff", text: "#3370ff", border: "#c7d7fd" },
  { dot: "#f97802", bg: "#fff4eb", text: "#c45e00", border: "#fdd5a8" },
  { dot: "#1e8e3e", bg: "#e8f5ec", text: "#1e8e3e", border: "#a8d5b5" },
  { dot: "#9333ea", bg: "#f5f0ff", text: "#7e22ce", border: "#d8b4fe" },
  { dot: "#d93025", bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5" },
  { dot: "#0097a7", bg: "#e0f7fa", text: "#00838f", border: "#80deea" },
];

function projectColor(idx: number) {
  return PROJECT_COLORS[idx % PROJECT_COLORS.length];
}

const SHOW_MORE = 5;

// ── Main SideBar ──────────────────────────────────────────────────────────────

export default function SideBar() {
  const navigate = useNavigate();
  const { workspaceId, chatId } = useParams();
  const location = useLocation();
  const uid = useId();

  const [search, setSearch] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => loadSet("flux-ai-collapsed-projects"),
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { workspace } = useWorkspace(workspaceId ?? "");
  const { projects } = useWorkspaceProjects(workspaceId ?? "");
  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p._id, p.name);
    return m;
  }, [projects]);

  // Build stable project→colorIndex map
  const projectColorMap = useMemo(() => {
    const m = new Map<string, number>();
    projects.forEach((p: any, i: number) => m.set(p._id, i));
    return m;
  }, [projects]);

  const fetchChats = useCallback(() => {
    if (!workspaceId) return;
    listChatSessions(workspaceId).then(setChats).catch(console.error);
  }, [workspaceId]);

  useEffect(() => { fetchChats(); }, [fetchChats, chatId]);

  const newChat = () =>
    navigate(`/${workspaceId}/ai`, {
      state: { newChatKey: Date.now(), prevPath: location.pathname },
    });

  const deleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteChatSession(id).catch(console.error);
    setChats(p => p.filter(c => c._id !== id));
    if (chatId === id) navigate(`/${workspaceId}/ai`);
  };

  const startRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setRenamingId(chat._id);
    setRenameValue(chat.title);
  };

  const commitRename = async (id: string) => {
    const t = renameValue.trim();
    if (t) {
      await renameChatSession(id, t).catch(console.error);
      setChats(p => p.map(c => c._id === id ? { ...c, title: t } : c));
    }
    setRenamingId(null);
  };

  const toggleGroup = (k: string) =>
    setCollapsedGroups(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      saveSet("flux-ai-collapsed-projects", n);
      return n;
    });

  const toggleMore = (k: string) =>
    setExpandedGroups(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return chats.filter(
      c => c.title.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q)),
    );
  }, [chats, search]);

  const groups = useMemo(() => groupByProject(filtered), [filtered]);

  // ── Expanded sidebar ─────────────────────────────────────────────────────
  return (
    <motion.aside
      initial={false}
      animate={{ width: 280 }}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className="relative h-full flex flex-col bg-white border-r border-[#dadce0]/50 overflow-hidden shrink-0"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#dadce0]/60">
        <span className="text-lg font-semibold text-[#202222] select-none">
          Flux AI
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={newChat}
                className="flex items-center justify-center size-8 rounded-lg bg-[#3370ff] text-white hover:bg-[#2b5ee0] transition-colors shadow-sm"
                aria-label="New chat"
              >
                <SquarePen className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-[#dadce0]/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#9aa0a6]" />
          <input
            type="text"
            placeholder="Search chats…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md bg-[#eeeeee]/60 border border-transparent focus:border-[#3370ff]/40 focus:bg-white focus:outline-none transition-all placeholder:text-[#9aa0a6]"
          />
        </div>
      </div>

      {/* ── Chat list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="size-10 rounded-xl bg-[#e6eeff] flex items-center justify-center mb-3">
              <MessageSquare className="size-5 text-[#3370ff]" />
            </div>
            <p className="text-[12px] font-medium text-[#202222] mb-1">
              {search ? "No results" : "No chats yet"}
            </p>
            <p className="text-[11px] text-[#5f6368]">
              {search ? "Try a different keyword" : "Start a conversation"}
            </p>
            {!search && (
              <button
                onClick={newChat}
                className="mt-3 text-[12px] font-semibold text-[#3370ff] hover:text-[#2b5ee0] transition-colors"
              >
                + New chat
              </button>
            )}
          </div>
        ) : (
          <LayoutGroup id={`ai-${uid}`}>
            {groups.map((group, gIdx) => {
              const gKey = group.projectId ?? "__no_project__";
              const isGroupCollapsed = collapsedGroups.has(gKey);
              const isExpanded = expandedGroups.has(gKey);
              const visible = !isExpanded && group.chats.length > SHOW_MORE
                ? group.chats.slice(0, SHOW_MORE)
                : group.chats;
              const hasMore = group.chats.length > SHOW_MORE;
              const isProject = group.projectId !== null;
              const colorIdx = isProject
                ? (projectColorMap.get(group.projectId!) ?? gIdx)
                : -1;
              const color = isProject ? projectColor(colorIdx) : null;

              return (
                <div key={gKey} className="mb-1">
                  {/* ── Section header ───────────────────────────────── */}
                  <button
                    onClick={() => toggleGroup(gKey)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 pt-4 pb-1 mx-0 text-left transition-colors group",
                    )}
                  >
                    {isProject && (
                      <FolderOpen className="size-4 shrink-0 transition-transform group-hover:scale-105" style={{ color: color?.dot }} />
                    )}

                    <span
                      className="text-[12px] font-bold uppercase tracking-wide flex-1 truncate transition-colors"
                      style={isProject && color ? { color: color.text } : { color: "#9aa0a6" }}
                    >
                      {!isProject
                        ? (workspace?.name || "Workspace")
                        : (projectNameMap.get(group.projectId!) ?? group.projectId)}
                    </span>

                    <span className="text-[10px] text-[#9aa0a6] shrink-0 mr-1 tabular-nums">
                      {group.chats.length}
                    </span>

                    <motion.div
                      animate={{ rotate: isGroupCollapsed ? -90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="size-3.5 text-[#9aa0a6] group-hover:text-[#5f6368]" />
                    </motion.div>
                  </button>


                  {/* ── Chat items ───────────────────────────────────── */}
                  <AnimatePresence initial={false}>
                    {!isGroupCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        {visible.map((chat, i) => (
                          <motion.div
                            key={chat._id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.18 }}
                          >
                            <ChatItem
                              chat={chat}
                              isActive={chatId === chat._id}
                              isRenaming={renamingId === chat._id}
                              renameValue={renameValue}
                              onRenameChange={setRenameValue}
                              onSelect={() => navigate(`/${workspaceId}/ai/${chat._id}`)}
                              onDelete={e => deleteChat(e, chat._id)}
                              onStartRename={e => startRename(e, chat)}
                              onCommitRename={() => commitRename(chat._id)}
                              onCancelRename={() => setRenamingId(null)}
                              accentColor={color?.dot}
                              accentBg={color?.bg}
                            />
                          </motion.div>
                        ))}

                        {hasMore && (
                          <button
                            onClick={() => toggleMore(gKey)}
                            className="w-full text-left text-[11px] font-medium px-5 py-1.5 transition-colors"
                            style={{ color: color?.text ?? "#3370ff" }}
                          >
                            {isExpanded ? "Show less" : `+${group.chats.length - SHOW_MORE} more`}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </LayoutGroup>
        )}
      </div>
    </motion.aside>
  );
}

// ── Chat Item ─────────────────────────────────────────────────────────────────

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
  accentColor,
  accentBg,
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
  accentColor?: string;
  accentBg?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isRenaming) inputRef.current?.focus(); }, [isRenaming]);

  const activeColor = accentColor ?? "#3370ff";
  const activeBg = accentBg ?? "#e6eeff";

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 pl-3 pr-16 py-1.5 mx-2 rounded-md cursor-pointer transition-colors duration-150 mb-0.5",
        isActive ? "text-[#202222]" : "text-[#5f6368] hover:bg-[#eeeeee]/80 hover:text-[#202222]",
      )}
      style={isActive ? { backgroundColor: activeBg } : {}}
      onClick={!isRenaming ? onSelect : undefined}
    >
      {/* Active indicator — left bar */}
      {/* Content */}
      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
            }}
            onClick={e => e.stopPropagation()}
            className="w-full text-[13px] bg-transparent border-0 border-b-2 border-[#3370ff] focus:outline-none text-[#202222]"
          />
        ) : (
          <div className="min-w-0">
            <p
              className={cn(
                "text-[13px] truncate leading-snug",
                isActive ? "font-semibold" : "font-normal",
              )}
              style={isActive ? { color: activeColor } : {}}
            >
              {chat.title}
            </p>
          </div>
        )}
      </div>

      {!isRenaming && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#9aa0a6] group-hover:opacity-0 transition-opacity tabular-nums">
          {relativeTime(chat.updatedAt)}
        </span>
      )}

      {/* Actions — appear on hover */}
      {isRenaming ? (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onCommitRename(); }}
            className="p-1 rounded-md hover:bg-emerald-100 text-emerald-600 transition-colors"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onCancelRename(); }}
            className="p-1 rounded-md hover:bg-[#f1f3f4] text-[#5f6368] transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={onStartRename}
            className="p-1 rounded-md text-[#9aa0a6] hover:text-[#3370ff] hover:bg-[#e6eeff] transition-colors"
            title="Rename"
          >
            <Pencil className="size-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-md text-[#9aa0a6] hover:text-[#d93025] hover:bg-[#fef2f2] transition-colors"
            title="Delete"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
