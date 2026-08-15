'use client';

import { useState, useRef } from "react";
import { Search, Filter, Plus, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui";
import { addWeeks, addMonths, startOfDay, format } from "date-fns";
import { DoubleCalendarModal } from "../modals/DateRangeFilterModal";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

interface TopBarProps {
  onAddCycle: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  dateFilters: {
    startDate?: { start: string; end: string; label: string };
    dueDate?: { start: string; end: string; label: string };
  };
  onDateFilterChange: (filters: any) => void;
}

export default function TopBar({
  onAddCycle,
  searchQuery = "",
  onSearchChange,
  dateFilters,
  onDateFilterChange,
}: TopBarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [customDateType, setCustomDateType] = useState<"startDate" | "dueDate" | null>(null);
  const [isStartExpanded, setIsStartExpanded] = useState(true);
  const [isDueExpanded, setIsDueExpanded] = useState(true);
  
  // Local state for searching options within the popover
  const [optionSearch, setOptionSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startOptions = [
    { label: "1 week from now", value: "1w", days: 7 },
    { label: "2 weeks from now", value: "2w", days: 14 },
    { label: "1 month from now", value: "1m", months: 1 },
    { label: "2 months from now", value: "2m", months: 2 },
  ];

  const dueOptions = [
    { label: "1 week from now", value: "1w", days: 7 },
    { label: "2 weeks from now", value: "2w", days: 14 },
    { label: "1 month from now", value: "1m", months: 1 },
    { label: "2 months from now", value: "2m", months: 2 },
  ];

  const filteredStartOptions = startOptions.filter(opt => 
    opt.label.toLowerCase().includes(optionSearch.toLowerCase())
  );
  
  const filteredDueOptions = dueOptions.filter(opt => 
    opt.label.toLowerCase().includes(optionSearch.toLowerCase())
  );

  const showCustomStart = "custom".includes(optionSearch.toLowerCase());
  const showCustomDue = "custom".includes(optionSearch.toLowerCase());

  const showStartSection = filteredStartOptions.length > 0 || showCustomStart;
  const showDueSection = filteredDueOptions.length > 0 || showCustomDue;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-sm overflow-hidden group",
          isSearchExpanded || searchQuery ? "w-48 border border-border bg-background" : "w-8 hover:bg-muted cursor-pointer"
        )}
        onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
      >
        <div className="flex items-center justify-center w-8 shrink-0">
          <Search 
            className="size-3.5 text-foreground"
          />
        </div>
        <Input
          ref={inputRef}
          placeholder="Search by title"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onBlur={() => !searchQuery && setIsSearchExpanded(false)}
          className={cn(
            "h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground transition-all pr-8 text-foreground",
            isSearchExpanded || searchQuery ? "opacity-100 pl-0" : "opacity-0 pointer-events-none"
          )}
          autoFocus={isSearchExpanded}
        />
        {(isSearchExpanded || searchQuery) && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onSearchChange?.("");
              setIsSearchExpanded(false);
            }}
            className="absolute right-2.5 text-foreground hover:text-foreground/70 transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <Plus className="size-3.5 rotate-45 text-foreground" />
          </button>
        )}
      </div>

      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-3 rounded-sm border border-border text-foreground hover:bg-muted shadow-none bg-background cursor-pointer"
          >
            <Filter className="size-3.5 mt-[1px] text-foreground" />
            <span className="text-xs font-medium text-foreground">Filters</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-64 p-0 rounded-sm border-border shadow-lg z-[100] overflow-hidden bg-popover"
        >
          <div className="px-2 pt-2 pb-1 bg-muted/30">
             <div className="relative flex items-center h-8 rounded-sm border border-border bg-background overflow-hidden focus-within:border-border/80 transition-colors">
                <Search className="absolute left-2.5 size-3.5 text-foreground" />
                <input
                  type="text"
                  value={optionSearch}
                  onChange={(e) => setOptionSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-full w-full pl-8 pr-2 text-[13px] bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
                />
             </div>
          </div>

          <div className="px-2 pb-2 pt-1 space-y-1">
            {/* Start Date */}
            {showStartSection && (
              <div className="px-1 pb-2 border-b border-border">
                <button
                  onClick={() => setIsStartExpanded(!isStartExpanded)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-[13px] font-bold text-muted-foreground hover:text-foreground"
                >
                  <span>Start date</span>
                  {isStartExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>
                
                {isStartExpanded && (
                  <div className="space-y-0.5 mt-0.5">
                    {filteredStartOptions.map((opt) => {
                      const isActive = dateFilters.startDate?.label === opt.label;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => {
                            const start = startOfDay(new Date());
                            const end = opt.days 
                              ? addWeeks(start, opt.days / 7) 
                              : addMonths(start, opt.months || 0);
                            onDateFilterChange({
                              ...dateFilters,
                              startDate: isActive ? undefined : {
                                start: format(start, "yyyy-MM-dd"),
                                end: format(end, "yyyy-MM-dd"),
                                label: opt.label
                              }
                            });
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors cursor-pointer",
                            isActive ? "bg-accent text-foreground" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "size-4 rounded-sm border border-border flex items-center justify-center transition-all",
                            isActive ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                          )}>
                            {isActive && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                          </div>
                          <span className="font-medium">{opt.label}</span>
                        </button>
                      );
                    })}
                    {showCustomStart && (
                      <button
                        onClick={() => setCustomDateType("startDate")}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors cursor-pointer",
                          dateFilters.startDate?.label === "Custom" ? "bg-accent text-foreground" : "text-foreground hover:bg-muted"
                        )}
                      >
                         <div className={cn(
                            "size-4 rounded-sm border border-border flex items-center justify-center transition-all",
                            dateFilters.startDate?.label === "Custom" ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                          )}>
                            {dateFilters.startDate?.label === "Custom" && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                          </div>
                        <span className="font-medium">Custom</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Due Date */}
            {showDueSection && (
              <div className="px-1 mt-2">
                 <button
                  onClick={() => setIsDueExpanded(!isDueExpanded)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-[13px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span>End date</span>
                  {isDueExpanded ? <ChevronUp className="size-3.5 text-foreground" /> : <ChevronDown className="size-3.5 text-foreground" />}
                </button>
                
                {isDueExpanded && (
                  <div className="space-y-0.5 mt-0.5">
                    {filteredDueOptions.map((opt) => {
                      const isActive = dateFilters.dueDate?.label === opt.label;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => {
                            const start = startOfDay(new Date());
                            const end = opt.days 
                              ? addWeeks(start, opt.days / 7) 
                              : addMonths(start, opt.months || 0);
                            onDateFilterChange({
                              ...dateFilters,
                              dueDate: isActive ? undefined : {
                                start: format(start, "yyyy-MM-dd"),
                                end: format(end, "yyyy-MM-dd"),
                                label: opt.label
                              }
                            });
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors cursor-pointer",
                            isActive ? "bg-accent text-foreground" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "size-4 rounded-sm border border-border flex items-center justify-center transition-all",
                            isActive ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                          )}>
                            {isActive && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                          </div>
                          <span className="font-medium">{opt.label}</span>
                        </button>
                      );
                    })}
                    {showCustomDue && (
                      <button
                        onClick={() => setCustomDateType("dueDate")}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors cursor-pointer",
                          dateFilters.dueDate?.label === "Custom" ? "bg-accent text-foreground" : "text-foreground hover:bg-muted"
                        )}
                      >
                         <div className={cn(
                            "size-4 rounded-sm border border-border flex items-center justify-center transition-all",
                            dateFilters.dueDate?.label === "Custom" ? "bg-primary border-primary text-primary-foreground" : "bg-background"
                          )}>
                            {dateFilters.dueDate?.label === "Custom" && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                          </div>
                        <span className="font-medium">Custom</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <DoubleCalendarModal 
        open={!!customDateType}
        onOpenChange={(open) => !open && setCustomDateType(null)}
        startDate={customDateType ? (dateFilters[customDateType]?.start || "") : ""}
        endDate={customDateType ? (dateFilters[customDateType]?.end || "") : ""}
        onApply={(start, end) => {
          if (customDateType) {
            onDateFilterChange({
              ...dateFilters,
              [customDateType]: { start, end, label: "Custom" }
            });
          }
          setCustomDateType(null);
        }}
        onCancel={() => setCustomDateType(null)}
      />


      <Button
        onClick={onAddCycle}
        size="sm"
        className="h-8 gap-1.5 rounded-sm px-3 text-xs shadow-none transition-all bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
      >
        <Plus className="size-3.5 text-primary-foreground" />
        Add Cycle
      </Button>
    </div>
  );
}
