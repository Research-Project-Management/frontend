'use client';

import {
  Search,
  SquarePen,
  Trash2,
  MessageSquare,
  Pencil,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useId,
} from 'react';
import { LayoutGroup } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/utils";
import { getErrorMessage } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import type { ChatSession } from '../../types/chat.types';
import {
  listChatSessions,
  deleteChatSession,
  renameChatSession,
  clearAiMemory,
} from '../../services/chat.service';
import { useWorkspaceProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { toast } from 'sonner';

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
  if (typeof window === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(k) ?? '[]');
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    return new Set();
  } catch (err) {
    logger.debug('[AiSidebar] Failed to parse collapsed projects from localStorage', { key: k, err });
    return new Set();
  }
}
function saveSet(k: string, s: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(k, JSON.stringify(Array.from(s)));
  } catch (err) {
    logger.debug('[AiSidebar] Failed to save collapsed projects to localStorage', { key: k, err });
  }
}

export function Sidebar() {
  const { workspaceId, chatId } = useParams<{ workspaceId?: string; chatId?: string }>();
  const router = useRouter();
  const activeChatId = chatId ?? null;
  const layoutGroupId = useId();

  const { projects } = useWorkspaceProjects(workspaceId);

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedProjectId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => new Set());
  const [isClearingMemory, setIsClearingMemory] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      setCollapsedProjects(loadSet(`ai-sidebar-collapsed-${workspaceId}`));
    }
  }, [workspaceId]);

  const editInputRef = useRef<HTMLInputElement>(null);

  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) m.set(p.id, p.name);
    return m;
  }, [projects]);

  const loadSessions = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const list = await listChatSessions(workspaceId, selectedProjectId);
      setChats(list);
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleToggleCollapse = (pid: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      saveSet(`ai-sidebar-collapsed-${workspaceId}`, next);
      return next;
    });
  };

  const handleStartRename = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = async (chatIdToRename: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await renameChatSession(chatIdToRename, trimmed);
      setChats((prev) =>
        prev.map((c) => (c.id === chatIdToRename ? { ...c, title: trimmed } : c)),
      );
      toast.success('Chat renamed');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to rename chat');
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, targetChatId: string) => {
    e.stopPropagation();
    try {
      await deleteChatSession(targetChatId);
      setChats((prev) => prev.filter((c) => c.id !== targetChatId));
      toast.success('Chat deleted');
      if (activeChatId === targetChatId) {
        router.push(workspaceId ? `/${workspaceId}/ai` : `/ai`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete chat');
    }
  };

  const handleClearMemory = async () => {
    if (!workspaceId) return;
    if (!confirm('Clear all AI conversational memory for this workspace?')) return;
    try {
      setIsClearingMemory(true);
      await clearAiMemory(workspaceId);
      toast.success('AI memory cleared');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to clear AI memory');
    } finally {
      setIsClearingMemory(false);
    }
  };

  const filtered = useMemo(() => {
    let list = chats;
    if (selectedProjectId) {
      list = list.filter((c) => c.projectId === selectedProjectId);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q),
      );
    }
    return list;
  }, [chats, selectedProjectId, query]);

  const groups = useMemo(() => groupByProject(filtered), [filtered]);

  return (
    <aside className="w-60 shrink-0 h-full border-r border-border bg-sidebar flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-border flex items-center justify-between gap-2">
        <button
          onClick={() => router.push(workspaceId ? `/${workspaceId}/ai` : `/ai`)}
          className="flex-1 flex items-center justify-center gap-2 h-8 rounded-md border border-border bg-background hover:bg-muted text-foreground text-13 font-medium transition-colors shadow-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <SquarePen className="size-3.5 text-foreground shrink-0" />
          <span>New Chat</span>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClearMemory}
              disabled={isClearingMemory}
              className="size-8 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <RotateCcw className={`size-3.5 text-foreground shrink-0 ${isClearingMemory ? 'animate-spin' : ''}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Clear AI memory
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="p-2.5 border-b border-border">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-8 pl-8 pr-2.5 rounded-md bg-background border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors text-foreground"
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading history…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {query ? 'No chats match search' : 'No chat history'}
          </div>
        ) : (
          <LayoutGroup id={layoutGroupId}>
            {groups.map((grp) => {
              const pid = grp.projectId ?? '__none__';
              const pName = grp.projectId ? projectNameMap.get(grp.projectId) || 'Project' : 'General';
              const isCollapsed = collapsedProjects.has(pid);

              return (
                <div key={pid} className="space-y-1">
                  <button
                    onClick={() => handleToggleCollapse(pid)}
                    className="w-full flex items-center justify-between px-2 py-1 text-11 font-medium text-foreground cursor-pointer select-none transition-colors"
                  >
                    <span className="truncate">{pName}</span>
                    <ChevronDown
                      className={`size-3 text-muted-foreground transition-transform ${
                        isCollapsed ? '-rotate-90' : ''
                      } shrink-0`}
                    />
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-1">
                      {grp.chats.map((chat) => {
                        const isActive = activeChatId === chat.id;
                        const isEditing = editingId === chat.id;

                        return (
                          <div
                            key={chat.id}
                            onClick={() =>
                              router.push(workspaceId ? `/${workspaceId}/ai/${chat.id}` : `/ai/${chat.id}`)
                            }
                            className={cn(
                              'group relative flex h-8 items-center justify-between gap-2 px-2.5 rounded-md text-13 leading-5 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary',
                              isActive
                                ? 'bg-muted text-foreground font-medium'
                                : 'text-foreground hover:bg-muted font-normal',
                            )}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <MessageSquare className="size-4 shrink-0 text-foreground" />
                              {isEditing ? (
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(chat.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  onBlur={() => handleSaveRename(chat.id)}
                                  className="w-full bg-background px-1.5 py-0.5 text-xs rounded border border-primary focus:outline-none text-foreground"
                                />
                              ) : (
                                <span className="truncate tracking-tight">{chat.title || 'Untitled'}</span>
                              )}
                            </div>

                            {/* Actions on hover */}
                            {!isEditing && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => handleStartRename(e, chat)}
                                  className="p-1 rounded hover:bg-muted text-foreground cursor-pointer transition-colors"
                                  title="Rename"
                                >
                                  <Pencil className="size-3.5 text-foreground shrink-0" />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(e, chat.id)}
                                  className="p-1 rounded text-foreground hover:bg-destructive/10 cursor-pointer transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3.5 shrink-0" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </LayoutGroup>
        )}
      </div>
    </aside>
  );
}

// Backward compatibility alias
export const ChatSidebar = Sidebar;
export const FluxAiSidebar = Sidebar;
export default Sidebar;
