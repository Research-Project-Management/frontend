import {
  Card as CardItem,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tag, Calendar, UserRound, SquarePen } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Task } from "~/types/task";

export type Card = Task;

export function CardTemplate({ card }: { card: Task }) {
  const labels = card.labels || [];

  const assigneeName = card.assignee?.name;
  const hasLabels = labels.length > 0;
  const hasDueDate = Boolean(card.dueDate);
  const hasAssignee = Boolean(assigneeName);

  // Color based on status or random for visual interest
  const accentColor = getCardAccentColor(card.columnId);

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="More actions"
          >
            <SquarePen className="h-4 w-4" />
          </Button>
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

// Helper function to get accent color based on column
function getCardAccentColor(columnId: string): string {
  const colors: Record<string, string> = {
    backlog: "#64748b",
    todo: "#3b82f6",
    doing: "#f59e0b",
    review: "#eab308",
    done: "#22c55e",
  };
  return colors[columnId] || "#6B7280";
}
