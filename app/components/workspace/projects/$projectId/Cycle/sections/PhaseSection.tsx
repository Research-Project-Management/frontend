import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  ClipboardList,
  Plus,
  Check,
  Trash2,
  X,
  ChevronLeft
} from "lucide-react";

const SCIENTIFIC_ICONS = [
  { id: "search", icon: "🔎", label: "Search", color: "#2563eb" },
  { id: "book", icon: "📚", label: "Literature", color: "#7c3aed" },
  { id: "method", icon: "🧩", label: "Methodology", color: "#0f766e" },
  { id: "database", icon: "🗂️", label: "Data", color: "#ca8a04" },
  { id: "analysis", icon: "📊", label: "Analysis", color: "#ea580c" },
  { id: "writing", icon: "✍️", label: "Writing", color: "#dc2626" },
  { id: "revision", icon: "🔁", label: "Revision", color: "#0891b2" },
  { id: "defense", icon: "🎓", label: "Defense", color: "#334155" },
  { id: "experiment", icon: "🧪", label: "Experiment", color: "#16a34a" },
  { id: "microscope", icon: "🔬", label: "Microscope", color: "#9333ea" },
  { id: "science", icon: "⚛️", label: "Science", color: "#6d28d9" },
  { id: "biology", icon: "🧬", label: "Biology", color: "#be185d" },
  { id: "brain", icon: "🧠", label: "Psychology", color: "#a16207" },
  { id: "results", icon: "📈", label: "Results", color: "#2563eb" },
  { id: "validation", icon: "✅", label: "Validation", color: "#0f766e" },
  { id: "seminar", icon: "🖥️", label: "Seminar", color: "#4d7c0f" },
  { id: "medical", icon: "🩺", label: "Medical", color: "#dc2626" },
  { id: "social", icon: "🌍", label: "Social", color: "#475569" },
  { id: "math", icon: "➗", label: "Math", color: "#1e293b" },
  { id: "physics", icon: "⚡", label: "Physics", color: "#f59e0b" },
  { id: "objective", icon: "🎯", label: "Objective", color: "#ef4444" },
  { id: "group", icon: "👥", label: "Group", color: "#16a34a" },
  { id: "discussion", icon: "💬", label: "Discussion", color: "#2563eb" },
  { id: "computing", icon: "💻", label: "Computing", color: "#7c3aed" },
  { id: "idea", icon: "💡", label: "Idea", color: "#eab308" }
];

const MAX_VISIBLE_PHASE_ROWS = 9;
const PHASE_ROW_HEIGHT = 48;
const PHASE_ROW_GAP = 2;
const PHASE_LIST_VERTICAL_PADDING = 12;
const PHASE_LIST_CHROME_HEIGHT = 108;
const PHASE_LIST_MAX_HEIGHT = 580;

interface Phase {
  id: string;
  icon: string | React.ReactNode;
  label: string;
  color: string;
}

interface PhaseSectionProps {
  phases: Phase[];
  setPhases: (phases: Phase[]) => void;
  formPhase: string;
  setFormPhase: (id: string) => void;
  trigger?: React.ReactNode;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

export const PhaseSection = ({
  phases,
  setPhases,
  formPhase,
  setFormPhase,
  trigger,
  triggerRef
}: PhaseSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState("");
  const [tempIconId, setTempIconId] = useState("search");

  const visiblePhaseRowCount = Math.min(phases.length, MAX_VISIBLE_PHASE_ROWS);
  const phaseRowsHeight =
    visiblePhaseRowCount > 0
      ? visiblePhaseRowCount * PHASE_ROW_HEIGHT +
        (visiblePhaseRowCount - 1) * PHASE_ROW_GAP
      : 0;
  const phaseListScrollHeight =
    PHASE_LIST_VERTICAL_PADDING + phaseRowsHeight;
  const phaseListHeight = Math.min(
    PHASE_LIST_MAX_HEIGHT,
    PHASE_LIST_CHROME_HEIGHT + phaseListScrollHeight
  );

  const handleScrollableWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollContainer = event.currentTarget;

    if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    scrollContainer.scrollTop += event.deltaY;
  };

