import { useState } from "react";
import {
  LayoutGrid,
  List,
  CalendarDays,
  Search,
  Plus,
  SlidersHorizontal,
  Check,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import type { Column } from "~/types/task";
import { resolveTaskColumnColor, resolveTaskColumnId } from "~/types/task";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

type ViewMode = "board" | "list" | "calendar";
type AssigneeFilterOption = {
  id: string;
  name: string;
  avatar?: string;
};

type TopBarProps = {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  columns: Column[];
  selectedColumnIds: string[];
  onColumnFilterChange: (columnIds: string[]) => void;
  assignees: AssigneeFilterOption[];
  selectedAssigneeIds: string[];
  onAssigneeFilterChange: (assigneeIds: string[]) => void;
  onCreateSection: () => void;
};

export default function TopBar({
  viewMode,
  onViewChange,
  columns,
  selectedColumnIds,
  onColumnFilterChange,
  assignees,
  selectedAssigneeIds,
  onAssigneeFilterChange,
  onCreateSection,
}: TopBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const activeColumns = columns.filter((column) =>
    selectedColumnIds.includes(resolveTaskColumnId(column)),
  );
  const activeAssignees = assignees.filter((assignee) =>
    selectedAssigneeIds.includes(assignee.id),
  );

  const toggleColumnFilter = (columnId: string) => {
    if (selectedColumnIds.includes(columnId)) {
      onColumnFilterChange(selectedColumnIds.filter((id) => id !== columnId));
      return;
    }

    onColumnFilterChange([...selectedColumnIds, columnId]);
  };

  const toggleAssigneeFilter = (assigneeId: string) => {
    if (selectedAssigneeIds.includes(assigneeId)) {
      onAssigneeFilterChange(selectedAssigneeIds.filter((id) => id !== assigneeId));
      return;
    }

    onAssigneeFilterChange([...selectedAssigneeIds, assigneeId]);
  };

  return (
    <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex h-8 items-center overflow-hidden rounded-sm border border-border bg-background">
            <button
              onClick={() => onViewChange("board")}
              className={`p-2 transition-colors ${
                viewMode === "board"
                  ? "bg-black text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title="Board view"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => onViewChange("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-black text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title="List view"
            >
              <List className="size-4" />
            </button>
            <button
              onClick={() => onViewChange("calendar")}
              className={`p-2 transition-colors ${
                viewMode === "calendar"
                  ? "bg-black text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title="Calendar view"
            >
              <CalendarDays className="size-4" />
            </button>
          </div>

          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Filter tasks"
              >
                <SlidersHorizontal className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 max-w-[calc(100vw-1.5rem)] rounded-sm border-border/70 p-2 shadow-lg"
            >
              <div className="px-2 py-1">
                <p className="text-sm font-semibold text-foreground">Filter tasks</p>
              </div>

              {activeColumns.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5 px-2 pb-2">
                  {activeColumns.map((column) => {
                    const columnId = resolveTaskColumnId(column);
                    const columnColor = resolveTaskColumnColor(
                      columnId,
                      column.accentColor,
                    );

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
                  className={`flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors ${
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
                  const columnId = resolveTaskColumnId(column);
                  const columnColor = resolveTaskColumnColor(
                    columnId,
                    column.accentColor,
                  );
                  const isActive = selectedColumnIds.includes(columnId);

                  return (
                    <button
                      key={columnId}
                      type="button"
                      onClick={() => toggleColumnFilter(columnId)}
                      className={`flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors ${
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

              {activeAssignees.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5 px-2 pb-2">
                  {activeAssignees.map((assignee) => (
                    <button
                      key={assignee.id}
                      type="button"
                      onClick={() =>
                        onAssigneeFilterChange(
                          selectedAssigneeIds.filter((id) => id !== assignee.id),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent/80"
                    >
                      <span className="max-w-36 truncate">{assignee.name}</span>
                      <X className="size-3" />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-1 space-y-1 border-t border-border/70 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onAssigneeFilterChange([]);
                  }}
                  className={`flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors ${
                    selectedAssigneeIds.length === 0
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                  }`}
                >
                  <span className="size-2 rounded-full bg-muted-foreground/50" />
                  <span className="flex-1">All assignees</span>
                  {selectedAssigneeIds.length === 0 ? (
                    <Check className="size-4 text-foreground" />
                  ) : null}
                </button>

                <div className="max-h-56 overflow-y-auto pr-1">
                  {assignees.map((assignee) => {
                    const isActive = selectedAssigneeIds.includes(assignee.id);
                    const fallback = assignee.name.trim().charAt(0).toUpperCase();

                    return (
                      <button
                        key={assignee.id}
                        type="button"
                        onClick={() => toggleAssigneeFilter(assignee.id)}
                        className={`flex w-full min-w-0 items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        }`}
                      >
                        <Avatar className="size-5 shrink-0">
                          <AvatarImage src={assignee.avatar} />
                          <AvatarFallback className="text-[10px]">
                            {fallback || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate">{assignee.name}</span>
                        {isActive ? <Check className="size-4 shrink-0 text-foreground" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="default"
            size="sm"
            onClick={onCreateSection}
            className="h-8 gap-1.5 rounded-sm px-3 text-xs shadow-none transition-[filter] hover:brightness-110"
          >
            <Plus className="size-3.5" />
            New Column
          </Button>
    </div>
  );
}
