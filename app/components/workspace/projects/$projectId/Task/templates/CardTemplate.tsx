import {
  Card as CardItem,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Copy, MoreHorizontal, Tag, Trash2, UserRound } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { Task } from "~/types/task";
import { DEFAULT_TASK_COLUMN_COLORS } from "~/types/task";

export type Card = Task;

type CardTemplateProps = {
  card: Task;
  onDelete?: (card: Task) => void;
  onDuplicate?: (card: Task) => void;
};

export function CardTemplate({
  card,
  onDelete,
  onDuplicate,
}: CardTemplateProps) {
  const labels = card.labels || [];

  const assigneeName = card.assignee?.name;
  const hasLabels = labels.length > 0;
  const hasDueDate = Boolean(card.dueDate);
  const hasAssignee = Boolean(assigneeName);
  const accentColor = DEFAULT_TASK_COLUMN_COLORS[card.columnId] || "#6B7280";

  return (
    <CardItem
      className="group py-3 border-l-[3px] hover:border-l-[4px] transition-all bg-white dark:bg-slate-900 hover:shadow-lg hover:shadow-primary/5"
      style={{ borderLeftColor: accentColor }}
    >
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="min-w-0 text-[15px] font-semibold leading-5 tracking-tight">
          <span className="block line-clamp-2">{card.title}</span>
        </CardTitle>

        <CardAction className="self-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:bg-accent/80 data-[state=open]:bg-accent/80"
                aria-label="More actions"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 rounded-xl border-border/70 bg-background/95 p-1.5 shadow-lg backdrop-blur"
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(card);
                }}
                className="rounded-lg text-foreground"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.(card);
                }}
                className="rounded-lg"
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0 pb-2">
        <p className="text-[13px] leading-5 text-muted-foreground line-clamp-2">
          {card.content}
        </p>
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-2.5 pt-1">
        {hasLabels && (
          <div className="flex flex-wrap items-start gap-1.5">
            {labels.map((label) => (
              <span
                key={`${card._id}:${label}`}
                className="inline-flex h-5 items-center gap-1 rounded-md border bg-muted/50 px-2 text-[11px] font-medium text-muted-foreground"
              >
                <Tag className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="h-px w-full bg-border/40" />

        <div className="flex min-h-5 w-full items-center justify-between">
          {hasDueDate ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(card.dueDate!).toLocaleDateString()}
            </span>
          ) : (
            <span />
          )}

          {hasAssignee ? (
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: accentColor }}
              title={assigneeName}
            >
              {assigneeName?.[0]?.toUpperCase()}
            </span>
          ) : (
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-muted text-muted-foreground"
              title="Unassigned"
            >
              <UserRound className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </CardFooter>
    </CardItem>
  );
}

