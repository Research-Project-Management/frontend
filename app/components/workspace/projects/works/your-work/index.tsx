import {
  ChevronDown,
  Calendar,
  CheckCircle2,
  Clock,
  List,
  LayoutList,
  UserStar,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useWorkspaceTasks } from "~/query/task";
import { isPast, isToday } from "date-fns";
import HomeSection from "../../Home/HomeSection";
import { Skeleton } from "~/components/ui/skeleton";
import Topbar from "../Topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const TABS = ["Summary", "Assigned", "Created", "Activity"] as const;
type HeaderTab = (typeof TABS)[number];

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function YourWorks() {
  const { workspaceId } = useParams();
  const { data: tasks = [], isLoading: isLoadingTasks } = useWorkspaceTasks(
    workspaceId || "",
  );
  const [activeTab, setActiveTab] = useState<HeaderTab>("Summary");
  const isLoading = isLoadingTasks;

  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(
      (t) =>
        t.dueDate &&
        isPast(new Date(t.dueDate)) &&
        !isToday(new Date(t.dueDate)) &&
        t.columnId !== "done",
    ).length;
    const completed = tasks.filter((t) => t.columnId === "done").length;
    const inProgress = tasks.filter(
      (t) => t.columnId && t.columnId !== "done",
    ).length;

    return { total, inProgress, completed, overdue };
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Topbar title="Your works" Icon={UserStar}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-xs font-semibold text-primary/80 bg-background hover:bg-secondary/40 px-3 py-1.5 rounded-sm transition-all cursor-pointer outline-none border border-border/50">
              {activeTab}
              <ChevronDown size={14} className="text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {TABS.map((tab) => (
              <DropdownMenuItem
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? "bg-muted font-medium" : ""}
              >
                {tab}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </Topbar>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <StatChip icon={<LayoutList className="size-3.5" />} label="Total" value={stats.total} />
          <StatChip icon={<Clock className="size-3.5" />} label="In Progress" value={stats.inProgress} />
          <StatChip icon={<CheckCircle2 className="size-3.5" />} label="Done" value={stats.completed} />
          {stats.overdue > 0 && (
            <StatChip icon={<Calendar className="size-3.5" />} label="Overdue" value={stats.overdue} />
          )}
        </div>

        <HomeSection title="Assigned to you">
          <div className="mb-4 flex items-center gap-1.5 rounded-lg bg-muted p-1 text-xs font-medium text-foreground w-fit">
            <List className="size-3.5" />
            List
          </div>

          <div>
            {tasks.length === 0 ? (
              <div className="py-12 border border-dashed border-border rounded-lg text-center">
                <LayoutList className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No tasks assigned yet
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Tasks assigned to you will appear here
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {tasks.map((task) => (
                  <div key={task._id} className="px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {task.identifier || "Task"}
                    </p>
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </HomeSection>
      </div>
    </div>
  );
}
