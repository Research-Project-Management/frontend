import type { Task, Column } from "~/types/task";
import { DEFAULT_TASK_COLUMN_COLORS } from "~/types/task";
import PriorityBadge from "../PriorityBadge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { CalendarDays, Copy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

type ListViewProps = {
  tasks: Task[];
  columns: Column[];
  onAddCard: (columnId: string) => void;
  onEditCard: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
};

export default function ListView({
  tasks,
  columns,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
}: ListViewProps) {
  const groups = columns.map((col) => ({
    key: col.id ?? col._id ?? "",
    label: col.title,
    color:
      DEFAULT_TASK_COLUMN_COLORS[col.id ?? col._id ?? ""] ||
      col.accentColor ||
      "#6B7280",
    items: tasks.filter((t) => t.columnId === (col.id ?? col._id ?? "")),
  }));

  return (
    <div className="space-y-6 pb-8">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Group header */}
          <div className="mb-2 flex items-center gap-2 px-1">
            <div className="flex items-center gap-2">
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

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddCard(group.key)}
              className="ml-auto h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add task
            </Button>
          </div>

          {/* Tasks list */}
          {group.items.length === 0 ? (
            <div className="text-xs text-muted-foreground pl-5 py-2">
              No tasks
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {group.items.map((task) => (
                <div
                  key={task._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEditCard(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onEditCard(task);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left group cursor-pointer focus:outline-none focus-visible:bg-accent/50"
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

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:bg-accent/80 data-[state=open]:bg-accent/80"
                        aria-label="More actions"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-44 rounded-xl border-border/70 bg-background/95 p-1.5 shadow-lg backdrop-blur"
                    >
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCard(task);
                        }}
                        className="rounded-lg text-foreground"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateCard(task);
                        }}
                        className="rounded-lg"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
