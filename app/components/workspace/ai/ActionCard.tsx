/**
 * ActionCard — renders inline tool execution events in the chat.
 *
 * Shows a compact card for each tool the agent called, with:
 * - Tool name + status indicator (spinner / success / error)
 * - Color-coded border by category (read/create/update/delete/analyze)
 * - Collapsed input/output details (expandable)
 * - Smart summaries for all tool types
 */

import { useState, memo } from "react";
import {
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
  Wrench,
} from "lucide-react";
import type { AgentAction, ToolCategory } from "~/types/chat";
import { TOOL_LABELS, TOOL_CATEGORY_COLORS } from "~/types/chat";

// ── Category border colors for the left accent ─────────────────────────────────

const CATEGORY_BORDER: Record<ToolCategory, string> = {
  read:    "border-l-[#3370ff]/70",
  create:  "border-l-emerald-500/70",
  update:  "border-l-amber-500/70",
  delete:  "border-l-red-500/70",
  analyze: "border-l-violet-500/70",
};

const CATEGORY_BG: Record<ToolCategory, string> = {
  read:    "bg-[#3370ff]/[0.04]",
  create:  "bg-emerald-500/[0.04]",
  update:  "bg-amber-500/[0.04]",
  delete:  "bg-red-500/[0.04]",
  analyze: "bg-violet-500/[0.04]",
};

// ── Tool Result Renderers ───────────────────────────────────────────────────────

/** Extract a human-readable summary from tool output */
function getToolSummary(
  tool: string,
  output: Record<string, unknown> | undefined,
): string | null {
  if (!output) return null;
  if (output.error) return `Error: ${output.message || "Unknown error"}`;

  // Generic count-based summaries
  const countKeys: Record<string, string> = {
    tasks: "tasks", projects: "projects", members: "members",
    cycles: "cycles", pages: "pages", stickies: "sticky notes",
    tags: "tags", comments: "comments", versions: "versions",
    results: "results", users: "users",
  };

  for (const [key, label] of Object.entries(countKeys)) {
    if (output[key] && Array.isArray(output[key])) {
      return `Found ${(output[key] as unknown[]).length} ${label}`;
    }
  }

  // Task-specific
  if (tool === "create_task" && output.task) {
    const task = output.task as Record<string, unknown>;
    return `Created "${task.title}" → ${task.columnId || "todo"}`;
  }
  if (tool === "update_task" && output.task) {
    const task = output.task as Record<string, unknown>;
    return `Updated "${task.title}"`;
  }
  if (tool === "delete_task" && output.success) return "Task deleted";

  // Task columns format
  if (tool === "list_tasks" && output.columns && typeof output.columns === "object") {
    const cols = output.columns as Record<string, unknown[]>;
    const total = Object.values(cols).reduce(
      (a, b) => a + (Array.isArray(b) ? b.length : 0), 0,
    );
    return `Found ${total} tasks`;
  }

  // Project
  if (tool === "get_project_overview" && output.project) {
    const p = output.project as Record<string, unknown>;
    return `${p.name || "Project"} overview loaded`;
  }
  if (tool === "get_project_details" && output.project) {
    const p = output.project as Record<string, unknown>;
    return `${p.name || "Project"} details loaded`;
  }
  if (tool === "update_project" && output.success) return "Project updated";
  if (tool === "add_project_member" && output.success) return "Member added";
  if (tool === "remove_project_member" && output.success) return "Member removed";
  if (tool === "update_member_role" && output.success) return "Role updated";

  // Workspace
  if (tool === "get_workspace_overview" && (output.workspace || output.overview)) return "Overview loaded";
  if (tool === "get_workspace_activity" && output.activities) {
    const acts = output.activities as unknown[];
    return `${acts.length} recent activities`;
  }
  if (tool === "search_workspace") return "Search complete";

  // Cycles
  if (tool === "create_cycle" && output.cycle) {
    const c = output.cycle as Record<string, unknown>;
    return `Created cycle "${c.name}"`;
  }
  if (tool === "get_cycle_details" && output.cycle) {
    const c = output.cycle as Record<string, unknown>;
    return `${c.name || "Cycle"} details loaded`;
  }
  if (tool === "update_cycle" && output.success) return "Cycle updated";
  if (tool === "delete_cycle" && output.success) return "Cycle deleted";

  // Pages
  if (tool === "create_page" && output.page) return "Page created";
  if (tool === "update_page" && output.success) return "Page updated";
  if (tool === "delete_page" && output.success) return "Page deleted";
  if (tool === "get_page_content" && output.page) {
    const p = output.page as Record<string, unknown>;
    return `"${p.title || "Page"}" loaded`;
  }

  // Stickies
  if (tool === "create_sticky" && output.sticky) return "Sticky created";
  if (tool === "update_sticky" && output.success) return "Sticky updated";
  if (tool === "delete_sticky" && output.success) return "Sticky deleted";

  // Tags
  if (tool === "create_tag" && output.tag) return "Tag created";
  if (tool === "delete_tag" && output.success) return "Tag deleted";

  // Comments
  if (tool === "add_task_comment" && output.comment) return "Comment added";
  if (tool === "add_page_comment" && output.comment) return "Comment added";

  // Users
  if (tool === "get_current_user" && output.user) return "User info loaded";

  // Analysis
  if (tool === "get_workload_distribution") return "Workload analysis ready";
  if (tool === "get_overdue_report") return "Overdue report ready";
  if (tool === "get_project_velocity") return "Velocity data ready";
  if (tool === "generate_team_summary") return "Team summary ready";

  // My tasks
  if (tool === "get_my_tasks" && output.tasks) {
    const tasks = output.tasks as unknown[];
    return `Found ${tasks.length} assigned tasks`;
  }
  if (tool === "summarize_member_tasks") return "Workload summary ready";

  // Generic success
  if (output.success) return "Done";

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
    category: "read" as ToolCategory,
  };
  const category = toolInfo.category;
  const isStart = action.type === "tool_start";
  const isEnd = action.type === "tool_end";
  const hasError =
    isEnd &&
    action.output &&
    (action.output.error === true || action.output.status === 500);
  const summary = isEnd ? getToolSummary(action.tool, action.output) : null;

  return (
    <div
      className={`rounded-xl border border-border/50 border-l-2 overflow-hidden transition-all duration-200 hover:border-border/80 ${CATEGORY_BORDER[category]} ${CATEGORY_BG[category]}`}
    >
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

        {/* Tool label */}
        <span className={`text-xs font-medium flex-1 truncate ${TOOL_CATEGORY_COLORS[category]}`}>
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

  // Group paired tool_start + tool_end events by tool name + index
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
