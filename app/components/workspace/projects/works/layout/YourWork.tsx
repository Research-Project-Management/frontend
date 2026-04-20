import { UserStar, ChevronDown, Clock3, MessageSquare, CheckSquare, ChevronRight } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router";
import { useWorkspaceTasks } from "~/query/task";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { 
    resolveTaskColumnColor, 
    DEFAULT_TASK_COLUMN_COLORS 
} from "~/types/task";
import { useProjects } from "~/hooks/useWorkspace";
import useAuth from "~/hooks/useAuth";
import Topbar from "../Topbar";
import OverviewSection from "../OverviewSection";
import QuickProjects from "../QuickProjects";
import UpcomingSection from "../UpcomingSection";
import RecentActivity from "../RecentActivity";
import TaskDialogWrapper from "../TaskDialogWrapper";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const TABS = ["Summary", "Assigned", "Upcoming", "Completed", "Activity"] as const;
type HeaderTab = (typeof TABS)[number];

export default function YourWorks() {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { data: tasks = [], isLoading: isLoadingTasks } = useWorkspaceTasks(workspaceId || "");
  const { projects = [], isLoading: isLoadingProjects } = useProjects();
  const [activeTab, setActiveTab] = useState<HeaderTab>("Summary");

  // Selection state for Task Dialog
  const [selectedTask, setSelectedTask] = useState<{ taskId: string; projectId: string } | null>(null);

  const personalTasks = useMemo(() => {
    if (!user) return { assigned: [], dueNext7Days: [], upcoming: [], completed: [] };
    
    const now = new Date();
    const endOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endOf7Days.setDate(endOf7Days.getDate() + 7);
    endOf7Days.setHours(23, 59, 59, 999);
    
    const assigned = tasks.filter((t: any) => {
      const assigneeId = typeof t.assignee === 'object' ? t.assignee?._id : t.assignee;
      return assigneeId === user._id;
    });

    const dueNext7Days = assigned.filter((t: any) => {
      if (t.columnId === 'done' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      // Include everything due before OR on the 7th day (includes overdue)
      return d <= endOf7Days;
    });

    const upcoming = assigned
      .filter((t: any) => t.columnId !== 'done' && t.dueDate)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const completed = assigned
      .filter((t: any) => t.columnId === 'done')
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    return { assigned, dueNext7Days, upcoming, completed };
  }, [tasks, user]);

  // Map Project IDs to Names
  const projectMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    projects.forEach((p: any) => {
      map[p._id] = { id: p._id, name: p.name };
    });
    return map;
  }, [projects]);

  // Map Task IDs to their Project Info
  const taskProjectMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    tasks.forEach((t: any) => {
      const project = t.project;
      if (!project) return;

      if (typeof project === 'object') {
        map[t._id] = { id: project._id, name: project.name };
      } else if (projectMap[project]) {
        map[t._id] = projectMap[project];
      }
    });
    return map;
  }, [tasks, projectMap]);

  const handleOpenTask = (taskId: string) => {
    const task = tasks.find(t => t._id === taskId);
    const pId = task ? (typeof task.project === 'object' ? task.project?._id : task.project) : null;
    if (task && pId) {
      setSelectedTask({ taskId, projectId: pId });
    }
  };

  const isLoading = isLoadingTasks || isLoadingProjects;

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-10 overflow-y-auto">
        <Topbar title="Your works" Icon={UserStar} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      <Topbar title="Your works" Icon={UserStar}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-sm font-medium text-primary hover:bg-muted/50 px-2 py-1 rounded-sm transition-colors cursor-pointer outline-none">
              {activeTab}
              <ChevronDown size={14} className="text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 shadow-lg">
            {TABS.map((tab) => (
              <DropdownMenuItem
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`cursor-pointer ${activeTab === tab ? "bg-muted font-medium" : ""}`}
              >
                {tab}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Topbar>
      
      <div className="flex-1 p-6 space-y-10 overflow-y-auto">
        {activeTab === "Summary" && (
          <>
            <OverviewSection 
                assigned={personalTasks.assigned.length} 
                dueNext7Days={personalTasks.dueNext7Days.length}
                completed={personalTasks.completed.length}
            />
            <QuickProjects />
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-4">
                  <RecentActivity taskProjectMap={taskProjectMap} />
               </div>
               <div className="lg:col-span-3">
                  <UpcomingSection onTaskClick={handleOpenTask} taskProjectMap={taskProjectMap} />
               </div>
            </div>
          </>
        )}

        {activeTab === "Assigned" && (
          <TaskListView title="Assigned to you" tasks={personalTasks.assigned} onTaskClick={handleOpenTask} taskProjectMap={taskProjectMap} />
        )}

        {activeTab === "Upcoming" && (
          <TaskListView title="Upcoming deadlines" tasks={personalTasks.upcoming} onTaskClick={handleOpenTask} taskProjectMap={taskProjectMap} />
        )}

        {activeTab === "Completed" && (
          <TaskListView title="Recently completed" tasks={personalTasks.completed} onTaskClick={handleOpenTask} taskProjectMap={taskProjectMap} />
        )}

        {activeTab === "Activity" && (
          <RecentActivity taskProjectMap={taskProjectMap} limit={0} />
        )}
      </div>

      {selectedTask && (
        <TaskDialogWrapper
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          taskId={selectedTask.taskId}
          projectId={selectedTask.projectId}
        />
      )}
    </div>
  );
}

