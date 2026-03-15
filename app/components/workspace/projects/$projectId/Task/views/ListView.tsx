import type { Task, Column } from "~/types/task";
import PriorityBadge from "../PriorityBadge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { CalendarDays, ChevronRight } from "lucide-react";

type ListViewProps = {
  tasks: Task[];
  columns: Column[];
  onEditCard: (task: Task) => void;
  groupBy: "status" | "priority";
};

export default function ListView({
  tasks,
  columns,
  onEditCard,
  groupBy,
}: ListViewProps) {
  const groups =
    groupBy === "status"
      ? columns.map((col) => ({
          key: col.id,
          label: col.title,
          color: col.accentColor || "#94a3b8",
          items: tasks.filter((t) => t.columnId === col.id),
        }))
      : (["urgent", "high", "medium", "low", "none"] as const).map((p) => {
          const config = {
            urgent: { label: "Urgent", color: "#ef4444" },
            high: { label: "High", color: "#f97316" },
            medium: { label: "Medium", color: "#eab308" },
            low: { label: "Low", color: "#3b82f6" },
            none: { label: "No Priority", color: "#6b7280" },
          };
          return {
            key: p,
            label: config[p].label,
            color: config[p].color,
            items: tasks.filter((t) => t.priority === p),
          };
        });

  return (
    <div className="space-y-6 pb-8">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Group header */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: group.color }}
            />
            <span className="text-sm font-semibold text-foreground">
              {group.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {group.items.length}
            </span>
          </div>

          {/* Tasks list */}
          {group.items.length === 0 ? (
            <div className="text-xs text-muted-foreground pl-5 py-2">
              No tasks
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {group.items.map((task) => (
                <button
                  key={task._id}
                  onClick={() => onEditCard(task)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left group"
                >
                  <PriorityBadge priority={task.priority} />

                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {task.identifier}
                  </span>

                  <span className="text-sm text-foreground flex-1 truncate group-hover:text-primary transition-colors">
                    {task.title}
                  </span>

                  {task.labels?.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      {task.labels.slice(0, 2).map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {task.dueDate && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <CalendarDays className="size-3" />
                      {new Date(task.dueDate).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  )}

                  {task.assignee && (
                    <Avatar className="size-5 shrink-0">
                      <AvatarImage src={task.assignee.avatar} />
                      <AvatarFallback className="text-[9px]">
                        {task.assignee.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
