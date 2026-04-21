import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  isWithinInterval,
  parseISO,
  setHours,
  setMinutes,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TaskRecurrence, TaskReminder } from "~/types/task";

const DEFAULT_DUE_TIME = "00:00";
const DUE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatDueTimeDraft(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isDueTimeDraftValid(value: string) {
  return value === "" || DUE_TIME_PATTERN.test(value);
}

function normalizeDueTime(value: string) {
  const formattedValue = formatDueTimeDraft(value);
  if (!formattedValue) return DEFAULT_DUE_TIME;
  if (DUE_TIME_PATTERN.test(formattedValue)) return formattedValue;
  const digits = formattedValue.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 4) return DEFAULT_DUE_TIME;
  const hours = Math.min(Number(digits.slice(0, 2)), 23);
  const minutes = Math.min(Number(digits.slice(2, 4)), 59);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function cloneCalendarDate(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isNestedOverlayTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest("[data-slot='select-content']") ||
      target.closest("[data-slot='select-trigger']") ||
      target.closest("[role='option']") ||
      target.closest("[role='listbox']")
  );
}

type ActionDateSectionProps = {
  actionBtnClass?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dueDate: string;
  setDueDate: (date: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  recurrence: TaskRecurrence;
  setRecurrence: (value: TaskRecurrence) => void;
  reminder: TaskReminder;
  setReminder: (value: TaskReminder) => void;
};

export function ActionDateSection({
  actionBtnClass,
  open,
  onOpenChange,
  dueDate,
  setDueDate,
  startDate,
  setStartDate,
  recurrence,
  setRecurrence,
  reminder,
  setReminder,
}: ActionDateSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dueTime, setDueTime] = useState(DEFAULT_DUE_TIME);
  const [hasStartDate, setHasStartDate] = useState(false);
  const [hasDueDate, setHasDueDate] = useState(false);
  const [activeInput, setActiveInput] = useState<"start" | "end">("end");
  const [tempRecurrence, setTempRecurrence] = useState<TaskRecurrence>("none");
  const [tempReminder, setTempReminder] = useState<TaskReminder>("1day");

  const resolvedActionBtnClass =
    actionBtnClass ??
    "h-10 rounded-sm border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] shadow-none hover:bg-[#f7f7f7]";

  useEffect(() => {
    if (!open) return;

    const dDate = dueDate ? parseISO(dueDate) : null;
    const sDate = startDate ? parseISO(startDate) : null;
    const validDDate = dDate && isValid(dDate) ? dDate : null;
    const validSDate = sDate && isValid(sDate) ? sDate : null;

    setTempEndDate(validDDate);
    setTempStartDate(validSDate);
    setHasStartDate(!!validSDate);
    setHasDueDate(!!validDDate);
    setTempRecurrence(recurrence || "none");
    setTempReminder(reminder || "1day");
    setActiveInput(validDDate ? "end" : validSDate ? "start" : "end");

    if (validDDate) {
      setDueTime(normalizeDueTime(format(validDDate, "HH:mm")));
      setCurrentMonth(validDDate);
    } else if (validSDate) {
      setDueTime(DEFAULT_DUE_TIME);
      setCurrentMonth(validSDate);
    } else {
      setDueTime(DEFAULT_DUE_TIME);
      setCurrentMonth(new Date());
    }
  }, [open, dueDate, startDate, recurrence, reminder]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [open]);

  const ensureStartDateEnabled = () => {
    const nextStartDate = tempStartDate ?? tempEndDate ?? cloneCalendarDate(currentMonth);
    setHasStartDate(true);
    setTempStartDate(nextStartDate);
    setActiveInput("start");
    if (tempEndDate && isAfter(nextStartDate, tempEndDate)) {
      setTempEndDate(null);
      setHasDueDate(false);
    }
  };

  const ensureDueDateEnabled = () => {
    const nextDueDate = tempEndDate ?? tempStartDate ?? cloneCalendarDate(currentMonth);
    setHasDueDate(true);
    setTempEndDate(nextDueDate);
    setDueTime((prev) => normalizeDueTime(prev));
    setActiveInput("end");
    if (tempStartDate && isAfter(tempStartDate, nextDueDate)) {
      setTempStartDate(null);
      setHasStartDate(false);
    }
  };

  const disableStartDate = () => {
    setHasStartDate(false);
    if (activeInput === "start") {
      setActiveInput("end");
    }
  };

  const disableDueDate = () => {
    setHasDueDate(false);
    if (activeInput === "end") {
      setActiveInput(hasStartDate ? "start" : "end");
    }
  };

  const handleSaveDate = () => {
    let finalDueDate = "";
    let finalStartDate = "";

    if (hasDueDate && tempEndDate) {
      const safeDueTime = normalizeDueTime(dueTime);
      const [hours, minutes] = safeDueTime.split(":").map(Number);
      const withTime = setMinutes(setHours(tempEndDate, hours || 0), minutes || 0);
      finalDueDate = withTime.toISOString();
    }

    if (hasStartDate && tempStartDate) {
      finalStartDate = tempStartDate.toISOString();
    }

    setRecurrence(hasDueDate ? tempRecurrence : "none");
    setReminder(hasDueDate ? tempReminder : "1day");
    setDueDate(finalDueDate);
    setStartDate(finalStartDate);
    onOpenChange(false);
  };

  const handleClearDate = () => {
    setTempEndDate(null);
    setTempStartDate(null);
    setHasStartDate(false);
    setHasDueDate(false);
    setDueTime(DEFAULT_DUE_TIME);
    setTempRecurrence("none");
    setTempReminder("1day");
    setActiveInput("end");
    setRecurrence("none");
    setReminder("1day");
    setDueDate("");
    setStartDate("");
    onOpenChange(false);
  };

  const handleDateClick = (day: Date) => {
    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(day);
    }

    if (activeInput === "start") {
      setTempStartDate(day);
      setHasStartDate(true);
      if (tempEndDate && isAfter(day, tempEndDate)) {
        setTempEndDate(null);
        setHasDueDate(false);
      }
      return;
    }

    setTempEndDate(day);
    setHasDueDate(true);
    if (tempStartDate && isBefore(day, tempStartDate)) {
      setTempStartDate(null);
      setHasStartDate(false);
    }
  };

  const hasValidDueTime = !hasDueDate || DUE_TIME_PATTERN.test(dueTime);
  const dueTimeError =
    hasDueDate && !isDueTimeDraftValid(dueTime)
      ? "Enter time in hh:mm format."
      : null;

  const canSaveDate =
    (!hasStartDate || !!tempStartDate) &&
    (!hasDueDate || (!!tempEndDate && hasValidDueTime));

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={
            open
              ? "h-10 rounded-sm border-none bg-[#4c525e] px-4 text-[15px] font-medium text-white shadow-none"
              : resolvedActionBtnClass
          }
        >
          <CalendarIcon className="mr-2 h-4 w-4" />Dates
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-214}
        collisionPadding={12}
        onInteractOutside={(e) => {
          if (isNestedOverlayTarget(e.target)) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          if (isNestedOverlayTarget(e.target)) {
            e.preventDefault();
          }
        }}
        className="z-120 flex w-80 min-h-0 flex-col overflow-hidden rounded-sm border-border/50 p-0 shadow-xl transition-all duration-200 ease-out"
        style={{ maxHeight: "min(82vh, 760px)" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-white px-4 py-3 shrink-0">
          <span className="text-sm font-semibold text-center flex-1">Dates</span>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-y-scroll overscroll-contain scrollbar-thin scrollbar-thumb-muted/40 transition-opacity duration-200 ease-out"
          onWheel={(e) => {
            const container = scrollContainerRef.current;
            if (!container) return;

            container.scrollTop += e.deltaY;
            e.preventDefault();
          }}
        >
          <div className="p-4 space-y-6">
            <div className="mb-2">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm font-bold">{format(currentMonth, "MMMM yyyy")}</span>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
                  <div key={d} className="text-[11px] font-bold text-center py-1 text-muted-foreground uppercase">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 transition-all">
                {calendarDays.map((day, i) => {
                  const isSelectedStart = tempStartDate && isSameDay(day, tempStartDate) && hasStartDate;
                  const isSelectedEnd = tempEndDate && isSameDay(day, tempEndDate) && hasDueDate;
                  const isInRange = tempStartDate && tempEndDate && hasStartDate && hasDueDate && isWithinInterval(day, { start: tempStartDate, end: tempEndDate });
                  const isActive =
                    (activeInput === "start" && isSameDay(day, tempStartDate || 0)) ||
                    (activeInput === "end" && isSameDay(day, tempEndDate || 0));

                  return (
                    <button
                      key={i}
                      onClick={() => handleDateClick(day)}
                      className={`h-9 text-sm flex items-center justify-center rounded-sm transition-all relative ${!isSameMonth(day, currentMonth) ? "text-muted-foreground/30" : "text-foreground hover:bg-zinc-100 cursor-pointer"} ${isInRange ? "bg-zinc-100 text-zinc-900" : ""} ${isSelectedStart || isSelectedEnd ? "bg-zinc-200 text-black font-bold" : ""} ${isActive ? "ring-2 ring-inset ring-black shadow-sm" : ""} ${isToday(day) && !isSelectedStart && !isSelectedEnd ? "text-black border-b-2 border-black rounded-none font-bold" : ""}`}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-muted-foreground">Start date</Label>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={hasStartDate}
                    onCheckedChange={(v) => {
                      if (v) {
                        ensureStartDateEnabled();
                        return;
                      }
                      disableStartDate();
                    }}
                    className="size-5 rounded-sm border-zinc-200 data-[state=checked]:bg-black data-[state=checked]:border-black"
                  />
                  <div className="flex items-center gap-2 grow">
                    <Input
                      placeholder="D/M/YYYY"
                      value={tempStartDate && hasStartDate ? format(tempStartDate, "d/M/yyyy") : ""}
                      onClick={ensureStartDateEnabled}
                      readOnly
                      className={`h-11 text-[15px] transition-all shadow-none cursor-pointer rounded-sm flex-1 ${activeInput === "start" ? "ring-2 ring-black/20 border-black bg-white" : "bg-[#091e4208] border-none"}`}
                    />
                    <div className="w-20 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-muted-foreground">Due date</Label>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={hasDueDate}
                    onCheckedChange={(v) => {
                      if (v) {
                        ensureDueDateEnabled();
                        return;
                      }
                      disableDueDate();
                    }}
                    className="size-5 rounded-sm border-zinc-200 data-[state=checked]:bg-black data-[state=checked]:border-black"
                  />

                  <div className="flex items-center gap-2 grow">
                    <Input
                      value={tempEndDate && hasDueDate ? format(tempEndDate, "d/M/yyyy") : ""}
                      onClick={ensureDueDateEnabled}
                      readOnly
                      className={`h-11 text-[15px] transition-all shadow-none flex-1 cursor-pointer rounded-sm ${activeInput === "end" ? "ring-2 ring-black/20 border-black bg-white" : "bg-[#091e4208] border-none"}`}
                    />

                    <Input
                      value={dueTime}
                      onChange={(e) => setDueTime(formatDueTimeDraft(e.target.value))}
                      onFocus={(e) => {
                        if (e.target.value === DEFAULT_DUE_TIME) {
                          setDueTime("");
                          e.target.select();
                        }
                      }}
                      onBlur={(e) => setDueTime(normalizeDueTime(e.target.value))}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedValue = e.clipboardData.getData("text");
                        setDueTime(formatDueTimeDraft(pastedValue));
                      }}
                      inputMode="numeric"
                      maxLength={5}
                      aria-invalid={!!dueTimeError}
                      disabled={!hasDueDate}
                      className={`h-11 text-[15px] focus-visible:ring-1 w-20 shrink-0 px-3 bg-white rounded-sm text-center disabled:cursor-not-allowed disabled:bg-[#091e4208] disabled:text-muted-foreground ${dueTimeError ? "border-destructive text-destructive focus-visible:ring-destructive/20" : "border-[#091e4224]"}`}
                    />
                  </div>
                </div>
                {dueTimeError ? <p className="pl-8 text-[12px] text-destructive">{dueTimeError}</p> : null}
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-muted-foreground">Recurrence</Label>
                <Select value={tempRecurrence} onValueChange={(value) => setTempRecurrence(value as TaskRecurrence)} disabled={!hasDueDate}>
                  <SelectTrigger disabled={!hasDueDate} className="h-11 text-[15px] border-[#d9d9d9] shadow-none rounded-sm bg-white w-full disabled:cursor-not-allowed disabled:bg-[#091e4208] disabled:text-muted-foreground">
                    <SelectValue placeholder="Never" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" className="z-140 rounded-sm border-border/50 shadow-xl max-h-75 overflow-y-auto">
                    <SelectItem value="none" className="py-2.5">Never</SelectItem>
                    <SelectItem value="daily" className="py-2.5">Daily</SelectItem>
                    <SelectItem value="mon-fri" className="py-2.5">Monday to Friday</SelectItem>
                    <SelectItem value="weekly" className="py-2.5">Weekly</SelectItem>
                    <SelectItem value="monthly-day" className="py-2.5">Monthly on day {format(tempEndDate || new Date(), "d")}</SelectItem>
                    <SelectItem value="monthly-week" className="py-2.5">Monthly on {format(tempEndDate || new Date(), "do EEEE")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-muted-foreground">Set reminder</Label>
                <Select value={tempReminder} onValueChange={(value) => setTempReminder(value as TaskReminder)} disabled={!hasDueDate}>
                  <SelectTrigger disabled={!hasDueDate} className="h-11 text-[15px] border-[#d9d9d9] shadow-none rounded-sm bg-white w-full disabled:cursor-not-allowed disabled:bg-[#091e4208] disabled:text-muted-foreground">
                    <SelectValue placeholder="1 Day before" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" className="z-140 rounded-sm border-border/50 shadow-xl max-h-75 overflow-y-auto">
                    <SelectItem value="none" className="py-2.5">None</SelectItem>
                    <SelectItem value="at-time" className="py-2.5">At time of due date</SelectItem>
                    <SelectItem value="5m" className="py-2.5">5 Minutes before</SelectItem>
                    <SelectItem value="10m" className="py-2.5">10 Minutes before</SelectItem>
                    <SelectItem value="15m" className="py-2.5">15 Minutes before</SelectItem>
                    <SelectItem value="1h" className="py-2.5">1 Hour before</SelectItem>
                    <SelectItem value="2h" className="py-2.5">2 Hours before</SelectItem>
                    <SelectItem value="1day" className="py-2.5">1 Day before</SelectItem>
                    <SelectItem value="2day" className="py-2.5">2 Days before</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-[13px] text-muted-foreground leading-snug px-1 pt-1">
                Reminders will be sent to all members and watchers of this card.
              </p>

              <div className="space-y-3 pt-3 pb-1">
                <Button
                  className="w-full bg-black hover:bg-black/90 text-white font-semibold h-11 rounded-sm shadow-sm transition-all duration-200 text-[15px] active:scale-[0.98] disabled:opacity-60"
                  onClick={handleSaveDate}
                  disabled={!canSaveDate}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  className="w-full bg-[#091e420f] hover:bg-[#091e421a] text-[#172b4d] font-semibold h-11 rounded-sm border-none shadow-none transition-all duration-200 text-[15px] active:scale-[0.98] disabled:opacity-60"
                  onClick={handleClearDate}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
