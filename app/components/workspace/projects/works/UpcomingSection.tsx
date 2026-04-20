import { Clock, Calendar } from "lucide-react";
import { format, isSameDay, isTomorrow, differenceInCalendarDays } from "date-fns";
import { useWorkspaceTasks } from "~/query/task";
import { useParams } from "react-router";
import { useAuth } from "~/hooks/useAuth";

export default function UpcomingSection({ 
    onTaskClick,
    taskProjectMap = {}
}: { 
    onTaskClick?: (taskId: string) => void;
    taskProjectMap?: Record<string, { id: string; name: string }>;
}) {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useWorkspaceTasks(workspaceId || "");

  // Sort: Tasks closest to deadline first (including overdue)
  const upcomingTasks = tasks
    .filter(t => {
        const assigneeId = typeof t.assignee === 'object' ? t.assignee?._id : t.assignee;
        return assigneeId === user?._id && t.dueDate && t.columnId !== "done";
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 4);

  const getRelativeDate = (date: Date) => {
    const today = new Date();
    if (isSameDay(date, today)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    const daysUntil = differenceInCalendarDays(date, today);
    if (daysUntil > 1) return `In ${daysUntil} days`;
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
    return format(date, "MMM d");
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-primary/50 font-semibold uppercase text-[11px] tracking-wider">Upcoming Tasks</h2>
      </div>
      <div className="grid gap-2">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>
        ) : upcomingTasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
             No upcoming tasks for you.
          </div>
        ) : (
          upcomingTasks.map((task: any) => {
            const projectInfo = taskProjectMap[task._id];
            const dueDate = new Date(task.dueDate);

            return (
              <div 
                key={task._id} 
                onClick={() => onTaskClick?.(task._id)}
                className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-secondary/50 transition-all duration-200 group border border-transparent hover:border-border/50 cursor-pointer"
              >
                {/* Date Square on Left */}
                <div className="h-10 w-10 flex flex-col items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                  <span className="text-sm font-bold leading-none">{format(dueDate, "d")}</span>
                  <span className="text-[9px] uppercase font-bold mt-0.5">{format(dueDate, "MMM")}</span>
                </div>

                {/* Info in Center */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {task.title}
                  </h4>
                  {projectInfo && (
                    <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-none mt-1 block">
                        {projectInfo.name}
                    </span>
                  )}
                </div>

                {/* Relative Time on Right */}
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase whitespace-nowrap group-hover:text-primary/70 transition-colors">
                        {getRelativeDate(dueDate)}
                    </span>
                    <span className="text-[9px] text-muted-foreground/20 font-medium">
                        {format(dueDate, "h:mm a")}
                    </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
