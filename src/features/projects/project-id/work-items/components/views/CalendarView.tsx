'use client';

import {
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronDown,
  Plus,
  Search,
  X,
  FolderKanban,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameWeek,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subDays,
} from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Checkbox } from '@/shared/components/ui/checkbox';
import type { Column, Item } from '../../types/work-item.types';
import { PRIORITY_CONFIG } from '../../types/work-item.types';
import { resolveStateId, resolveStateColor, formatDate } from '../../utils/work-item.utils';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/shared/lib/utils";
import { createPortal } from 'react-dom';

interface CalendarCardProps {
  card: Item;
  isReadOnly?: boolean;
}

const CalendarCard = memo(function CalendarCard({ card }: CalendarCardProps) {
  const priorityConfig = PRIORITY_CONFIG[card.priority || 'none'];
  const columnColor = resolveStateColor(card.columnId);

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2 text-xs w-72 shadow-overlay">
      <div className="flex items-center justify-between gap-2">
        {card.identifier && (
          <span className="text-11 font-mono text-muted-foreground font-medium tabular-nums">
            {card.identifier}
          </span>
        )}
        {priorityConfig && (
          <span className="text-10 font-medium px-2 py-0.5 rounded-md bg-muted text-foreground">
            {priorityConfig.label}
          </span>
        )}
      </div>

      <div className="font-medium text-foreground text-13 leading-snug line-clamp-2">
        {card.title}
      </div>

      <div className="flex items-center justify-between pt-1 text-11 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: columnColor }} />
          <span className="capitalize">{card.columnId}</span>
        </div>

        {(card.startDate || card.dueDate) && (
          <div className="flex items-center gap-1 text-10 font-mono text-muted-foreground tabular-nums">
            <CalendarIcon className="size-3 shrink-0" />
            <span>
              {card.startDate && card.dueDate && card.startDate !== card.dueDate
                ? `${formatDate(card.startDate)} → ${formatDate(card.dueDate)}`
                : formatDate(card.dueDate || card.startDate)}
            </span>
          </div>
        )}

        {card.assignee && (
          <div className="flex items-center gap-1">
            <Avatar className="size-4 shrink-0">
              {card.assignee.avatar && <AvatarImage src={card.assignee.avatar} />}
              <AvatarFallback className="text-9">
                {card.assignee.name ? card.assignee.name.charAt(0) : 'U'}
              </AvatarFallback>
            </Avatar>
            <span>{card.assignee.name || 'Unassigned'}</span>
          </div>
        )}
      </div>
    </div>
  );
});

type CalendarViewProps = {
  items?: Item[];
  columns: Column[];
  projectId: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onOpenCardDetail: (item: Item) => void;
  onAssignExistingItems?: (ids: string[], dueDate: string, quiet?: boolean, startDate?: string | null) => void;
  isAddingCard?: boolean;
  isReadOnly?: boolean;
};

import type { CalendarLayoutMode } from '../../types/calendar-view.types';
import {
  DATE_KEY_FORMAT,
  WEEK_DAY_LABELS,
  DATE_KEY_PATTERN,
  isMidnightDueDate,
  getCalendarDateKey,
  createCalendarDueDate,
} from '../../utils/calendar.utils';

export type { CalendarLayoutMode };
export {
  DATE_KEY_FORMAT,
  WEEK_DAY_LABELS,
  DATE_KEY_PATTERN,
  isMidnightDueDate,
  getCalendarDateKey,
  createCalendarDueDate,
};

const EMPTY_ARRAY: never[] = [];
const NOOP = () => {};

