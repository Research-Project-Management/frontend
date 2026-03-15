import { useState } from "react";
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Cycle, Priority } from "~/types/task";
import { PHASE_CONFIG, PRIORITY_CONFIG } from "~/types/task";

type ViewMode = "board" | "list";
type GroupBy = "status" | "priority";

type TopBarProps = {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  selectedCycleId: string | null;
  onCycleChange: (id: string | null) => void;
  selectedPriority: Priority | null;
  onPriorityChange: (p: Priority | null) => void;
  cycles: Cycle[];
  onCreateSection: (payload: any) => void;
};

export default function TopBar({
  viewMode,
  onViewChange,
  groupBy,
  onGroupByChange,
  searchText,
  onSearchChange,
  selectedCycleId,
  onCycleChange,
  selectedPriority,
  onPriorityChange,
  cycles,
  onCreateSection,
}: TopBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasFilters = selectedCycleId || selectedPriority;

  return (
    <div className="px-4 py-2 space-y-2">
      {/* Primary row */}
      <div className="flex items-center gap-2">
        {/* View toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => onViewChange("board")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "board" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Board view"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            onClick={() => onViewChange("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="List view"
          >
            <List className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex-1" />

        {/* Filters toggle */}
        <Button
          variant={showFilters ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-1.5 h-8 text-xs"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {hasFilters && (
            <span className="size-1.5 rounded-full bg-primary" />
          )}
        </Button>

        {/* Create column (board only) */}
        {viewMode === "board" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onCreateSection({
                sectionName: "New Column",
                selectedColor: "#e2e8f0",
                isDefault: false,
              })
            }
            className="gap-1.5 h-8 text-xs"
          >
            <Plus className="size-3.5" />
            Column
          </Button>
        )}
      </div>

      {/* Filter row (expandable) */}
      {showFilters && (
        <div className="flex items-center gap-2 pb-1 flex-wrap animate-in slide-in-from-top-1 fade-in duration-200">
          {/* Cycle filter */}
          <select
            value={selectedCycleId || ""}
            onChange={(e) =>
              onCycleChange(e.target.value || null)
            }
            className="text-xs px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">All Cycles</option>
            {cycles.map((c) => (
              <option key={c._id} value={c._id}>
                {PHASE_CONFIG[c.phase]?.icon} {c.name}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={selectedPriority || ""}
            onChange={(e) =>
              onPriorityChange(
                (e.target.value as Priority) || null,
              )
            }
            className="text-xs px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>
                {val.icon} {val.label}
              </option>
            ))}
          </select>

          {/* Group by (list view only) */}
          {viewMode === "list" && (
            <select
              value={groupBy}
              onChange={(e) =>
                onGroupByChange(e.target.value as GroupBy)
              }
              className="text-xs px-2.5 py-1.5 bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="status">Group by Status</option>
              <option value="priority">Group by Priority</option>
            </select>
          )}

          {/* Clear filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onCycleChange(null);
                onPriorityChange(null);
              }}
              className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