const COLUMN_NAMES: Record<string, string> = {
    backlog: "Backlog",
    todo: "To Do",
    doing: "In Progress",
    review: "In Review",
    done: "Done",
};

function TaskListView({ 
    title, 
    tasks, 
    onTaskClick,
    taskProjectMap = {}
}: { 
    title: string; 
    tasks: any[]; 
    onTaskClick: (taskId: string) => void;
    taskProjectMap?: Record<string, { id: string; name: string }>;
}) {
  const { workspaceId } = useParams();

  // UX Logic for Expand/Collapse columns with Hydration Safety
  const STORAGE_KEY = `flux.task.worklist.expanded.${title}`;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setExpandedIds(new Set(JSON.parse(saved)));
        }
      } catch (e) {
        console.error("Failed to load expanded state", e);
      }
      setIsReady(true);
    }
  }, [STORAGE_KEY]);

  useEffect(() => {
    if (isReady && typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(expandedIds)));
    }
  }, [expandedIds, isReady, STORAGE_KEY]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    tasks.forEach(task => {
        const colId = task.columnId || 'todo';
        if (!map.has(colId)) map.set(colId, []);
        map.get(colId)!.push(task);
    });

    // Sort tasks within each group by due date
    map.forEach((items) => {
        items.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    });

    const order = ['backlog', 'todo', 'doing', 'review', 'done'];
    return Array.from(map.entries())
        .sort((a, b) => {
            const indexA = order.indexOf(a[0]);
            const indexB = order.indexOf(b[0]);
            if (indexA === -1 && indexB === -1) return a[0].localeCompare(b[0]);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        })
        .map(([key, items]) => {
            const isStandard = COLUMN_NAMES[key];
            return {
                key,
                label: COLUMN_NAMES[key] || key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                color: DEFAULT_TASK_COLUMN_COLORS[key] || (isStandard ? "#6b7280" : "#94a3b8"),
                items
            };
        });
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-zinc-400 font-semibold uppercase text-[11px] tracking-wider">
            {title}
            <span className="ml-2 text-[12px] text-zinc-400 font-normal">({tasks.length})</span>
        </h2>
      </div>
      
      <div className="border border-border/80 overflow-hidden flex flex-col divide-y divide-border/80">
        {groups.length === 0 ? (
          <div className="text-center py-16 bg-white">
            <div className="size-12 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="size-6 text-zinc-200" />
            </div>
            <p className="text-zinc-400 text-xs font-medium italic">No tasks found.</p>
          </div>
        ) : (
          groups.map((group) => {
            const isCollapsed = expandedIds.has(group.key);
            
            return (
            <div key={group.key} className="flex flex-col bg-[#f4f5f7]">
                {/* Group Header */}
                <div 
                    className="flex items-center gap-2 px-3 py-2.5 transition-colors group cursor-pointer hover:bg-zinc-200/50"
                    onClick={() => toggleExpand(group.key)}
                >
                    <ChevronRight 
                        className={`size-3.5 text-zinc-400 transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}`} 
                    />
                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="text-[13.5px] font-semibold text-zinc-900">{group.label}</span>
                    <span className="text-[12px] text-zinc-400 font-normal">{group.items.length}</span>
                </div>

                {!isCollapsed && (
                    <div className="bg-white border-t border-border/40 divide-y divide-border/40">
                        {group.items.map((task) => {
                            const projectInfo = taskProjectMap[task._id];
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.columnId !== 'done';
                            
                            return (
                            <div 
                                key={task._id} 
                                onClick={() => onTaskClick(task._id)}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-zinc-50 transition-all text-left group cursor-pointer relative"
                            >
                                <div className="flex-1 min-w-0 flex items-baseline gap-2">
                                    <span className={`text-[13.5px] truncate transition-all duration-200 ${
                                        task.columnId === 'done' ? "text-zinc-400 line-through" : "text-zinc-700 group-hover:text-black font-semibold"
                                    }`}>
                                        {task.title}
                                    </span>

                                    {projectInfo && (
                                        <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-tighter shrink-0">
                                            {projectInfo.name}
                                        </span>
                                    )}
                                </div>

                                {/* Metadata & Dates */}
                                <div className="flex items-center gap-3 shrink-0">
                                    {/* Meta Icons */}
                                    <div className="flex items-center gap-2 text-zinc-300 transition-colors">
                                        {(task.commentCount ?? 0) > 0 && (
                                            <div className="flex items-center gap-0.5 text-[11px]" title="Comments">
                                                <MessageSquare className="size-3" />
                                                <span>{task.commentCount}</span>
                                            </div>
                                        )}
                                    </div>

                                    {task.dueDate && (
                                        <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-all duration-200 ${
                                            isOverdue
                                                ? "bg-[#c9372c] text-white font-semibold" 
                                                : "text-zinc-400 group-hover:text-zinc-600"
                                        }`}>
                                            {!isOverdue && <Clock3 className="size-3" />}
                                            <span className="whitespace-nowrap">
                                                {formatDateShort(task.dueDate)}
                                            </span>
                                        </span>
                                    )}

                                    {task.assignee && (
                                        <Avatar className="size-5 shrink-0 border border-white transition-transform">
                                            <AvatarImage src={task.assignee.avatar} />
                                            <AvatarFallback className="text-[9px] font-bold bg-zinc-100">
                                                {task.assignee.name?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
          )})
        )}
      </div>
    </div>
  );
}

function formatDateShort(dateString: string) {
    const date = new Date(dateString);
    return `${date.getDate()} thg ${date.getMonth() + 1}`;
}