export const CalendarView = memo(function CalendarView({
  items: propItems = EMPTY_ARRAY,
  columns,
  projectId,
  onAddCard,
  onOpenCardDetail,
  onAssignExistingItems: propOnAssignExistingItems,
  isAddingCard,
  isReadOnly,
}: CalendarViewProps) {
  const items = propItems;
  const onAssignExistingItems = propOnAssignExistingItems || NOOP;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [layoutMode, setLayoutMode] = useState<CalendarLayoutMode>("month");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [quickAddDateKey, setQuickAddDateKey] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [addItemMenuDateKey, setAddItemMenuDateKey] = useState<string | null>(null);
  const [existingDialogDateKey, setExistingDialogDateKey] = useState<string | null>(
    null,
  );
  const [existingSearch, setExistingSearch] = useState("");
  const [selectedExistingItemIds, setSelectedExistingItemIds] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [draggedWidth, setDraggedWidth] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const calendarDays = useMemo(() => {
    if (layoutMode === "week") {
      const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }

    const monthStart = startOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth, layoutMode]);

  const singleDayItemsByDate = useMemo(() => {
    const singleDay = new Map<string, Item[]>();

    items.forEach((item) => {
      // Linear / Jira modern calendar paradigm: schedule task on its Due Date (or Start Date if no Due Date)
      const dueKey = getCalendarDateKey(item.dueDate);
      const startKey = getCalendarDateKey(item.startDate);
      const targetKey = dueKey || startKey;

      if (targetKey) {
        if (!singleDay.has(targetKey)) singleDay.set(targetKey, []);
        singleDay.get(targetKey)!.push(item);
      }
    });

    return singleDay;
  }, [items]);

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  const existingItemCandidates = useMemo(
    () => items.filter((item) => !item.dueDate),
    [items],
  );

  const filteredExistingItemCandidates = useMemo(() => {
    const keyword = existingSearch.trim().toLowerCase();
    if (!keyword) return existingItemCandidates;

    return existingItemCandidates.filter((item) => {
      const identifierText = item.identifier?.toLowerCase() || "";
      const titleText = item.title?.toLowerCase() || "";
      return identifierText.includes(keyword) || titleText.includes(keyword);
    });
  }, [existingSearch, existingItemCandidates]);

  const allFilteredItemsSelected = useMemo(() => {
    if (filteredExistingItemCandidates.length === 0) return false;

    const selectedSet = new Set(selectedExistingItemIds);
    return filteredExistingItemCandidates.every((item) =>
      selectedSet.has(item.id),
    );
  }, [filteredExistingItemCandidates, selectedExistingItemIds]);

  const handlePrevious = useCallback(() => {
    if (layoutMode === "week") {
      setCurrentMonth((current) => subDays(current, 7));
      return;
    }
    setCurrentMonth((current) => subMonths(current, 1));
  }, [layoutMode]);

  const handleNext = useCallback(() => {
    if (layoutMode === "week") {
      setCurrentMonth((current) => addDays(current, 7));
      return;
    }
    setCurrentMonth((current) => addMonths(current, 1));
  }, [layoutMode]);

  const handleToday = useCallback(() => {
    setCurrentMonth(new Date());
  }, []);

  const title =
    layoutMode === "week"
      ? `${format(calendarDays[0], "d MMM")} - ${format(calendarDays[calendarDays.length - 1], "d MMM yyyy")}`
      : format(currentMonth, "MMMM yyyy");

  const dayCellMinHeight = layoutMode === "week" ? 750 : 92;

  const handleOpenQuickAdd = useCallback((dateKey: string) => {
    setQuickAddDateKey(dateKey);
    setQuickAddTitle("");
  }, []);

  const handleCloseQuickAdd = useCallback(() => {
    setQuickAddDateKey(null);
    setQuickAddTitle("");
  }, []);

  const handleQuickAddSubmit = useCallback(() => {
    if (!quickAddDateKey || columns.length === 0) return;

    const trimmedTitle = quickAddTitle.trim();
    if (!trimmedTitle) return;

    const dateKeyToSubmit = quickAddDateKey;
    const columnIdToSubmit = columns.length > 0 ? resolveStateId(columns[0]) : "";
    setQuickAddDateKey(null);
    setQuickAddTitle("");

    onAddCard(columnIdToSubmit, trimmedTitle, createCalendarDueDate(dateKeyToSubmit));
  }, [quickAddDateKey, columns, quickAddTitle, onAddCard]);

  const handleOpenAddItemMenu = useCallback((dateKey: string) => {
    setAddItemMenuDateKey(dateKey);
  }, []);

  const handleAddItem = useCallback((dateKey: string) => {
    setAddItemMenuDateKey(null);
    setExistingDialogDateKey(null);
    handleOpenQuickAdd(dateKey);
  }, [handleOpenQuickAdd]);

  const handleAddExistingItem = useCallback((dateKey: string) => {
    setAddItemMenuDateKey(null);
    setExistingDialogDateKey(dateKey);
    setExistingSearch("");
    setSelectedExistingItemIds([]);
  }, []);

  const handleCloseExistingDialog = useCallback(() => {
    setExistingDialogDateKey(null);
    setExistingSearch("");
    setSelectedExistingItemIds([]);
  }, []);

  const handleToggleExistingItem = useCallback((itemId: string) => {
    setSelectedExistingItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  }, []);

  const handleSubmitExistingItems = useCallback(() => {
    if (!existingDialogDateKey || selectedExistingItemIds.length === 0) return;

    onAssignExistingItems(
      selectedExistingItemIds,
      createCalendarDueDate(existingDialogDateKey),
    );
    handleCloseExistingDialog();
  }, [existingDialogDateKey, selectedExistingItemIds, onAssignExistingItems, handleCloseExistingDialog]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = event.active.data.current?.item;
    if (item) {
      setActiveItem(item);
      setDraggedWidth(event.active.rect.current.initial?.width ?? null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveItem(null);
    setDraggedWidth(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = String(active.id);
    const dateKey = String(over.id);

    const item = items.find((t) => t.id === itemId);
    if (!item) return;

    const currentDueDateKey = getCalendarDateKey(item.dueDate);
    const isMovingForward = currentDueDateKey && dateKey > currentDueDateKey;

    if (isMovingForward) {
      // Design: if moving forward, preserve start date
      onAssignExistingItems(
        [itemId],
        createCalendarDueDate(dateKey),
        true,
        item.startDate,
      );
    } else {
      // Design: if moving backward, only keep the end date (clear start date)
      onAssignExistingItems([itemId], createCalendarDueDate(dateKey), true, null);
    }
  }, [onAssignExistingItems, items]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 w-full h-full overflow-hidden bg-background">
        {/* Calendar Header Toolbar */}
        <div className="h-11 px-4 flex items-center justify-between bg-background border-b border-border shrink-0 select-none">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              aria-label="Previous period"
              className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-4 shrink-0" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              aria-label="Next period"
              className="size-7 rounded-md text-foreground hover:bg-muted cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ChevronRight className="size-4 shrink-0" />
            </Button>
            <div className="flex items-center gap-2 pl-1">
              <h3 className="text-14 font-semibold tracking-tight text-foreground">
                {title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToday}
              className="h-7 px-2.5 text-13 font-medium text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer select-none relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              Today
            </button>

            <DropdownMenu open={optionsOpen} onOpenChange={setOptionsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-7 px-2.5 flex items-center gap-1 text-13 font-medium text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-2 md:before:hidden",
                    optionsOpen && "bg-muted"
                  )}
                >
                  <span>Options</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-foreground transition-transform duration-150 shrink-0",
                      optionsOpen && "rotate-180"
                    )}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 p-1 rounded-md border border-border bg-popover shadow-overlay z-50"
              >
                <DropdownMenuItem
                  onClick={() => setLayoutMode("month")}
                  className="flex items-center justify-between px-2.5 py-1.5 text-13 text-foreground hover:bg-muted rounded cursor-pointer select-none"
                >
                  <span>Month layout</span>
                  {layoutMode === "month" && (
                    <Check className="size-4 text-foreground shrink-0 ml-auto" strokeWidth={1.5} />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLayoutMode("week")}
                  className="flex items-center justify-between px-2.5 py-1.5 text-13 text-foreground hover:bg-muted rounded cursor-pointer select-none"
                >
                  <span>Week layout</span>
                  {layoutMode === "week" && (
                    <Check className="size-4 text-foreground shrink-0 ml-auto" strokeWidth={1.5} />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Scrollable Calendar Grid (Unified 7-Column Grid with sleek custom scrollbar) */}
        <div className="flex-1 overflow-auto vertical-scrollbar custom-scrollbar">
          <div className="min-h-full min-w-[560px] bg-background">
            {/* Week Day Labels (Row 1 of Grid - Sticky header - NO bottom line per design) */}
            <div className="grid grid-cols-7 bg-muted/50 dark:bg-muted/20 sticky top-0 z-20 backdrop-blur-sm">
              {WEEK_DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="h-8 px-3 flex items-center justify-end text-11 font-semibold text-muted-foreground [&:not(:nth-child(7n))]:border-r border-border select-none"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar Weeks */}
            {calendarWeeks.map((weekDays) => {
              const weekDayKeys = weekDays.map((d) => format(d, DATE_KEY_FORMAT));
              const weekStartKey = weekDayKeys[0];

              return (
                <div key={weekStartKey} className="border-b border-border">
                  {/* Calendar Days in this week */}
                  <div className="grid grid-cols-7">
                    {weekDays.map((day) => {
                      const dateKey = format(day, DATE_KEY_FORMAT);
                      const dayItems = singleDayItemsByDate.get(dateKey) || [];
                      const isQuickAdding = quickAddDateKey === dateKey;
                      const isCurrentMonth =
                        layoutMode === "week"
                          ? isSameWeek(day, currentMonth, { weekStartsOn: 1 })
                          : isSameMonth(day, currentMonth);
                      const isThisToday = isToday(day);
                      const dayTextClass = !isCurrentMonth
                        ? "text-muted-foreground"
                        : "text-foreground";

                      return (
                        <CalendarDayCell
                          key={dateKey}
                          dateKey={dateKey}
                          day={day}
                          dayItems={dayItems}
                          isQuickAdding={isQuickAdding}
                          isCurrentMonth={isCurrentMonth}
                          isThisToday={isThisToday}
                          dayTextClass={dayTextClass}
                          dayCellMinHeight={dayCellMinHeight}
                          layoutMode={layoutMode}
                          onOpenCardDetail={onOpenCardDetail}
                          handleOpenAddItemMenu={handleOpenAddItemMenu}
                          addItemMenuDateKey={addItemMenuDateKey}
                          isAddItemMenuOpen={addItemMenuDateKey === dateKey}
                          onSetAddItemMenuDateKey={setAddItemMenuDateKey}
                          onAddWorkItem={handleAddItem}
                          onAddExistingWorkItem={handleAddExistingItem}
                          quickAddTitle={quickAddTitle}
                          onSetQuickAddTitle={setQuickAddTitle}
                          onQuickAddSubmit={handleQuickAddSubmit}
                          onCloseQuickAdd={handleCloseQuickAdd}
                          isAddingCard={isAddingCard}
                          columns={columns}
                          isReadOnly={isReadOnly}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Dialog
          open={Boolean(existingDialogDateKey)}
          onOpenChange={(open) => {
            if (!open) handleCloseExistingDialog();
          }}
        >
          <DialogContent className="w-145 max-w-[90vw] overflow-hidden rounded-md border border-border p-0 shadow-raised-200" showCloseButton={false}>
            <DialogHeader className="sr-only">
              <DialogTitle>Add existing items to date</DialogTitle>
              <DialogDescription>
                Search and select existing work items to schedule on this date.
              </DialogDescription>
            </DialogHeader>
            {/* Search bar */}
            <div className="px-2 pt-6 pb-2">
              <div className="relative flex items-center">
                <Search className="absolute left-4 size-5 text-foreground shrink-0" strokeWidth={1.75} />
                <input
                  type="text"
                  value={existingSearch}
                  onChange={(event) => setExistingSearch(event.target.value)}
                  placeholder="Type to search"
                  autoFocus
                  className="h-10 w-full pl-13 pr-3 text-13 font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground focus:border-border"
                />
              </div>
            </div>

            {/* Selected chips */}
            {selectedExistingItemIds.length > 0 && (
              <div className="mt-1.5 flex min-h-9 flex-wrap items-center gap-2 px-5 py-2">
                {selectedExistingItemIds.map((itemId) => {
                  const selectedItem = existingItemCandidates.find(
                    (item) => item.id === itemId,
                  );
                  if (!selectedItem) return null;
                  return (
                    <button
                      key={itemId}
                      type="button"
                      onClick={() => handleToggleExistingItem(itemId)}
                      className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      title={selectedItem.title || "Untitled"}
                    >
                      <span className="max-w-45 truncate">
                        {selectedItem.title || "Untitled"}
                      </span>
                      <X className="size-3 text-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Item list */}
            <div className="max-h-80 overflow-y-auto px-1 py-2">
              {filteredExistingItemCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-foreground">
                  <Search className="size-8 mb-2 opacity-20 shrink-0" strokeWidth={1.5} />
                  <p className="text-sm font-medium">No work items found</p>
                </div>
              ) : (
                filteredExistingItemCandidates.map((item) => {
                  const checked = selectedExistingItemIds.includes(item.id);

                  return (
                    <div key={item.id} className="px-2">
                      <button
                        type="button"
                        onClick={() => handleToggleExistingItem(item.id)}
                        className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          aria-label={`Select ${item.title}`}
                          className="size-4 shrink-0 rounded-sm border-border bg-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <div className="flex flex-1 items-center gap-2.5 min-w-0">
                          {(() => {
                            const col = columns.find(c => c.id === item.columnId);
                            if (!col) return null;
                            return (
                              <span className="shrink-0 text-xs font-medium text-foreground bg-muted px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                                {col.title}
                              </span>
                            );
                          })()}
                          <span className="min-w-0 flex-1 truncate text-13 font-medium text-foreground">
                            {item.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenCardDetail(item);
                          }}
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1 md:before:hidden"
                          aria-label="Open item detail"
                        >
                          <ChevronRight className="size-3.5 shrink-0" />
                        </button>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
              <div className="mt-1 flex items-center justify-between px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  if (allFilteredItemsSelected) {
                    const visibleIds = new Set(
                      filteredExistingItemCandidates.map((item) => item.id),
                    );
                    setSelectedExistingItemIds((prev) =>
                      prev.filter((id) => !visibleIds.has(id)),
                    );
                  } else {
                    const visibleIds = filteredExistingItemCandidates.map(
                      (item) => item.id,
                    );
                    setSelectedExistingItemIds((prev) =>
                      Array.from(new Set([...prev, ...visibleIds])),
                    );
                  }
                }}
                disabled={filteredExistingItemCandidates.length === 0}
                className="h-8 rounded-md px-2 text-12 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-ring"
              >
                {allFilteredItemsSelected ? "Deselect all" : "Select all"}
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCloseExistingDialog}
                  className="h-8 px-3 text-12 text-foreground hover:bg-muted rounded-md focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitExistingItems}
                  disabled={selectedExistingItemIds.length === 0}
                  className="h-8 min-w-17.5 bg-primary px-3 text-12 font-medium text-primary-foreground shadow-none hover:bg-primary-hover disabled:opacity-30 rounded-md focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isMounted && createPortal(
        <DragOverlay>
          {activeItem ? (
            <div 
              style={{ width: draggedWidth ?? 'auto' }} 
              className="bg-card border border-border rounded-md overflow-hidden opacity-90"
            >
              <div className="relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium leading-tight text-foreground">
                <span
                  className="absolute left-0 top-1/2 h-5.5 w-0.5 -translate-y-1/2 rounded-r-full"
                  style={{ backgroundColor: resolveStateColor(activeItem.columnId) }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {activeItem.title}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
});

interface CalendarDayCellProps {
  dateKey: string;
  day: Date | null;
  dayItems: Item[];
  isQuickAdding: boolean;
  isCurrentMonth: boolean;
  isThisToday: boolean;
  dayTextClass?: string;
  dayCellMinHeight: string | number;
  layoutMode: string;
  onOpenCardDetail: (item: Item) => void;
  handleOpenAddItemMenu: (dateKey: string) => void;
  addItemMenuDateKey: string | null;
  isAddItemMenuOpen?: boolean;
  onSetAddItemMenuDateKey: (dateKey: string | null) => void;
  onAddWorkItem: (dateKey: string) => void;
  onAddExistingWorkItem: (dateKey: string) => void;
  onSetQuickAddTitle: (title: string) => void;
  onQuickAddSubmit: () => void;
  onCloseQuickAdd: () => void;
  isAddingCard?: boolean;
  columns: Column[];
  isReadOnly?: boolean;
  quickAddTitle?: string;
}

const CalendarDayCell = memo(({
  dateKey,
  day,
  dayItems,
  isQuickAdding,
  isCurrentMonth,
  isThisToday,
  dayTextClass,
  dayCellMinHeight,
  layoutMode,
  onOpenCardDetail,
  handleOpenAddItemMenu,
  addItemMenuDateKey,
  onSetAddItemMenuDateKey,
  onAddWorkItem,
  onAddExistingWorkItem,
  onSetQuickAddTitle,
  onQuickAddSubmit,
  onCloseQuickAdd,
  isAddingCard,
  columns,
  isReadOnly,
  quickAddTitle = '',
}: CalendarDayCellProps) => {
  const isAddItemMenuOpen = addItemMenuDateKey === dateKey;
  const isFirstDayOfMonth = day ? day.getDate() === 1 : false;
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  });

  return (
    <div
      ref={setNodeRef}
      style={layoutMode === "week" ? { minHeight: dayCellMinHeight } : undefined}
      className={cn(
        "group flex flex-col transition-colors [&:not(:nth-child(7n))]:border-r border-border p-1.5 min-h-0",
        layoutMode === "month" && "aspect-[1.618/1] min-h-[92px]",
        !isCurrentMonth
          ? "bg-muted/50 dark:bg-muted/20 text-muted-foreground"
          : "bg-background text-foreground",
        isOver && "bg-muted/60 ring-1 ring-inset ring-ring"
      )}
    >
      {/* Date Header directly at top of Day Cell - NO border below */}
      {day && (
        <div className="h-6 px-1 flex items-center justify-end gap-1.5 select-none shrink-0 mb-1">
          {isFirstDayOfMonth && (
            <span
              className={cn(
                "text-11 font-medium",
                !isCurrentMonth ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {format(day, "MMM")}
            </span>
          )}
          {isThisToday ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-11 font-mono font-medium text-primary-foreground tabular-nums">
              {format(day, "d")}
            </span>
          ) : (
            <span
              className={cn(
                "text-11 font-mono font-medium leading-none tabular-nums",
                !isCurrentMonth ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {format(day, "d")}
            </span>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <div
          className={cn(
            "space-y-1 overflow-y-auto custom-scrollbar flex-1 min-h-0",
            layoutMode === "week" ? "max-h-175" : "max-h-full"
          )}
        >
          {dayItems.map((item: Item) => (
            <CalendarItem
              key={item.id}
              item={item}
              onOpenCardDetail={onOpenCardDetail}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>

        {!isReadOnly && !isQuickAdding && (
          <DropdownMenu
            open={isAddItemMenuOpen}
            onOpenChange={(open) => {
              if (!open && isAddItemMenuOpen) {
                onSetAddItemMenuDateKey(null);
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={() => handleOpenAddItemMenu(dateKey)}
                className={cn(
                  dayItems.length > 0 ? "mt-1" : "mt-0",
                  "flex h-6 w-full items-center gap-1.5 rounded-md px-1.5 text-11 font-medium text-foreground transition-colors hover:bg-muted cursor-pointer",
                  "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto"
                )}
              >
                <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.75} />
                <span>Add work item</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-44 rounded-md border border-border bg-popover p-1 text-xs shadow-overlay"
            >
              <DropdownMenuItem
                onSelect={() => onAddWorkItem(dateKey)}
                className="rounded-md px-2.5 py-1.5 text-11 font-medium text-foreground flex items-center gap-2 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-muted"
              >
                <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.75} />
                <span>Add work item</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onAddExistingWorkItem(dateKey)}
                className="rounded-md px-2.5 py-1.5 text-11 font-medium text-foreground flex items-center gap-2 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-muted"
              >
                <FolderKanban className="size-3.5 text-foreground shrink-0" strokeWidth={1.75} />
                <span>Add existing</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {isQuickAdding && (
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="relative flex w-full items-center rounded-md border border-border bg-background focus-within:border-ring">
              <input
                type="text"
                autoFocus
                value={quickAddTitle}
                onChange={(event) => onSetQuickAddTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onQuickAddSubmit();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCloseQuickAdd();
                  }
                }}
                placeholder="Title..."
                className="h-6.5 min-w-0 flex-1 bg-transparent px-2 text-11 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                disabled={isAddingCard}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-11 font-medium bg-primary hover:bg-primary-hover text-primary-foreground rounded-md cursor-pointer shadow-none"
                onClick={onQuickAddSubmit}
                disabled={!quickAddTitle.trim() || columns.length === 0 || isAddingCard}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-11 font-medium rounded-md hover:bg-muted cursor-pointer text-foreground"
                onClick={onCloseQuickAdd}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const CalendarItem = memo(({
  item,
  onOpenCardDetail,
  isReadOnly,
}: {
  item: Item;
  onOpenCardDetail: (item: Item) => void;
  isReadOnly?: boolean;
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columnColor = resolveStateColor(item.columnId);

  const startKey = getCalendarDateKey(item.startDate);
  const dueKey = getCalendarDateKey(item.dueDate);
  const hasDateRange = Boolean(startKey && dueKey && startKey !== dueKey);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: isReadOnly,
    data: {
      type: "Item",
      item,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setIsPreviewOpen(true);
    }, 450);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsPreviewOpen(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Popover open={isPreviewOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => onOpenCardDetail(item)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
              "group relative flex w-full flex-col gap-0.5 rounded-md border border-border bg-card px-2 py-1 text-left text-12 font-medium leading-tight text-foreground transition-colors hover:bg-muted cursor-pointer min-h-7 justify-center",
              isDragging && "z-50 opacity-40 border-primary"
            )}
          >
            <span
              className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full"
              style={{ backgroundColor: columnColor }}
            />
            <div className="flex w-full items-center gap-1.5 min-w-0 pl-1">
              {item.identifier && (
                <span className="font-mono text-10 font-semibold text-muted-foreground shrink-0">
                  {item.identifier}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate transition-colors">
                {item.title}
              </span>
            </div>
            {hasDateRange && item.startDate && item.dueDate && (
              <div className="flex items-center gap-1 pl-1 text-10 text-muted-foreground font-mono">
                <CalendarIcon className="size-2.5 shrink-0" />
                <span className="truncate">
                  {formatDate(item.startDate)} → {formatDate(item.dueDate)}
                </span>
              </div>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-80 border-none bg-transparent p-0 shadow-none"
          onOpenAutoFocus={(e: Event) => e.preventDefault()}
        >
          <div className="pointer-events-none">
            <CalendarCard card={item} isReadOnly={isReadOnly} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

export default CalendarView;
