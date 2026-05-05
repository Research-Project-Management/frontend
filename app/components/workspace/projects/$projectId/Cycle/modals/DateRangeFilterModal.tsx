import React, { useState, useMemo, useEffect } from "react";
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, eachDayOfInterval, isToday,
  isAfter, isBefore, parseISO, startOfDay, addYears, subYears
} from "date-fns";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";

interface DoubleCalendarProps {
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
  onCancel: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DoubleCalendarModal = ({
  startDate,
  endDate,
  onApply,
  onCancel,
  open,
  onOpenChange
}: DoubleCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStart, setSelectedStart] = useState<string>(startDate || "");
  const [selectedEnd, setSelectedEnd] = useState<string>(endDate || "");
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync internal state with props when modal opens
  useEffect(() => {
    if (open) {
      setSelectedStart(startDate || "");
      setSelectedEnd(endDate || "");
      if (startDate) {
        try {
          setCurrentMonth(parseISO(startDate));
        } catch (e) {}
      }
    }
  }, [open, startDate, endDate]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleDateClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    
    if (!selectedStart || (selectedStart && selectedEnd && selectedStart !== selectedEnd)) {
      setSelectedStart(dateStr);
      setSelectedEnd(dateStr);
    } else {
      const start = parseISO(selectedStart);
      if (isBefore(day, start)) {
        setSelectedStart(dateStr);
        setSelectedEnd(dateStr);
      } else {
        setSelectedEnd(dateStr);
      }
    }
  };

  const handleApply = () => {
    if (selectedStart && selectedEnd) {
      onApply(selectedStart, selectedEnd);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[360px] p-0 overflow-hidden rounded-sm border-0 shadow-2xl bg-white">
        <div className="p-4 w-full bg-white animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100" onClick={() => setCurrentMonth(subYears(currentMonth, 1))}>
                <ChevronsLeft className="size-4 text-[#44546f]" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="size-4 text-[#44546f]" />
              </Button>
            </div>
            <span className="text-[14px] font-bold text-[#172b4d]">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="size-4 text-[#44546f]" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8 hover:bg-gray-100" onClick={() => setCurrentMonth(addYears(currentMonth, 1))}>
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
                    onMouseEnter={() => setHoverDate(dateStr)}
                    onMouseLeave={() => setHoverDate(null)}
                    className={`
                      h-9 w-full flex items-center justify-center text-[13px] transition-all relative z-10
                      ${isCurrentMonth ? "text-[#172b4d]" : "text-zinc-300 pointer-events-none"} font-medium
                      ${isStart || isEnd 
                        ? "bg-black text-white font-bold shadow-md rounded-md cursor-pointer" 
                        : "cursor-pointer hover:bg-zinc-100 rounded-md"
                      }
                      ${inRange ? "!rounded-none !bg-zinc-100 !text-black" : ""}
                      ${isStart && selectedEnd && selectedStart !== selectedEnd ? "!rounded-r-none" : ""}
                      ${isEnd && selectedStart && selectedStart !== selectedEnd ? "!rounded-l-none" : ""}
                    `}
                  >
                    {isToday(day) && !isStart && !isEnd && (
                      <div className="absolute bottom-1 size-1 bg-black rounded-full" />
                    )}
                    {format(day, "d")}
                  </button>
                  {inRange && <div className="absolute inset-y-[2px] inset-x-0 bg-zinc-100 z-0" />}
                  {isStart && selectedEnd && selectedStart !== selectedEnd && <div className="absolute inset-y-[2px] right-0 w-1/2 bg-zinc-100 z-0" />}
                  {isEnd && selectedStart && selectedStart !== selectedEnd && <div className="absolute inset-y-[2px] left-0 w-1/2 bg-zinc-100 z-0" />}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 text-[#44546f] hover:bg-gray-100 font-medium px-4">
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} className="h-8 bg-black hover:bg-black/90 text-white font-bold px-6 shadow-sm transition-all active:scale-95">
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
