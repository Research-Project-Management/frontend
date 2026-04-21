import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  CheckSquare,
  AlignLeft,
  MessageSquare,
  Paperclip,
  Clock3,
  MoreHorizontal,
  Copy,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { Task } from "~/types/task";
import { DEFAULT_TASK_COLUMN_COLORS, resolveTaskLabels } from "~/types/task";

type CardProps = {
  card: Task;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onEdit?: (card: Task) => void;
  onDuplicate?: (card: Task) => void;
  onDelete?: (card: Task) => void;
  onJoin?: (card: Task) => void;
  onLeave?: (card: Task) => void;
  onToggleComplete?: (card: Task) => void;
};

function formatDueDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function getAssigneeInitials(name?: string) {
  const trimmedName = name?.trim() || "";
  if (!trimmedName) return "";

  return trimmedName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function isValidDate(value?: string) {
  if (!value) return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isOverdue(value?: string) {
  if (!isValidDate(value)) return false;

  const date = new Date(value!);
  return date.getTime() < new Date().setHours(0, 0, 0, 0);
}

function CardContent({
  card,
  currentUserId,
  currentUserAvatar,
  onDuplicate,
  onDelete,
  onJoin,
  onLeave,
  onToggleComplete,
}: {
  card: Task;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onDuplicate?: (card: Task) => void;
  onDelete?: (card: Task) => void;
  onJoin?: (card: Task) => void;
  onLeave?: (card: Task) => void;
  onToggleComplete?: (card: Task) => void;
}) {
  const [showLabelDetails, setShowLabelDetails] = useState(false);

  const startDateText = formatDueDate(card.startDate);
  const dueDateText = formatDueDate(card.dueDate);
  const dueDateDisplayText =
    startDateText && dueDateText
      ? `${startDateText} - ${dueDateText}`
      : dueDateText || startDateText;
  const hasDueDate = isValidDate(card.dueDate);
  let dueDateIsOverdue = isOverdue(card.dueDate);

  if (card.dueState === "overdue") {
    dueDateIsOverdue = true;
  }

  if (typeof card.isOverdue === "boolean") {
    dueDateIsOverdue = card.isOverdue;
  }
  const hasDescription = Boolean(card.description?.trim() || card.content?.trim());
  const commentCount = card.commentCount ?? 0;
  const attachmentCount = card.attachments?.length ?? 0;
  const checklistItems = card.checklists ?? [];
  const checklistTotal = checklistItems.reduce((acc, checklist) => acc + checklist.items.length, 0);
  const checklistDone = checklistItems.reduce(
    (acc, checklist) => acc + checklist.items.filter((item) => item.completed).length,
    0,
  );
  const visibleLabels = resolveTaskLabels(card.labels || []).filter(
    (label) => label.color,
  );
  const assignee = card.assignee;
  const assigneeInitials = assignee ? getAssigneeInitials(assignee.name) : "";
  const isCurrentUserAssignee = Boolean(currentUserId && assignee?._id === currentUserId);
  const resolvedAssigneeAvatar =
    assignee && isCurrentUserAssignee && !assignee.avatar
      ? currentUserAvatar
      : assignee?.avatar;

  const metadataItems = [
    hasDueDate
      ? {
          key: "due",
          icon: Clock3,
          label: dueDateIsOverdue ? "Overdue" : "Due Soon",
          text: dueDateDisplayText,
        }
      : null,
    hasDescription
      ? {
          key: "description",
          icon: AlignLeft,
          label: "Description available",
          text: "",
        }
      : null,
    commentCount > 0
      ? {
          key: "comments",
          icon: MessageSquare,
          label: "Comments",
          text: String(commentCount),
        }
      : null,
    attachmentCount > 0
      ? {
          key: "attachments",
          icon: Paperclip,
          label: "Attachments",
          text: String(attachmentCount),
        }
      : null,
    checklistTotal > 0
      ? {
          key: "checklist",
          icon: CheckSquare,
          label: "Checklist",
          text: `${checklistDone}/${checklistTotal}`,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: typeof Clock3;
    label: string;
    text: string;
  }>;

  return (
    <div className="group relative min-w-0 rounded-sm border border-zinc-200 bg-white px-3.5 py-3 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md">


      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2.5 top-2.5 z-10 h-6 w-6 shrink-0 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="More task actions"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem
            disabled={card.permissions?.canDuplicate === false}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate?.(card);
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          {currentUserId && onJoin && onLeave ? (
            <DropdownMenuItem
              disabled={card.permissions?.canEdit === false}
              onClick={(event) => {
                event.stopPropagation();
                if (isCurrentUserAssignee) {
                  onLeave(card);
                  return;
                }
                onJoin(card);
              }}
            >
              {isCurrentUserAssignee ? (
                <UserMinus className="mr-2 h-4 w-4" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {isCurrentUserAssignee ? "Leave" : "Join"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={card.permissions?.canDelete === false}
            onClick={(event) => {
              event.stopPropagation();
              onDelete?.(card);
            }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {visibleLabels.length > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowLabelDetails((prev) => !prev);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          className="mb-2 flex w-full flex-wrap items-center gap-1.5 pl-0.5 pr-8 text-left"
          aria-label="Toggle label details display"
        >
          {visibleLabels.map((label) => {
            const hasTitle = label.title.trim().length > 0;
 
            return showLabelDetails ? (
              <span
                key={label.id}
                className={`inline-flex h-4 items-center rounded-sm px-2 text-[11px] font-semibold leading-none text-zinc-900 ${
                  hasTitle ? "w-fit max-w-full" : "min-w-12"
                }`}
                style={{ backgroundColor: label.color }}
                title={hasTitle ? label.title : "Label"}
              >
                {hasTitle ? <span className="max-w-full truncate">{label.title}</span> : null}
              </span>
            ) : (
              <span
                key={label.id}
                className="inline-flex h-2.5 w-11 rounded-full transition-all duration-200"
                style={{ backgroundColor: label.color }}
                title={hasTitle ? label.title : "Label"}
              />
            );
          })}
        </button>
      ) : null}

      <div className="flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleComplete?.(card);
          }}
          disabled={card.permissions?.canEdit === false}
          aria-label={card.completed ? "Mark as incomplete" : "Mark as complete"}
          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border-[1.5px] transition-all ${
            card.completed
              ? "border-black bg-black text-white"
              : "border-zinc-300 bg-white text-transparent"
          } ${card.permissions?.canEdit === false ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <Check
            className={`h-3 w-3 stroke-3 ${
              card.completed ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 pr-8">
            <h4
              className={`min-w-0 flex-1 wrap-break-word text-[14px] font-medium leading-5 tracking-tight ${
                card.completed ? "text-zinc-400 line-through" : "text-zinc-900"
              }`}
            >
              {card.title}
            </h4>
          </div>

          {metadataItems.length > 0 || assignee ? (
            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                {metadataItems.map((item) => {
                  const Icon = item.icon;
                  const hoverText = item.text
                    ? `${item.label}: ${item.text}`
                    : item.label;
                  const hasText = item.text.trim().length > 0;
                  const isOverdueBadge =
                    item.key === "due" && dueDateIsOverdue && hasText;

                  if (isOverdueBadge) {
                    return (
                      <div
                        key={item.key}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-[#c9372c] px-2 py-1 text-[12px] font-semibold text-white"
                        title={hoverText}
                        aria-label={hoverText}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="max-w-32 truncate whitespace-nowrap">{item.text}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.key}
                      className={
                        hasText
                          ? "inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500"
                          : "inline-flex size-5 items-center justify-center text-zinc-400"
                      }
                      title={hoverText}
                      aria-label={hoverText}
                    >
                      <Icon className="size-4 shrink-0" />
                      {hasText ? (
                        <span className="max-w-24 truncate whitespace-nowrap">{item.text}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {assignee ? (
                <div className="flex shrink-0 items-center justify-end">
                  <div
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-700"
                    title={assignee.name}
                  >
                    {resolvedAssigneeAvatar ? (
                      <img
                        src={resolvedAssigneeAvatar}
                        alt={assignee.name}
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      assigneeInitials
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Card({
  card,
  currentUserId,
  currentUserAvatar,
  onEdit,
  onDuplicate,
  onDelete,
  onJoin,
  onLeave,
  onToggleComplete,
}: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card._id,
      data: { card },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="cursor-pointer"
      {...attributes}
      {...listeners}
      onClick={() => onEdit?.(card)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit?.(card);
        }
      }}
    >
      <CardContent
        card={card}
        currentUserId={currentUserId}
        currentUserAvatar={currentUserAvatar}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onJoin={onJoin}
        onLeave={onLeave}
        onToggleComplete={onToggleComplete}
      />
    </div>
  );
}

export { CardContent as CardUI };
