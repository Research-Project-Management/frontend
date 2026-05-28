import { UserStar, ChevronDown, Clock3, MessageSquare, CheckSquare, ChevronRight, Check } from "lucide-react";
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
import { cn } from "~/lib/utils";
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
  const { data: tasksData = [], isLoading: isLoadingTasks } = useWorkspaceTasks(workspaceId || "");
  const tasks = tasksData as any[];
  const { projects = [], isLoading: isLoadingProjects } = useProjects();
  const [activeTab, setActiveTab] = useState<HeaderTab>("Summary");

  // Selection state for Task Dialog
  const [selectedTask, setSelectedTask] = useState<{ taskId: string; projectId: string } | null>(null);

  const personalTasks = useMemo(() => {
    if (!user) return { assigned: [], upcomingCount: 0, upcoming: [], completed: [] };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const assigned = tasks.filter((t: any) => {
      const assigneeId = typeof t.assignee === 'object' ? t.assignee?._id : t.assignee;
      return assigneeId === user._id;
    });

    const upcoming = assigned
      .filter((t: any) => {
        if (t.columnId === 'done' || !t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= today; // Only future or today's tasks
      })
      .sort((a, b) => {
        const timeA = new Date(a.dueDate).getTime();
        const timeB = new Date(b.dueDate).getTime();
        return timeA - timeB;
      });

    const completed = assigned
      .filter((t: any) => t.columnId === 'done')
      .sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });

    return { assigned, upcomingCount: upcoming.length, upcoming, completed };
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
      <div className="h-full flex flex-col min-h-0 overflow-hidden bg-background">
        <Topbar title="Your works" Icon={UserStar} />
        <div className="flex-1 p-6 space-y-10 overflow-y-auto">
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
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-background print:h-auto print:overflow-visible print:bg-white">
      {/* Premium Print Stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide sidebar, topbar, nav, dropdown, fallback buttons, and popovers */
          nav, aside, header, button, .no-print, [role="menu"], [data-state] {
            display: none !important;
          }
          
          /* Force standard document scroll behavior instead of app layout grids */
          body, html, #root, 
          div[class*="h-dvh"], 
          div[class*="flex-col"], 
          div[class*="overflow-hidden"],
          div[class*="overflow-y-auto"],
          .h-full, .min-h-0 {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            overflow-y: visible !important;
            position: static !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Stretch main container to full printed page */
          .flex-1 {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          
          @page {
            margin: 1.5cm;
            size: auto;
          }
        }
      `}} />

      <Topbar title="Your works" Icon={UserStar}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 items-center gap-2 px-3 select-none cursor-pointer border border-border/50 bg-background rounded-sm text-[13px] font-medium text-foreground/70 transition-all hover:bg-secondary/40 hover:text-foreground outline-none group opacity-100">
              <span className="truncate">
                {activeTab}
              </span>
              <ChevronDown size={14} className="text-foreground/40 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1 shadow-xl border-border/40 bg-background/95 backdrop-blur-xl rounded-md">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <DropdownMenuItem
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-all duration-200",
                    isActive 
                      ? "bg-secondary text-foreground font-semibold" 
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <span className="text-[13px] tracking-wide">
                    {tab}
                  </span>
                  {isActive && <Check className="size-3.5 text-primary stroke-[3px]" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </Topbar>
      
      {/* Printable Report Header */}
      <div className="hidden print:flex flex-col gap-1 border-b-2 border-zinc-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Your Works Status Report</h1>
        <p className="text-xs text-zinc-500">Flux Workspace • Created on {new Date().toLocaleDateString('vi-VN')} • User: {user?.name}</p>
      </div>

      <div className="flex-1 p-6 space-y-10 overflow-y-auto print:overflow-visible print:p-0 print:space-y-6 print:h-auto">
        {activeTab === "Summary" && (
          <div className="space-y-10 animate-fade-in animate-slide-up">
            <OverviewSection 
                assigned={personalTasks.assigned.length} 
                upcomingCount={personalTasks.upcomingCount}
                completed={personalTasks.completed.length}
                onCardClick={(tab) => setActiveTab(tab)}
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
          </div>
        )}

        {activeTab === "Assigned" && (
          <div className="animate-fade-in animate-slide-up">
            <TaskListView title="Assigned to you" tasks={personalTasks.assigned} onTaskClick={handleOpenTask} taskProjectMap={taskProjectMap} />
          </div>
        )}

        {activeTab === "Upcoming" && (
          <div className="animate-fade-in animate-slide-up">
            <TaskListView title="Upcoming deadlines" tasks={personalTasks.upcoming} onTaskClick={handleOpenTask} taskProjectMap={taskProjectMap} />
          </div>
        )}

        {activeTab === "Completed" && (
          <div className="animate-fade-in animate-slide-up">
            <TaskListView title="Recently completed" tasks={personalTasks.completed} onTaskClick={handleOpenTask} taskProjectMap={taskProjectMap} />
          </div>
        )}

        {activeTab === "Activity" && (
          <div className="animate-fade-in animate-slide-up">
            <RecentActivity taskProjectMap={taskProjectMap} limit={0} />
          </div>
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
      <div className="flex items-center justify-between px-1 print:mb-2">
        <h2 className="text-zinc-400 font-semibold uppercase text-[11px] tracking-wider print:text-zinc-700 print:text-xs">
            {title}
            <span className="ml-2 text-[12px] text-zinc-400 font-normal print:text-zinc-600">({tasks.length})</span>
        </h2>
      </div>
      
      <div className="space-y-4 print:space-y-6">
        {groups.length === 0 ? (
          <div className="text-center py-16 bg-white border border-border/40 rounded-xl">
            <div className="size-12 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="size-6 text-zinc-200" />
            </div>
            <p className="text-zinc-400 text-xs font-medium italic">No tasks found.</p>
          </div>
        ) : (
          groups.map((group) => {
            const isCollapsed = expandedIds.has(group.key);
            
            return (
            <div 
              key={group.key} 
              className="border border-border/40 rounded-xl overflow-hidden bg-card/60 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] print:border-zinc-300 print:shadow-none print:bg-white"
            >
                {/* Group Header */}
                <div 
                    className="flex items-center gap-2.5 px-4 py-3 bg-[#f8f9fa] border-b border-border/40 transition-colors group cursor-pointer hover:bg-zinc-100/50 print:bg-zinc-50 print:border-zinc-300"
                    onClick={() => toggleExpand(group.key)}
                >
                    <ChevronRight 
                        className={`size-3.5 text-zinc-400 transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''} print:hidden`} 
                    />
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="text-[13.5px] font-bold text-zinc-800 tracking-tight">{group.label}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-200/50 text-zinc-500 font-medium">{group.items.length}</span>
                </div>

                <div className={cn(
                    "bg-white divide-y divide-border/30",
                    isCollapsed ? "hidden print:block print:divide-y print:divide-zinc-200" : "block"
                )}>
                    {group.items.map((task) => {
                        const projectInfo = taskProjectMap[task._id];
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.columnId !== 'done';
                        
                        return (
                        <div 
                            key={task._id} 
                            onClick={() => onTaskClick(task._id)}
                            className="w-full flex items-center gap-4 px-5 py-3.5 bg-white hover:bg-zinc-50/70 transition-all text-left group cursor-pointer relative"
                        >
                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                <CheckSquare className="size-4 text-zinc-300 shrink-0 group-hover:text-primary transition-colors print:text-zinc-400" />
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 min-w-0">
                                    <span className={`text-[13.5px] truncate font-medium transition-all duration-200 ${
                                        task.columnId === 'done' ? "text-zinc-400 line-through font-normal" : "text-zinc-800 group-hover:text-primary"
                                    }`}>
                                        {task.title}
                                    </span>

                                    {projectInfo && (
                                        <span className="inline-flex items-center text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 w-fit print:text-zinc-700 print:bg-zinc-100 print:border-zinc-300">
                                            {projectInfo.name}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Metadata & Dates */}
                            <div className="flex items-center gap-3 shrink-0 print:gap-4">
                                {/* Meta Icons */}
                                <div className="flex items-center gap-2 text-zinc-300 transition-colors print:hidden">
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
                                            ? "bg-destructive/10 text-destructive border border-destructive/20 font-semibold print:text-red-700 print:bg-red-50" 
                                            : "text-zinc-400 group-hover:text-zinc-600 bg-zinc-100 print:text-zinc-600"
                                    }`}>
                                        {!isOverdue && <Clock3 className="size-3 print:hidden" />}
                                        <span className="whitespace-nowrap font-medium">
                                            {formatDateShort(task.dueDate)}
                                        </span>
                                    </span>
                                )}

                                {task.assignee && (
                                    <Avatar className="size-5.5 shrink-0 border border-white transition-transform hover:scale-110 print:border-zinc-200">
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
