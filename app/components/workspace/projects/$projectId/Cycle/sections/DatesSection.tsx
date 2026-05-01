import React, { useState, useEffect, useMemo } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from "lucide-react";
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, eachDayOfInterval, isToday,
  isAfter, isBefore, parseISO, addYears, subYears,
  startOfDay
} from "date-fns";

interface DatesSectionProps {
  formStart: string;
  formEnd: string;
  setFormStart: (date: string) => void;
  setFormEnd: (date: string) => void;
  trigger?: React.ReactNode;
}

const CycleCalendar = ({ selectedStart, selectedEnd, onSelectStart, onSelectEnd }: { 
  selectedStart: string, 
  selectedEnd: string, 
  onSelectStart: (d: string) => void, 
  onSelectEnd: (d: string) => void 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Initialize currentMonth based on existing selection
  useEffect(() => {
    if (selectedStart) {
      try {
        setCurrentMonth(parseISO(selectedStart));
      } catch (e) {
        console.error("Invalid start date", e);
      }
    }
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleDateClick = (day: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(day, today)) return;

    const dateStr = format(day, "yyyy-MM-dd");
    
    if (!selectedStart || (selectedStart && selectedEnd && selectedStart !== selectedEnd)) {
      // Start fresh
      onSelectStart(dateStr);
      onSelectEnd(dateStr); // Default end = start
    } else {
      // Selecting end date
      const start = parseISO(selectedStart);
      if (isBefore(day, start)) {
        onSelectStart(dateStr);
        onSelectEnd(dateStr);
      } else {
        onSelectEnd(dateStr);
      }
    }
  };

  return (
    <div className="p-4 w-[320px] bg-white rounded-xl shadow-2xl border border-border/50 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100 transition-colors" onClick={() => setCurrentMonth(subYears(currentMonth, 1))}>
            <ChevronsLeft className="size-4 text-[#44546f]" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100 transition-colors" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="size-4 text-[#44546f]" />
          </Button>
        </div>
        <span className="text-[14px] font-bold text-[#172b4d]">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100 transition-colors" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="size-4 text-[#44546f]" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100 transition-colors" onClick={() => setCurrentMonth(addYears(currentMonth, 1))}>
            <ChevronsRight className="size-4 text-[#44546f]" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
          <div key={d} className="text-[10px] font-bold text-[#5e6c84] text-center uppercase tracking-wider">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isStart = selectedStart === dateStr;
          const isEnd = selectedEnd === dateStr;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, startOfDay(new Date()));
          
          let inRange = false;
          if (selectedStart && selectedEnd) {
            inRange = isAfter(day, parseISO(selectedStart)) && isBefore(day, parseISO(selectedEnd));
          } else if (selectedStart && hoverDate) {
            const start = parseISO(selectedStart);
            const hover = parseISO(hoverDate);
            if (isAfter(hover, start)) {
              inRange = isAfter(day, start) && isBefore(day, hover);
            }
          }

          return (
            <div key={i} className="relative py-[2px]">
              <button
                onClick={() => handleDateClick(day)}
                onMouseEnter={() => !isPast && setHoverDate(dateStr)}
                onMouseLeave={() => setHoverDate(null)}
                className={`
                  h-9 w-full flex items-center justify-center text-[13px] transition-all relative z-10
                  text-[#172b4d] font-medium
                  ${isStart || isEnd 
                    ? "bg-[#0c66e4] text-white font-bold shadow-md rounded-md cursor-pointer" 
                    : (!isPast ? "cursor-pointer hover:bg-[#091e420f] rounded-md" : "!cursor-default")
                  }
                  ${inRange ? "!rounded-none !bg-[#e9f2ff] !text-[#0c66e4]" : ""}
                  ${isStart && (selectedEnd || (hoverDate && isAfter(parseISO(hoverDate), parseISO(selectedStart)))) && selectedStart !== selectedEnd ? "!rounded-r-none" : ""}
                  ${isEnd && selectedStart && selectedStart !== selectedEnd ? "!rounded-l-none" : ""}
                `}
              >
                {isToday(day) && !isStart && !isEnd && (
                  <div className="absolute bottom-1 size-1 bg-[#0c66e4] rounded-full" />
                )}
                {format(day, "d")}
              </button>
              {inRange && <div className="absolute inset-y-[2px] inset-x-0 bg-[#e9f2ff] z-0" />}
              {isStart && selectedEnd && selectedStart !== selectedEnd && <div className="absolute inset-y-[2px] right-0 w-1/2 bg-[#e9f2ff] z-0" />}
              {isEnd && selectedStart && selectedStart !== selectedEnd && <div className="absolute inset-y-[2px] left-0 w-1/2 bg-[#e9f2ff] z-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DatesSection = ({ formStart, formEnd, setFormStart, setFormEnd, trigger }: DatesSectionProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger || (
          <button className="h-10 rounded-sm border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] hover:bg-[#f7f7f7] flex items-center gap-2 transition-colors outline-none">
            <CalendarDays className="size-4 text-[#44546f]" />
            Dates
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 border-0 bg-transparent shadow-none w-auto z-140" sideOffset={8}>
        <CycleCalendar 
          selectedStart={formStart} 
          selectedEnd={formEnd} 
          onSelectStart={setFormStart} 
          onSelectEnd={setFormEnd} 
        />
      </PopoverContent>
    </Popover>
  );
};

// Also export CycleCalendar for reuse in the display section
export { CycleCalendar };
