import { ChevronDown, Plus } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { parseISO, isValid, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "~/hooks/useAuth";
import type {
  TaskRecurrence,
  TaskReminder,
  TaskLabel,
} from "~/types/task";
import {
  INITIAL_LABEL_POOL,
  getTaskLabelPool,
  persistTaskLabelPool,
  resolveTaskLabels,
} from "~/types/task";
import { ActionDateSection } from "./section/ActionDateSection";
import { ActionLabelsSection } from "./section/ActionLabelsSection";
import { ActionChecklistSection } from "./section/ActionChecklistSection";
import { ActionMemberSection } from "./section/ActionMemberSection";
import { ActionAttachmentSection } from "./section/ActionAttachmentSection";

type Attachment = {
  id: string;
  name: string;
  type: string;
  size: string;
  createdAt: string;
  url: string;
};

type TaskActionsProps = {
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  dueDate: string;
  setDueDate: (date: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  recurrence: TaskRecurrence;
  setRecurrence: (value: TaskRecurrence) => void;
  reminder: TaskReminder;
  setReminder: (value: TaskReminder) => void;
  assigneeId: string | null;
  setAssigneeId: (id: string | null) => void;
  members: any[];
  onAddChecklist: (title: string) => void;
  setAttachments?: Dispatch<SetStateAction<Attachment[]>>;
};

export function TaskActions({
  labels,
  setLabels,
  dueDate,
  setDueDate,
  startDate,
  setStartDate,
  recurrence,
  setRecurrence,
  reminder,
  setReminder,
  assigneeId,
  setAssigneeId,
  members,
  onAddChecklist,
  setAttachments,
}: TaskActionsProps) {
  const { user: currentUser } = useAuth();
  const [labelPool, setLabelPool] = useState<TaskLabel[]>(() => getTaskLabelPool());
  const [labelsPopoverOpen, setLabelsPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const [memberActionPopoverOpen, setMemberActionPopoverOpen] = useState(false);
  const actionBtnClass =
    "h-10 rounded-[8px] border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] shadow-none transition-colors hover:bg-[#f7f7f7]";

  useEffect(() => {
    persistTaskLabelPool(labelPool);
  }, [labelPool]);

  const normalizedMembers = useMemo(() => {
    const list = members.map((m: any) => {
      if (!currentUser || m.user._id !== currentUser._id) return m;

      return {
        ...m,
        user: {
          ...m.user,
          name: currentUser.name,
          avatar: currentUser.avatar,
        },
      };
    });

    if (currentUser && !list.some((m: any) => m.user._id === currentUser._id)) {
      list.unshift({
        user: {
          _id: currentUser._id,
          name: currentUser.name,
          avatar: currentUser.avatar,
        },
      });
    }

    return list;
  }, [members, currentUser]);

  const assignee = normalizedMembers.find((m: any) => m.user._id === assigneeId);

  const sortedActiveLabels = useMemo(() => {
    return labelPool.filter((label) => labels.includes(label.id));
  }, [labelPool, labels]);

  const formattedDueDateBadge = useMemo(() => {
    if (!dueDate) return null;
    const d = parseISO(dueDate);
    if (!isValid(d)) return null;
    return format(d, "HH:mm MMM d");
  }, [dueDate]);

  const formattedStartDateBadge = useMemo(() => {
    if (!startDate) return null;
    const d = parseISO(startDate);
    if (!isValid(d)) return null;
    return format(d, "MMM d");
  }, [startDate]);

  const dateBadgeText = useMemo(() => {
    if (formattedDueDateBadge && formattedStartDateBadge) {
      return `${formattedStartDateBadge} - ${formattedDueDateBadge}`;
    }

    return formattedDueDateBadge || formattedStartDateBadge;
  }, [formattedDueDateBadge, formattedStartDateBadge]);

  const isDueDateOverdue = useMemo(() => {
    if (!formattedDueDateBadge || !dueDate) return false;

    const parsedDueDate = parseISO(dueDate);
    if (!isValid(parsedDueDate)) return false;

    return parsedDueDate.getTime() < Date.now();
  }, [formattedDueDateBadge, dueDate]);

  const handleDeleteLabel = (labelId: string) => {
    setLabelPool((prev) => prev.filter((label) => label.id !== labelId));
    setLabels((prev) => prev.filter((id) => id !== labelId));
  };

  const hasMetaContent =
    Boolean(assigneeId && assignee) ||
    sortedActiveLabels.length > 0 ||
    Boolean(formattedDueDateBadge || formattedStartDateBadge);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <ActionLabelsSection
          actionBtnClass={actionBtnClass}
          open={labelsPopoverOpen}
          onOpenChange={setLabelsPopoverOpen}
          labels={labels}
          setLabels={setLabels}
          labelPool={labelPool}
          setLabelPool={setLabelPool}
          onDeleteLabel={handleDeleteLabel}
        />

        <ActionDateSection
          actionBtnClass={actionBtnClass}
          open={datePopoverOpen}
          onOpenChange={setDatePopoverOpen}
          dueDate={dueDate}
          setDueDate={setDueDate}
          startDate={startDate}
          setStartDate={setStartDate}
          recurrence={recurrence}
          setRecurrence={setRecurrence}
          reminder={reminder}
          setReminder={setReminder}
        />

        <ActionChecklistSection onAddChecklist={onAddChecklist} />

        <ActionMemberSection
          actionBtnClass={actionBtnClass}
          open={memberPopoverOpen}
          onOpenChange={setMemberPopoverOpen}
          assigneeId={assigneeId}
          setAssigneeId={setAssigneeId}
          members={normalizedMembers}
        />

        <ActionAttachmentSection actionBtnClass={actionBtnClass} setAttachments={setAttachments} />
      </div>

      {hasMetaContent ? (
        <div className="flex flex-wrap items-start gap-4 sm:gap-5">
          {assigneeId && assignee ? (
            <div className="min-w-27.5 space-y-2">
              <p className="text-[14px] font-semibold text-[#5e6c84]">Members</p>
              <div className="flex items-center gap-2">
                <Popover open={memberActionPopoverOpen} onOpenChange={setMemberActionPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full"
                      aria-label={`Member options for ${assignee.user.name}`}
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={assignee.user.avatar} />
                        <AvatarFallback className="bg-[#f59e0b] text-[13px] font-bold text-[#3f2200]">
                          {assignee.user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="z-140 w-48 rounded-xl border-border/50 p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId(null);
                        setMemberActionPopoverOpen(false);
                      }}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[14px] text-[#c9372c] transition-colors hover:bg-[#fff1f0]"
                    >
                      Remove from card
                    </button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMemberPopoverOpen(true)}
                  className="size-9 rounded-full border-0 bg-[#e5e7eb] text-[#172b4d] shadow-none hover:bg-[#d9dde3]"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {sortedActiveLabels.length > 0 ? (
            <div className="min-w-30 space-y-2">
              <p className="text-[14px] font-semibold text-[#5e6c84]">Labels</p>
              <div className="flex items-start gap-2">
                <div className="flex max-w-65 flex-wrap items-center gap-2">
                  {sortedActiveLabels.map((item) => {
                    const hasTitle = item.title.trim().length > 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLabelsPopoverOpen(true)}
                        className={
                          hasTitle
                            ? "inline-flex h-10 max-w-45 items-center rounded-md px-4 text-[15px] leading-none font-medium text-[#14532d] transition-opacity hover:opacity-90"
                            : "inline-flex h-10 w-11 items-center justify-center rounded-md transition-opacity hover:opacity-90"
                        }
                        style={{ backgroundColor: item.color }}
                      >
                        {hasTitle ? <span className="truncate">{item.title}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLabelsPopoverOpen(true)}
                  className="size-9 shrink-0 self-start rounded-full border-0 bg-[#e5e7eb] text-[#172b4d] shadow-none hover:bg-[#d9dde3]"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {dateBadgeText ? (
            <div className="min-w-45 space-y-2">
              <p className="text-[14px] font-semibold text-[#5e6c84]">
                {formattedDueDateBadge ? "Due date" : "Start date"}
              </p>
              <button
                type="button"
                onClick={() => setDatePopoverOpen(true)}
                className={`inline-flex h-10 max-w-full items-center gap-2 rounded-md px-4 text-[16px] leading-none font-medium transition-colors ${isDueDateOverdue
                    ? "bg-[#ffeceb] text-[#5d1f1a] hover:bg-[#ffd9d6]"
                    : "bg-[#d1d5db] text-[#1f2937] hover:bg-[#c7ccd5]"
                  }`}
              >
                <span className="truncate">{dateBadgeText}</span>
                {isDueDateOverdue ? (
                  <span className="inline-flex h-5 items-center rounded-[4px] bg-[#c9372c] px-1.5 text-[12px] font-semibold text-white">
                    Overdue
                  </span>
                ) : null}
                <ChevronDown className="size-4 shrink-0" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
