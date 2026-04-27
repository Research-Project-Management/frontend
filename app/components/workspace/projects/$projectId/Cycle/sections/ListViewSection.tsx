import { useMemo, type ReactNode } from "react";
import { 
  CalendarDays, 
  ChevronRight, 
  ChevronDown,
  PlayCircle, 
  CircleDashed, 
  CheckCircle2,
  Trash2 
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Cycle } from "~/types/task";
import { PHASE_CONFIG as STATIC_PHASE_CONFIG } from "~/types/task";

type DerivedStatus = "active" | "upcoming" | "completed";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${value}%`,
          backgroundColor: value === 100 ? "#22c55e" : value > 50 ? "#3b82f6" : "#eab308",
        }}
      />
    </div>
  );
}

interface ItemProps {
  cycle: Cycle;
  phases: any[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function Item({
  cycle,
  phases,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: ItemProps) {
  const phaseConfig = useMemo(() => {
    const dynamic = phases.find(p => p.id === cycle.phase);
    if (dynamic) return dynamic;
    
    const stat = (STATIC_PHASE_CONFIG as any)[cycle.phase];
    if (stat) return stat;

    return { label: "Custom", color: "#6b7280", icon: "📋" };
  }, [phases, cycle.phase]);

  return (
    <div className="group border border-transparent hover:border-border rounded-xl bg-card/50 hover:bg-card transition-all overflow-hidden shadow-sm hover:shadow-md">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <span
            className="size-9 rounded-lg flex items-center justify-center text-sm shrink-0 shadow-sm"
            style={{ backgroundColor: `${phaseConfig.color}15`, color: phaseConfig.color }}
          >
            {phaseConfig.icon}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {cycle.name}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight"
                style={{
                  color: phaseConfig.color,
                  backgroundColor: `${phaseConfig.color}10`,
                }}
              >
                {phaseConfig.label}
              </span>
              {(cycle.startDate || cycle.endDate) && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                  <CalendarDays className="size-3" />
                  {cycle.startDate &&
                    new Date(cycle.startDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  {cycle.startDate && cycle.endDate && " → "}
                  {cycle.endDate &&
                    new Date(cycle.endDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 pr-2">
            <div className="w-16">
              <ProgressBar value={cycle.stats?.progress || 0} />
            </div>
          </div>
        </button>

        <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="size-8 p-0 hover:bg-primary/10 hover:text-primary"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4 animate-in slide-in-from-top-2 fade-in duration-300 ml-12">
          {cycle.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {cycle.description}
            </p>
          )}

          <div className="flex items-center gap-6 text-sm font-medium">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{cycle.stats?.totalTasks || 0}</strong> tasks
            </span>
            <span className="text-muted-foreground">
              <strong className="text-green-600">{cycle.stats?.completedTasks || 0}</strong> completed
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onEdit} className="text-xs h-7.5 px-3 font-medium">
              Edit Details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-xs h-7.5 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 font-medium"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Delete Cycle
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ListViewGroupProps {
  status: DerivedStatus;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ListViewGroup({
  status,
  count,
  isExpanded,
  onToggle,
  children,
}: ListViewGroupProps) {
  const config = {
    active: { 
      label: "Active cycle", 
      icon: <PlayCircle className="size-5 text-orange-500 fill-orange-500/20" />, 
    },
    upcoming: { 
      label: "Upcoming cycle", 
      icon: <CircleDashed className="size-5 text-blue-500" />, 
    },
    completed: { 
      label: "Completed cycle", 
      icon: <CheckCircle2 className="size-5 text-green-500 fill-green-500/20" />, 
    },
  }[status];

  return (
    <div className="space-y-1.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-accent/40 transition-all rounded-xl group select-none"
      >
        <div className="flex items-center gap-3">
          <div className="transition-transform group-hover:scale-110 duration-200">
            {config.icon}
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {config.label}
          </span>
          {count > 0 && (
            <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-1">
              {count}
            </span>
          )}
        </div>
        <ChevronDown 
          className={`size-4 text-muted-foreground transition-all duration-300 ${
            isExpanded ? "rotate-0 opacity-100" : "-rotate-90 opacity-50"
          }`} 
        />
      </button>

      {isExpanded && (
        <div className="space-y-3 px-1 pb-6 animate-in slide-in-from-top-2 fade-in duration-300">
          {children}
        </div>
      )}
    </div>
  );
}