  const renderPhaseIcon = (
    icon: string | React.ReactNode,
    color: string,
    size: "sm" | "md" = "md"
  ) => {
    const textSize = size === "sm" ? "text-[16px]" : "text-[22px]";

    if (typeof icon === "string") {
      return (
        <span
          className={`${textSize} flex items-center justify-center leading-none select-none transition-colors duration-200`}
          style={{ color }}
        >
          {icon}
        </span>
      );
    }

    return (
      <span className="flex items-center justify-center" style={{ color }}>
        {icon}
      </span>
    );
  };

  const handleOpenEdit = (phase: Phase) => {
    setEditingPhaseId(phase.id);
    setTempLabel(phase.label);

    const matchedIcon = SCIENTIFIC_ICONS.find((item) =>
      phase.id.startsWith(`${item.id}_`)
    );

    setTempIconId(matchedIcon?.id || "search");
    setView("edit");
  };

  const handleOpenCreate = () => {
    setEditingPhaseId(null);
    setTempLabel("");
    setTempIconId("search");
    setView("edit");
  };

  const handleSave = () => {
    if (!tempLabel.trim()) return;

    const iconObj = SCIENTIFIC_ICONS.find((item) => item.id === tempIconId);

    if (editingPhaseId) {
      setPhases(
        phases.map((phase) =>
          phase.id === editingPhaseId
            ? {
                ...phase,
                label: tempLabel,
                icon: iconObj?.icon || phase.icon,
                color: iconObj?.color || phase.color
              }
            : phase
        )
      );
    } else {
      setPhases([
        ...phases,
        {
          id: `${tempIconId}_${Date.now()}`,
          icon: iconObj?.icon || "🔎",
          label: tempLabel,
          color: iconObj?.color || "#2563eb"
        }
      ]);
    }

    setView("list");
  };

  const handleDelete = (id: string) => {
    if (phases.length <= 1 || id === formPhase) return;

    const nextPhases = phases.filter((phase) => phase.id !== id);
    setPhases(nextPhases);

    if (formPhase === id) {
      setFormPhase(nextPhases[0].id);
    }

    setView("list");
  };

