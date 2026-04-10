/**
 * ActionCard — renders inline tool execution events in the chat.
 *
 * Shows a compact card for each tool the agent called, with:
 * - Tool name + status indicator (spinner / success / error)
 * - Collapsed input/output details (expandable)
 * - Special handling for create_task, list_tasks etc.
 */

import { useState, memo } from "react";
import {
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
  Wrench,
} from "lucide-react";
import type { AgentAction } from "~/types/chat";
import { TOOL_LABELS } from "~/types/chat";

// ── Tool Result Renderers ───────────────────────────────────────────────────────

/** Extract a human-readable summary from tool output */
function getToolSummary(
  tool: string,
  output: Record<string, unknown> | undefined,
): string | null {
  if (!output) return null;
  if (output.error) return `Error: ${output.message || "Unknown error"}`;

  // Task created
  if (tool === "create_task" && output.task) {
    const task = output.task as Record<string, unknown>;
    return `Created "${task.title}" → ${task.columnId || "todo"}`;
  }

  // Task updated
  if (tool === "update_task" && output.task) {
    const task = output.task as Record<string, unknown>;
    return `Updated "${task.title}"`;
  }

  // Task deleted
  if (tool === "delete_task" && output.success) {
    return "Task deleted successfully";
  }

  // List tasks
  if (tool === "list_tasks") {
    if (output.columns && typeof output.columns === "object") {
      const cols = output.columns as Record<string, unknown[]>;
      const total = Object.values(cols).reduce(
        (a, b) => a + (Array.isArray(b) ? b.length : 0),
        0,
      );
      return `Found ${total} tasks`;
    }
    if (output.tasks && Array.isArray(output.tasks)) {
      return `Found ${output.tasks.length} tasks`;
    }
  }

  // Project overview
  if (tool === "get_project_overview" && output.project) {
    const p = output.project as Record<string, unknown>;
    return `${p.name || "Project"} overview loaded`;
  }

  // List members
  if (tool === "list_members" && output.members) {
    const members = output.members as unknown[];
    return `Found ${members.length} members`;
  }

  // Search
  if (tool === "search_workspace") {
    return "Search complete";
  }

  // Cycles
  if (tool === "create_cycle" && output.cycle) {
    const c = output.cycle as Record<string, unknown>;
    return `Created cycle "${c.name}"`;
  }
  if (tool === "list_cycles" && output.cycles) {
    const cycles = output.cycles as unknown[];
    return `Found ${cycles.length} cycles`;
  }

  // Pages
  if (tool === "list_pages" && output.pages) {
    const pages = output.pages as unknown[];
    return `Found ${pages.length} pages`;
  }

  // Stickies
  if (tool === "create_sticky" && output.sticky) {
    return "Sticky note created";
  }
  if (tool === "list_stickies" && output.stickies) {
    const s = output.stickies as unknown[];
    return `Found ${s.length} sticky notes`;
  }

  return null;
}

// ── Single Action Card ──────────────────────────────────────────────────────────

interface ActionCardProps {
  action: AgentAction;
  isRunning?: boolean;
}

const ActionCard = memo(function ActionCard({
  action,
  isRunning = false,
}: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const toolInfo = TOOL_LABELS[action.tool] ?? {
    label: action.tool,
    icon: "🔧",
  };
  const isStart = action.type === "tool_start";
  const isEnd = action.type === "tool_end";
  const hasError =
    isEnd &&
    action.output &&
    (action.output.error === true || action.output.status === 500);
  const summary = isEnd ? getToolSummary(action.tool, action.output) : null;

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/20 overflow-hidden transition-all duration-200 hover:border-border/80">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
      >
        {/* Status icon */}
        {isStart || isRunning ? (
          <Loader2 className="size-3.5 shrink-0 text-primary animate-spin" />
        ) : hasError ? (
          <AlertCircle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <Check className="size-3.5 shrink-0 text-emerald-500" />
        )}

        {/* Tool icon + label */}
        <span className="text-sm shrink-0">{toolInfo.icon}</span>
        <span className="text-xs font-medium text-foreground/80 flex-1 truncate">
          {toolInfo.label}
        </span>

        {/* Summary badge */}
        {summary && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
            {summary}
          </span>
        )}

        {/* Expand chevron */}
        {(action.input || action.output) && (
          <ChevronDown
            className={`size-3 text-muted-foreground/50 transition-transform ${
              expanded ? "" : "-rotate-90"
            }`}
          />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (action.input || action.output) && (
        <div className="border-t border-border/30 px-3 py-2 space-y-2">
          {action.input && Object.keys(action.input).length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1">
                Input
              </p>
              <pre className="text-[10px] font-mono text-foreground/60 bg-secondary/40 rounded-lg p-2 overflow-x-auto max-h-32 overflow-y-auto">
                {JSON.stringify(action.input, null, 2)}
              </pre>
            </div>
          )}
          {action.output && Object.keys(action.output).length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-1">
                Output
              </p>
              <pre className="text-[10px] font-mono text-foreground/60 bg-secondary/40 rounded-lg p-2 overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(action.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── Action Cards Group ──────────────────────────────────────────────────────────

export interface ActionCardsGroupProps {
  actions: AgentAction[];
  isStreaming?: boolean;
}

/** Renders a vertical list of action cards, merging start/end pairs */
export function ActionCardsGroup({
  actions,
  isStreaming,
}: ActionCardsGroupProps) {
  if (actions.length === 0) return null;

  // Group paired tool_start + tool_end events by tool name
  const paired: {
    tool: string;
    start?: AgentAction;
    end?: AgentAction;
  }[] = [];

  const endMap = new Map<string, AgentAction>();
  for (const a of actions) {
    if (a.type === "tool_end") {
      endMap.set(a.tool, a);
    }
  }

  const seenEnds = new Set<string>();
  for (const a of actions) {
    if (a.type === "tool_start") {
      const end = endMap.get(a.tool);
      if (end && !seenEnds.has(a.tool)) {
        paired.push({ tool: a.tool, start: a, end });
        seenEnds.add(a.tool);
        endMap.delete(a.tool);
      } else {
        paired.push({ tool: a.tool, start: a });
      }
    }
  }

  // Add any orphaned ends
  for (const [tool, end] of endMap) {
    if (!seenEnds.has(tool)) {
      paired.push({ tool, end });
    }
  }

  return (
    <div className="space-y-1.5 my-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 pl-1">
        <Wrench className="size-3" />
        <span>Agent Actions</span>
        {isStreaming && (
          <Loader2 className="size-3 animate-spin text-primary ml-1" />
        )}
      </div>
      {paired.map((p, i) => {
        // If we have an end event, show the completed action
        const action = p.end ?? p.start!;
        const isRunning = !p.end && isStreaming;
        return <ActionCard key={i} action={action} isRunning={isRunning} />;
      })}
    </div>
  );
}

export default ActionCard;
