import { ChevronDown, Plus } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { parseISO, isValid, format } from "date-fns";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useParams } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import type {
  TaskRecurrence,
  TaskReminder,
} from "~/types/task";
import { useLabelsQuery } from "~/query/label";
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
  const { workspaceId, projectId } = useParams();
  const { user: currentUser } = useAuth();
  const { data: workspaceLabels = [] } = useLabelsQuery(workspaceId || "", "task", projectId);
  const [labelsPopoverOpen, setLabelsPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const [memberActionPopoverOpen, setMemberActionPopoverOpen] = useState(false);
  const actionBtnClass =
    "h-10 rounded-sm border border-border bg-white px-4 text-[15px] font-medium text-zinc-900 shadow-none transition-colors hover:bg-zinc-100";

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
    return workspaceLabels
      .filter((label: any) => labels.includes(label._id))
      .map((label: any) => ({ id: label._id, title: label.name, color: label.color }));
  }, [workspaceLabels, labels]);

  const formattedDueDateBadge = useMemo(() => {
    if (!dueDate) return null;
    const d = parseISO(dueDate);
    if (!isValid(d)) return null;
    return format(d, "HH:mm d 'thg' M");
  }, [dueDate]);

  const formattedStartDateBadge = useMemo(() => {
    if (!startDate) return null;
    const d = parseISO(startDate);
    if (!isValid(d)) return null;
    return format(d, "d 'thg' M");
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
              <p className="text-[14px] font-semibold text-zinc-500">Members</p>
              <div className="flex items-center gap-2">
                <Popover open={memberActionPopoverOpen} onOpenChange={setMemberActionPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full"
                      aria-label={`Options for member ${assignee.user.name}`}
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={assignee.user.avatar} />
                        <AvatarFallback className="bg-zinc-100 text-[13px] font-bold text-zinc-900">
                          {assignee.user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="top"
                    sideOffset={8}
                    className="z-140 w-48 rounded-sm border-border/50 p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId(null);
                        setMemberActionPopoverOpen(false);
                      }}
                      className="flex w-full items-center rounded-sm px-3 py-2 text-left text-[14px] text-red-600 transition-colors hover:bg-red-50"
                    >
                      Remove from card
                    </button>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMemberPopoverOpen(true)}
                  className="size-9 rounded-full border-0 bg-zinc-100 text-zinc-900 shadow-none hover:bg-zinc-200"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {sortedActiveLabels.length > 0 ? (
            <div className="min-w-30 space-y-2">
              <p className="text-[14px] font-semibold text-zinc-500">Labels</p>
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
                            ? "inline-flex h-10 max-w-45 items-center rounded-sm px-4 text-[15px] leading-none font-medium text-[#14532d] transition-opacity hover:opacity-90"
                            : "inline-flex h-10 w-11 items-center justify-center rounded-sm transition-opacity hover:opacity-90"
                        }
                        style={{ backgroundColor: item.color }}
                      >
                        {hasTitle ? <span className="truncate text-white drop-shadow-sm font-bold">{item.title}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLabelsPopoverOpen(true)}
                  className="size-9 shrink-0 self-start rounded-full border-0 bg-zinc-100 text-zinc-900 shadow-none hover:bg-zinc-200"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {dateBadgeText ? (
            <div className="min-w-45 space-y-2">
              <p className="text-[14px] font-semibold text-zinc-500">
                {formattedDueDateBadge ? "Due date" : "Start date"}
              </p>
              <button
                type="button"
                onClick={() => setDatePopoverOpen(true)}
                className={`inline-flex h-10 max-w-full items-center gap-2 rounded-sm px-4 text-[16px] leading-none font-medium transition-colors ${
                  isDueDateOverdue
                    ? "bg-red-50 text-red-900 hover:bg-red-100"
                    : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                }`}
              >
                <span className="truncate">{dateBadgeText}</span>
                {isDueDateOverdue ? (
                  <span className="inline-flex h-5 items-center rounded-sm bg-red-600 px-1.5 text-[12px] font-semibold text-white">
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