  const renderEditView = () => (
    <div className="flex flex-1 w-full min-h-0 flex-col animate-in fade-in duration-150 bg-background">
      <div className="relative flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-sm hover:bg-accent"
          onClick={() => setView("list")}
        >
          <ChevronLeft className="size-4 text-muted-foreground" />
        </Button>

        <span className="flex-1 text-center text-sm font-semibold text-foreground">
          {editingPhaseId ? "Edit phase" : "Create phase"}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-sm hover:bg-accent"
          onClick={() => setIsOpen(false)}
        >
          <X className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <div
        className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 custom-scrollbar"
        onWheel={handleScrollableWheel}
      >
        <div className="space-y-2">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            TITLE
          </Label>
          <Input
            value={tempLabel}
            onChange={(event) => setTempLabel(event.target.value)}
            className="h-9 rounded-sm border-border/50 bg-background text-[13px] shadow-none ring-primary/20 focus-visible:ring-1"
            placeholder="Phase name..."
            autoFocus
          />
        </div>

        <div className="space-y-3">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            ICON
          </Label>

          <div className="grid grid-cols-5 gap-2">
            {SCIENTIFIC_ICONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTempIconId(item.id)}
                className={`flex h-12 items-center justify-center rounded-sm border transition-all duration-150 ${
                  tempIconId === item.id
                    ? "border-foreground bg-accent"
                    : "border-border/50 bg-background hover:border-border hover:bg-accent"
                }`}
                title={item.label}
                type="button"
              >
                {renderPhaseIcon(item.icon, item.color, "md")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between border-t border-border/50 p-4 bg-background">
        <Button
          onClick={handleSave}
          className="h-9 rounded-sm bg-[#202222] px-6 text-xs font-semibold text-white shadow-none transition-all hover:bg-[#202222]/90 active:scale-95"
        >
          Save
        </Button>

        {editingPhaseId && phases.length > 1 && formPhase !== editingPhaseId && (
          <Button
            onClick={() => handleDelete(editingPhaseId)}
            variant="ghost"
            className="h-9 rounded-sm px-4 text-xs font-semibold text-[#c9372c] hover:bg-[#fff1f0] hover:text-[#c9372c]"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );

  const renderListView = () => (
    <div className="flex flex-1 w-full min-h-0 flex-col animate-in fade-in duration-150 bg-background">
      <div className="relative flex shrink-0 items-center justify-between border-b border-border/50 bg-background px-4 py-3">
        <div className="size-8" />
        <span className="flex-1 text-center text-sm font-semibold text-foreground">
          Phases
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-sm hover:bg-accent"
          onClick={() => setIsOpen(false)}
        >
          <X className="size-4 text-muted-foreground" />
        </Button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1.5 custom-scrollbar"
        onWheel={handleScrollableWheel}
      >
        <div className="space-y-0.5">
          {phases.map((phase) => (
            <div key={phase.id} className="group relative flex items-center">
              <button
                onClick={() => {
                  setFormPhase(phase.id);
                  setIsOpen(false);
                }}
                className={`flex flex-1 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-[13px] transition-colors duration-150 ${
                  formPhase === phase.id
                    ? "bg-accent text-foreground"
                    : "text-foreground hover:bg-accent/70"
                }`}
                type="button"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm">
                  {renderPhaseIcon(phase.icon, phase.color, "sm")}
                </div>

                <span
                  className={`flex-1 truncate text-left font-semibold tracking-tight ${
                    formPhase === phase.id
                      ? "text-foreground"
                      : "text-foreground/80"
                  }`}
                >
                  {phase.label}
                </span>

                <div className="opacity-100">
                  {formPhase === phase.id && (
                    <Check className="size-3.5 text-foreground stroke-[2.5]" />
                  )}
                </div>
              </button>

              <div
                className={`absolute right-2 flex items-center gap-1 pr-2 opacity-0 transition-opacity group-hover:opacity-100 ${
                  formPhase === phase.id ? "hidden" : ""
                }`}
              >
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenEdit(phase);
                  }}
                  className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  type="button"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>

                {phases.length > 1 && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(phase.id);
                    }}
                    className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    type="button"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/50 bg-muted/30 p-2">
        <Button
          variant="ghost"
          onClick={handleOpenCreate}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border-none bg-accent/50 text-xs font-semibold text-foreground shadow-none transition-all hover:bg-accent"
        >
          <Plus className="size-3.5" />
          Create new phase
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      open={isOpen}
      onOpenChange={(value) => {
        setIsOpen(value);
        if (!value) setView("list");
      }}
    >
      <PopoverTrigger asChild>
        {trigger || (
          <button ref={triggerRef} className="flex h-10 items-center gap-2 rounded-sm border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] outline-none transition-colors hover:bg-[#f7f7f7]">
            <ClipboardList className="size-4 text-[#44546f]" />
            Phase
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-150}
        className="z-140 flex w-[320px] flex-col overflow-hidden rounded-sm border-border/50 bg-background p-0 shadow-2xl animate-in fade-in zoom-in duration-150"
        style={{
          height: view === "edit" ? undefined : phaseListHeight,
          maxHeight:
            "min(var(--radix-popover-content-available-height), calc(100vh - 24px))"
        }}
      >
        {view === "edit" ? renderEditView() : renderListView()}
      </PopoverContent>
    </Popover>
  );
};
