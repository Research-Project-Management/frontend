import { useMemo, type ReactNode } from "react";
import { 
  ChevronDown,
  Trash2,
  Clock3,
  MoreHorizontal,
  ChevronRight,
  PlayCircle,
  CircleDashed,
  CheckCircle2,
  CalendarDays
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { Cycle } from "~/types/task";
import { PHASE_CONFIG as STATIC_PHASE_CONFIG } from "~/types/task";

export type DerivedStatus = "active" | "upcoming" | "completed";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-16 bg-zinc-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${value}%`,
          backgroundColor: value === 100 ? "#22c55e" : value > 0 ? "#3b82f6" : "#e4e4e7",
        }}
      />
    </div>
  );
}

function EmptyState({ status }: { status: DerivedStatus }) {
  const configs = {
    active: {
      title: "No active cycle",
      description: "An active cycle includes any period that encompasses today's date within its range. Find the progress and details of the active cycle here.",
      image: "https://flux.aisq.dev/mol-yf3ozm" // Placeholder for the illustration URL seen in user's image
    },
    upcoming: {
      title: "No upcoming cycles",
      description: "Cycles that are scheduled for the future will appear here. Plan your upcoming work by creating a new cycle.",
      image: ""
    },
    completed: {
      title: "No completed cycles",
      description: "Past cycles that have reached their due date will be moved here for reference and reporting.",
      image: ""
    }
  }[status];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 bg-white text-center">
      {status === 'active' && (
         <div className="mb-6 opacity-80">
            <svg width="200" height="120" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="70" y="20" width="80" height="50" rx="4" fill="#F4F5F7" />
              <rect x="70" y="30" width="80" height="50" rx="4" fill="#F4F5F7" stroke="#EBEDF0" />
              <rect x="70" y="40" width="80" height="50" rx="4" fill="white" stroke="#EBEDF0" />
              <circle cx="110" cy="65" r="18" stroke="#333" strokeWidth="1.5" />
              <path d="M106 65V58H114V72H106V65Z" fill="#EBEDF0" />
              <rect x="40" y="60" width="30" height="8" rx="4" fill="#F4F5F7" />
              <rect x="150" y="30" width="30" height="15" rx="4" fill="#F4F5F7" />
            </svg>
         </div>
      )}
      <h3 className="text-[15px] font-semibold text-zinc-900 mb-2">{configs.title}</h3>
      <p className="text-[13px] text-muted-foreground max-w-[440px] leading-relaxed">
        {configs.description}
      </p>
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

  const dateText = useMemo(() => {
    if (!cycle.startDate && !cycle.endDate) return null;
    const start = cycle.startDate ? new Date(cycle.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
    const end = cycle.endDate ? new Date(cycle.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
    return start && end && cycle.endDate ? `${start} - ${end}, ${new Date(cycle.endDate).getFullYear()}` : start || end;
  }, [cycle.startDate, cycle.endDate]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      className="w-full flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-zinc-50/80 transition-all text-left group cursor-pointer focus:outline-none focus-visible:bg-zinc-50 border-b border-border/40 relative last:border-b-0"
    >
      <div className="size-4.5 rounded-full border shrink-0 flex items-center justify-center text-[10px]" style={{ color: phaseConfig.color, borderColor: `${phaseConfig.color}40` }}>
         {phaseConfig.icon || <CircleDashed className="size-3" />}
      </div>
      
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-[13px] font-medium text-zinc-700 truncate group-hover:text-black">
          {cycle.name}
        </span>
      </div>

      {dateText && (
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium shrink-0 px-2 py-1 bg-zinc-50 rounded-sm border border-border/50">
          <CalendarDays className="size-3" />
          <span className="whitespace-nowrap">{dateText}</span>
        </span>
      )}

      <div className="flex items-center gap-4 shrink-0 px-2">
         <ProgressBar value={cycle.stats?.progress || 0} />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-zinc-200/50 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-sm">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <ChevronRight className="mr-2 h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Cycle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="absolute left-0 right-0 top-full bg-zinc-50/30 border-b border-border/40 px-12 py-3 z-10 animate-in fade-in slide-in-from-top-1 duration-200 pointer-events-auto shadow-sm">
          {cycle.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              {cycle.description}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 text-[11px] px-3">
            Open Cycle
          </Button>
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
      icon: (
        <div className="relative size-4.5">
          <div className="absolute inset-0 rounded-full border-2 border-orange-500/30" />
          <div className="absolute inset-0 rounded-full border-2 border-orange-500 clip-path-half" style={{ clipPath: 'inset(0 0 0 50%)' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-2 rounded-full bg-orange-500" />
          </div>
        </div>
      ), 
    },
    upcoming: { 
      label: "Upcoming cycle", 
      icon: <CircleDashed className="size-4.5 text-blue-500" />, 
    },
    completed: { 
      label: "Completed cycle", 
      icon: <CheckCircle2 className="size-4.5 text-green-600 fill-green-600/10" />, 
    },
  }[status];

  return (
    <div className="flex flex-col bg-[#f4f5f7]">
      <div 
        className="flex items-center gap-3 px-3 py-2.5 transition-colors group cursor-pointer hover:bg-zinc-200/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0">{config.icon}</div>
          <span className="text-[13.5px] font-semibold text-zinc-700">{config.label}</span>
          {count > 0 && <span className="text-[12px] text-zinc-400 font-normal">{count}</span>}
        </div>
        <ChevronDown 
          className={`size-4 text-zinc-400 transition-all duration-300 ${
            isExpanded ? "rotate-0" : "-rotate-90"
          }`} 
        />
      </div>

      {isExpanded && (
        <div className="bg-white border-t border-border/40 divide-y divide-border/40">
          {children}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
