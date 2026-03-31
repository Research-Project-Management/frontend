import { useState } from "react";
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  SlidersHorizontal,
  Check,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Column } from "~/types/task";
import { DEFAULT_TASK_COLUMN_COLORS } from "~/types/task";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ViewMode = "board" | "list";
type TopBarProps = {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  searchText: string;
  onSearchChange: (text: string) => void;
  columns: Column[];
  selectedColumnIds: string[];
  onColumnFilterChange: (columnIds: string[]) => void;
  onCreateSection: () => void;
};

export default function TopBar({
  viewMode,
  onViewChange,
  searchText,
  onSearchChange,
  columns,
  selectedColumnIds,
  onColumnFilterChange,
  onCreateSection,
}: TopBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const activeColumns = columns.filter((column) =>
    selectedColumnIds.includes(column.id ?? column._id ?? ""),
  );

  const toggleColumnFilter = (columnId: string) => {
    if (selectedColumnIds.includes(columnId)) {
      onColumnFilterChange(selectedColumnIds.filter((id) => id !== columnId));
      return;
    }

    onColumnFilterChange([...selectedColumnIds, columnId]);
  };

  return (
    <div className="px-4 py-2">
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

        <div className="flex items-center gap-1.5">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Filter tasks"
              >
                <SlidersHorizontal className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 rounded-xl border-border/70 p-2 shadow-lg">
              <div className="px-2 py-1">
                <p className="text-sm font-semibold text-foreground">Filter tasks</p>
                <p className="text-xs text-muted-foreground">Filter by column</p>
              </div>

              {activeColumns.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5 px-2 pb-2">
                  {activeColumns.map((column) => {
                    const columnId = column.id ?? column._id ?? "";
                    const columnColor =
                      DEFAULT_TASK_COLUMN_COLORS[columnId] ||
                      column.accentColor ||
                      "#6B7280";

                    return (
                      <button
                        key={columnId}
                        type="button"
                        onClick={() =>
                          onColumnFilterChange(
                            selectedColumnIds.filter((id) => id !== columnId),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent/80"
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: columnColor }}
                        />
                        <span>{column.title}</span>
                        <X className="size-3" />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onColumnFilterChange([]);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    selectedColumnIds.length === 0
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                  }`}
                >
                  <span className="size-2 rounded-full bg-muted-foreground/50" />
                  <span className="flex-1">All columns</span>
                  {selectedColumnIds.length === 0 ? (
                    <Check className="size-4 text-foreground" />
                  ) : null}
                </button>

                {columns.map((column) => {
                  const columnId = column.id ?? column._id ?? "";
                  const columnColor =
                    DEFAULT_TASK_COLUMN_COLORS[columnId] ||
                    column.accentColor ||
                    "#6B7280";
                  const isActive = selectedColumnIds.includes(columnId);

                  return (
                    <button
                      key={columnId}
                      type="button"
                      onClick={() => toggleColumnFilter(columnId)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      }`}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: columnColor }}
                      />
                      <span className="flex-1">{column.title}</span>
                      {isActive ? (
                        <Check className="size-4 text-foreground" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateSection}
            className="gap-1.5 h-8 text-xs"
          >
            <Plus className="size-3.5" />
            New Column
          </Button>
        </div>
      </div>
    </div>
  );
}
