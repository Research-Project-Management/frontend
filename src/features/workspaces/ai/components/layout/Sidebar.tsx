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
import { cn } from '@/shared/lib/utils';
import { getErrorMessage } from '@/shared/utils/error.util';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui';
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
  try { return new Set(JSON.parse(localStorage.getItem(k) ?? '[]')); }
  catch { return new Set(); }
}
function saveSet(k: string, s: Set<string>) {
  localStorage.setItem(k, JSON.stringify(Array.from(s)));
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
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() =>
    loadSet(`ai-sidebar-collapsed-${workspaceId}`),
  );
  const [isClearingMemory, setIsClearingMemory] = useState(false);

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
      if (activeChatId === targetChatId && workspaceId) {
        router.push(`/${workspaceId}/ai`);
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
    <aside className="w-64 shrink-0 h-full border-r border-border/60 bg-sidebar flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2">
        <button
          onClick={() => workspaceId && router.push(`/${workspaceId}/ai`)}
          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-colors"
        >
          <SquarePen className="size-3.5" />
          <span>New Chat</span>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClearMemory}
              disabled={isClearingMemory}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <RotateCcw className={`size-3.5 ${isClearingMemory ? 'animate-spin' : ''}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Clear AI memory
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="p-2.5 space-y-2 border-b border-border/40">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-secondary/40 border border-border/40 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
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
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider hover:text-foreground transition-colors"
                  >
                    <span className="truncate">{pName}</span>
                    <ChevronDown
                      className={`size-3 text-muted-foreground/60 transition-transform ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {grp.chats.map((chat) => {
                        const isActive = activeChatId === chat.id;
                        const isEditing = editingId === chat.id;

                        return (
                          <div
                            key={chat.id}
                            onClick={() =>
                              workspaceId && router.push(`/${workspaceId}/ai/${chat.id}`)
                            }
                            className={cn(
                              'group relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors',
                              isActive
                                ? 'bg-accent text-accent-foreground font-medium shadow-xs'
                                : 'text-foreground/80 hover:bg-secondary/50',
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <MessageSquare className="size-3.5 shrink-0 opacity-60" />
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
                                  className="w-full bg-background px-1 py-0.5 text-xs rounded border border-primary focus:outline-none"
                                />
                              ) : (
                                <span className="truncate">{chat.title || 'Untitled'}</span>
                              )}
                            </div>

                            {/* Actions on hover */}
                            {!isEditing && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => handleStartRename(e, chat)}
                                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                                  title="Rename"
                                >
                                  <Pencil className="size-3" />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(e, chat.id)}
                                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="size-3" />
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
