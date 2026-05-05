import { useMemo, type ReactNode } from "react";
import { 
  ChevronDown,
  Trash2,
  Clock3,
  MoreHorizontal,
  ChevronRight,
  PlayCircle,
  CircleDashed,
  Circle,
  CheckCircle2,
  CalendarDays,
  Lock,
  Pencil,
  AlignLeft
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
import { PhaseIconRenderer } from "../components/PhaseIconRenderer";
import { cn } from "~/lib/utils";

export type DerivedStatus = "active" | "planned" | "completed";


function EmptyState({ status, searchTerm }: { status: DerivedStatus; searchTerm?: string }) {
  if (searchTerm?.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <h3 className="text-[14px] font-semibold text-zinc-900 mb-1">No cycles found</h3>
        <p className="text-[12px] text-muted-foreground">
          No cycles in <span className="font-medium text-zinc-600">{status}</span> section match "{searchTerm}"
        </p>
      </div>
    );
  }

  const configs = {
    active: {
      title: "No active cycle",
      description: "An active cycle includes any period that encompasses today's date within its range. Find the progress and details of the active cycle here.",
    },
    planned: {
      title: "No upcoming cycles",
      description: "Cycles that are scheduled for the future will appear here. Plan your upcoming work by creating a new cycle.",
    },
    completed: {
      title: "No completed cycles",
      description: "Past cycles that have reached their due date will be moved here for reference and reporting.",
    }
  }[status];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
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
  onNavigate: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  isReadOnly?: boolean;
  status: DerivedStatus;
  allLabels: any[];
  showLabelDetails?: boolean;
  onToggleLabelDetails?: (id: string) => void;
}

function CycleStatusIndicator({ status, hasDates }: { status: string; hasDates: boolean }) {
  if (status === "active") {
    return (
      <div className="relative size-4.5 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-orange-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-orange-500/60" style={{ clipPath: 'inset(0 0 0 50%)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
        </div>
      </div>
    );
  }
  if (status === "completed") {
    return (
      <div className="relative size-4.5 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/60" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-2.5 rounded-full bg-emerald-500" />
        </div>
      </div>
    );
  }
  
  if (hasDates) {
    return <CircleDashed className="size-4.5 text-blue-500/60 shrink-0" strokeWidth={2.5} />;
  }
  
  return <Circle className="size-4.5 text-zinc-300 shrink-0" strokeWidth={2} />;
}

export function Item({
  cycle,
  phases,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onNavigate,
  onStart,
  onComplete,
  isReadOnly = false,
  status,
  allLabels,
  showLabelDetails,
  onToggleLabelDetails,
}: ItemProps) {
  const phaseConfig = useMemo(() => {
    const dynamic = phases.find(p => p.id === cycle.phase);
    if (dynamic) return dynamic;
    
    const stat = (STATIC_PHASE_CONFIG as any)[cycle.phase];
    if (stat) return stat;

    return { label: "Custom", color: "#6b7280", icon: "📋" };
  }, [phases, cycle.phase]);

  const cycleLabels = useMemo(() => {
    return allLabels.filter(l => cycle.labels?.includes(l._id));
  }, [allLabels, cycle.labels]);

  const hasDescription = useMemo(() => {
    return !!(cycle.description?.trim());
  }, [cycle.description]);

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
      onClick={onNavigate}
      className={`w-full flex items-center gap-4 px-4 py-3 bg-white hover:bg-zinc-50 transition-colors text-left group cursor-pointer focus:outline-none focus-visible:bg-zinc-50 relative ${isReadOnly ? 'opacity-90' : ''}`}
    >
      <CycleStatusIndicator 
        status={status} 
        hasDates={!!(cycle.startDate || cycle.endDate)} 
      />

      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium text-zinc-700 truncate group-hover:text-black">
          {cycle.name}
        </span>
      </div>

      {/* Right Side Actions & Info */}
      <div 
        className="flex items-center gap-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Labels - Task List Style */}
        {cycleLabels.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLabelDetails?.(cycle._id);
            }}
            className="flex items-center gap-1.5 shrink-0"
          >
            {cycleLabels.slice(0, 3).map((label) => {
              if (showLabelDetails) {
                return (
                  <span
                    key={label._id}
                    className="inline-flex h-4 items-center rounded-sm px-2 text-[10px] font-semibold leading-none text-zinc-900 animate-in fade-in zoom-in-95 duration-200"
                    style={{ backgroundColor: label.color }}
                  >
                    <span className="max-w-[120px] truncate">{label.name}</span>
                  </span>
                );
              }
              return (
                <span
                  key={label._id}
                  className="inline-flex h-2.5 w-11 rounded-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                  style={{ backgroundColor: label.color }}
                />
              );
            })}
          </button>
        )}

        {/* Phase Badge - Now at the end */}
        <div className="flex items-center gap-1.5 h-7 px-2 bg-muted/50 border border-border/50 rounded-sm shrink-0 cursor-default">
          <PhaseIconRenderer 
            phaseId={cycle.phase}
            icon={phaseConfig.icon}
            color={phaseConfig.color}
            size="sm"
            className="!size-3.5 !bg-transparent"
          />
          <span className="text-[11px] font-medium text-zinc-700 shrink-0">
            {phaseConfig.label}
          </span>
        </div>

        {hasDescription && (
          <AlignLeft className="size-3.5 text-zinc-400 shrink-0" />
        )}

        {dateText && (
          <span className="flex items-center gap-1.5 h-7 px-2 text-[11px] text-zinc-700 font-medium shrink-0 bg-muted/50 border border-border/50 rounded-sm cursor-default">
            <CalendarDays className="size-3" />
            <span className="whitespace-nowrap">{dateText}</span>
          </span>
        )}
      </div>


      <div className="flex items-center gap-1 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-40 group-hover:opacity-100 hover:bg-zinc-200/50 transition-all"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-sm shadow-xl p-1 border-border/50">
            {status === "planned" && (
              <DropdownMenuItem 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onStart?.(); 
                }} 
                className="text-zinc-700 focus:text-zinc-900 focus:bg-zinc-100 font-medium py-2"
              >
                <PlayCircle className="mr-2 h-4 w-4 text-zinc-400" /> Start Cycle
              </DropdownMenuItem>
            )}
            {status === "active" && (
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onComplete?.(); }}
                className="text-zinc-700 focus:text-zinc-900 focus:bg-zinc-100 font-medium py-2"
              >
                <CheckCircle2 className="mr-2 h-4 w-4 text-zinc-500" /> End Cycle
              </DropdownMenuItem>
            )}
            {!isReadOnly && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="py-2 text-zinc-700 focus:text-zinc-900">
                <Pencil className="mr-2 h-4 w-4 text-zinc-400" /> Edit Details
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive py-2"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
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
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onNavigate(); }} className="h-7 text-[11px] px-3">
            {isReadOnly ? "View Cycle" : "Open Cycle"}
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
    planned: { 
      label: "Upcoming cycle", 
      icon: <CircleDashed className="size-4.5 text-blue-500" />, 
    },
    completed: { 
      label: "Completed cycle", 
      icon: (
        <div className="relative size-4.5">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-2.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      ), 
    },
  }[status];

  return (
    <div className="flex flex-col bg-transparent">
      <div 
        className="flex items-center gap-3 px-3 py-2.5 bg-muted/50 transition-colors group cursor-pointer hover:bg-muted"
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
        <div className="bg-transparent border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}

export { EmptyState };
