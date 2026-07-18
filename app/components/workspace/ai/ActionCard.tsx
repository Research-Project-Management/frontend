import { memo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  FileText,
  FolderKanban,
  Layers3,
  ListTodo,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings2,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import type { AgentAction, ToolCategory } from "~/types/chat";
import { TOOL_LABELS } from "~/types/chat";

const CATEGORY_ACCENT: Record<ToolCategory, string> = {
  read: "bg-[#3370ff]",
  create: "bg-emerald-500",
  update: "bg-amber-500",
  delete: "bg-red-500",
  analyze: "bg-violet-500",
};

const CATEGORY_TEXT: Record<ToolCategory, string> = {
  read: "text-[#3370ff]",
  create: "text-emerald-600 dark:text-emerald-400",
  update: "text-amber-600 dark:text-amber-400",
  delete: "text-red-500",
  analyze: "text-violet-600 dark:text-violet-400",
};

const CATEGORY_SURFACE: Record<ToolCategory, string> = {
  read: "bg-[#3370ff]/10 text-[#3370ff]",
  create: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  update: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  delete: "bg-red-500/10 text-red-500",
  analyze: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const AGENT_LABELS: Record<string, { label: string }> = {
  task_agent: { label: "Task Agent" },
  project_agent: { label: "Project Agent" },
  cycle_agent: { label: "Cycle Agent" },
  workspace_agent: { label: "Workspace Agent" },
};

function getToolIcon(tool: string, category: ToolCategory) {
  if (tool.includes("task")) return ListTodo;
  if (tool.includes("project")) return FolderKanban;
  if (tool.includes("cycle")) return Layers3;
  if (tool.includes("page")) return FileText;
  if (tool.includes("tag")) return Tag;
  if (tool.includes("comment")) return MessageSquare;
  if (tool.includes("member") || tool.includes("user")) return User;
  if (tool.includes("search")) return Search;
  if (category === "create") return Plus;
  if (category === "update") return Pencil;
  if (category === "delete") return Trash2;
  if (category === "analyze") return BarChart3;
  return Settings2;
}

function getToolSummary(
  tool: string,
  output: Record<string, unknown> | undefined,
): string | null {
  if (!output) return null;
  if (output.error) return String(output.message || "Action failed");

  const countKeys: Record<string, string> = {
    tasks: "tasks",
    projects: "projects",
    members: "members",
    cycles: "cycles",
    pages: "pages",
    stickies: "notes",
    labels: "labels",
    comments: "comments",
    versions: "versions",
    results: "results",
    users: "users",
  };

  for (const [key, label] of Object.entries(countKeys)) {
    if (Array.isArray(output[key])) {
      return `${(output[key] as unknown[]).length} ${label}`;
    }
  }

  if (tool === "create_task" && output.task) {
    const task = output.task as Record<string, unknown>;
    return `Created ${task.title || "task"}`;
  }
  if (tool === "update_task" && output.task) {
    const task = output.task as Record<string, unknown>;
    return `Updated ${task.title || "task"}`;
  }
  if (tool === "delete_task" && output.success) return "Deleted task";

  if (tool === "list_tasks" && output.columns && typeof output.columns === "object") {
    const columns = output.columns as Record<string, unknown[]>;
    const total = Object.values(columns).reduce(
      (sum, value) => sum + (Array.isArray(value) ? value.length : 0),
      0,
    );
    return `${total} tasks`;
  }

  if (tool === "get_project_overview" && output.project) {
    const project = output.project as Record<string, unknown>;
    return `${project.name || "Project"} overview`;
  }
  if (tool === "get_project_details" && output.project) {
    const project = output.project as Record<string, unknown>;
    return `${project.name || "Project"} details`;
  }
  if (tool === "update_project" && output.success) return "Updated project";
  if (tool === "add_project_member" && output.success) return "Added member";
  if (tool === "remove_project_member" && output.success) return "Removed member";
  if (tool === "update_member_role" && output.success) return "Updated role";

  if (tool === "get_workspace_overview" && (output.workspace || output.overview)) {
    return "Workspace overview";
  }
  if (tool === "get_workspace_activity" && Array.isArray(output.activities)) {
    return `${output.activities.length} activities`;
  }
  if (tool === "search_workspace") return "Search complete";

  if (tool === "create_cycle" && output.cycle) {
    const cycle = output.cycle as Record<string, unknown>;
    return `Created ${cycle.name || "cycle"}`;
  }
  if (tool === "get_cycle_details" && output.cycle) {
    const cycle = output.cycle as Record<string, unknown>;
    return `${cycle.name || "Cycle"} details`;
  }
  if (tool === "update_cycle" && output.success) return "Updated cycle";
  if (tool === "delete_cycle" && output.success) return "Deleted cycle";

  if (tool === "create_page" && output.page) return "Created page";
  if (tool === "update_page" && output.success) return "Updated page";
  if (tool === "delete_page" && output.success) return "Deleted page";
  if (tool === "get_page_content" && output.page) {
    const page = output.page as Record<string, unknown>;
    return `${page.title || "Page"} loaded`;
  }

  if (tool === "create_sticky" && output.sticky) return "Created note";
  if (tool === "update_sticky" && output.success) return "Updated note";
  if (tool === "delete_sticky" && output.success) return "Deleted note";

  if (tool === "create_tag" && output.tag) return "Created tag";
  if (tool === "delete_tag" && output.success) return "Deleted tag";
  if (tool === "add_task_comment" && output.comment) return "Added comment";
  if (tool === "add_page_comment" && output.comment) return "Added comment";
  if (tool === "get_current_user" && output.user) return "Loaded user";

  if (tool === "get_workload_distribution") return "Workload ready";
  if (tool === "get_overdue_report") return "Overdue report ready";
  if (tool === "get_project_velocity") return "Velocity ready";
  if (tool === "generate_team_summary") return "Summary ready";
  if (tool === "get_my_tasks" && Array.isArray(output.tasks)) {
    return `${output.tasks.length} assigned tasks`;
  }
  if (tool === "summarize_member_tasks") return "Summary ready";
  if (output.success) return "Done";

  return null;
}

function StatusIcon({
  status,
}: {
  status: "running" | "done" | "error" | "queued";
}) {
  if (status === "running") {
    return <Loader2 className="size-3.5 animate-spin text-primary" />;
  }
  if (status === "error") {
    return <AlertCircle className="size-3.5 text-destructive" />;
  }
  if (status === "queued") {
    return <Clock3 className="size-3.5 text-muted-foreground" />;
  }
  return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown>;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre className="max-h-44 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-[10px] leading-relaxed text-foreground/70">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

interface ActionCardProps {
  action: AgentAction;
  isRunning?: boolean;
}

const ActionCard = memo(function ActionCard({
  action,
  isRunning = false,
}: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const toolKey = action.tool ?? "";
  const toolInfo = TOOL_LABELS[toolKey] ?? {
    label: toolKey || "Workspace action",
    category: "read" as ToolCategory,
  };
  const category = toolInfo.category;
  const Icon = getToolIcon(toolKey, category);
  const isEnd = action.type === "tool_end";
  const hasError =
    isEnd &&
    action.output &&
    (action.output.error === true || action.output.status === 500);
  const summary = isEnd ? getToolSummary(toolKey, action.output) : null;
  const status = isRunning || action.type === "tool_start"
    ? "running"
    : hasError
      ? "error"
      : "done";
  const hasDetails = Boolean(action.input || action.output);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background transition-colors hover:bg-muted/30">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span className={`h-6 w-1 rounded-full ${CATEGORY_ACCENT[category]}`} />
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${CATEGORY_SURFACE[category]}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">
            {toolInfo.label}
          </span>
          {summary && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
        <StatusIcon status={status} />
        {hasDetails && (
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {expanded && hasDetails && (
        <div className="space-y-2 border-t border-border bg-muted/20 px-3 py-2.5">
          {action.input && Object.keys(action.input).length > 0 && (
            <DetailBlock label="Input" value={action.input} />
          )}
          {action.output && Object.keys(action.output).length > 0 && (
            <DetailBlock label="Output" value={action.output} />
          )}
        </div>
      )}
    </div>
  );
});

const ThinkingCard = memo(function ThinkingCard() {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
      <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs font-medium text-foreground">Preparing request</span>
      <Loader2 className="ml-auto size-3.5 animate-spin text-primary" />
    </div>
  );
});

interface HandoffCardProps {
  action: AgentAction;
  isRunning: boolean;
}

const HandoffCard = memo(function HandoffCard({
  action,
  isRunning,
}: HandoffCardProps) {
  const agentKey = action.to ?? "";
  const info = AGENT_LABELS[agentKey] ?? { label: agentKey || "Workspace Agent" };

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <ArrowRight className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">
          Routed to {info.label}
        </span>
        {action.parallel && (
          <span className="block text-[11px] text-muted-foreground">
            Parallel execution
          </span>
        )}
      </span>
      <StatusIcon status={isRunning ? "running" : "done"} />
    </div>
  );
});

interface ToolCallCardProps {
  action: AgentAction;
}

const ToolCallCard = memo(function ToolCallCard({ action }: ToolCallCardProps) {
  const toolKey = action.tool ?? "";
  const toolInfo = TOOL_LABELS[toolKey] ?? {
    label: toolKey || "Workspace action",
    category: "read" as ToolCategory,
  };
  const category = toolInfo.category;
  const Icon = getToolIcon(toolKey, category);
  const status = action.status === "calling"
    ? "running"
    : action.status === "error"
      ? "error"
      : "done";

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 transition-colors hover:bg-muted/30">
      <span className={`h-6 w-1 rounded-full ${CATEGORY_ACCENT[category]}`} />
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${CATEGORY_SURFACE[category]}`}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-medium ${CATEGORY_TEXT[category]}`}>
          {toolInfo.label}
        </span>
        {action.agent && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {AGENT_LABELS[action.agent]?.label ?? action.agent}
          </span>
        )}
      </span>
      <StatusIcon status={status} />
    </div>
  );
});

export interface ActionCardsGroupProps {
  actions: AgentAction[];
  isStreaming?: boolean;
}

export function ActionCardsGroup({
  actions,
  isStreaming,
}: ActionCardsGroupProps) {
  if (actions.length === 0) return null;

  const thinkingEvents = actions.filter((a) => a.type === "thinking");
  const handoffEvents = actions.filter((a) => a.type === "agent_handoff");
  const toolCallEvents = actions.filter((a) => a.type === "tool_call");

  const paired: {
    tool: string;
    start?: AgentAction;
    end?: AgentAction;
  }[] = [];

  const endMap = new Map<string, AgentAction>();
  for (const action of actions) {
    if (action.type === "tool_end") {
      endMap.set(action.tool ?? "", action);
    }
  }

  const seenEnds = new Set<string>();
  for (const action of actions) {
    if (action.type === "tool_start") {
      const key = action.tool ?? "";
      const end = endMap.get(key);
      if (end && !seenEnds.has(key)) {
        paired.push({ tool: key, start: action, end });
        seenEnds.add(key);
        endMap.delete(key);
      } else {
        paired.push({ tool: key, start: action });
      }
    }
  }

  for (const [tool, end] of endMap) {
    if (!seenEnds.has(tool)) {
      paired.push({ tool, end });
    }
  }

  const toolCallMerged: AgentAction[] = [];
  const toolCallDoneMap = new Map<string, AgentAction>();
  for (const action of toolCallEvents) {
    if (action.status === "done" || action.status === "error") {
      toolCallDoneMap.set(action.tool ?? "", action);
    }
  }

  const seenToolCalls = new Set<string>();
  for (const action of toolCallEvents) {
    if (action.status === "calling") {
      const key = action.tool ?? "";
      const done = toolCallDoneMap.get(key);
      toolCallMerged.push(done ?? action);
      seenToolCalls.add(key);
    }
  }

  for (const [tool, done] of toolCallDoneMap) {
    if (!seenToolCalls.has(tool)) {
      toolCallMerged.push(done);
    }
  }

  const hasContent =
    thinkingEvents.length > 0 ||
    handoffEvents.length > 0 ||
    toolCallMerged.length > 0 ||
    paired.length > 0;

  if (!hasContent) return null;

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">Actions</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {handoffEvents.length + toolCallMerged.length + paired.length}
        </span>
        {isStreaming && (
          <Loader2 className="ml-auto size-3.5 animate-spin text-primary" />
        )}
      </div>

      <div className="space-y-1.5 p-2">
        {isStreaming && thinkingEvents.length > 0 && handoffEvents.length === 0 && (
          <ThinkingCard />
        )}

        {handoffEvents.map((action, index) => {
          const agentKey = action.to ?? "";
          const stillRunning =
            isStreaming &&
            toolCallMerged.some(
              (toolCall) =>
                toolCall.agent === agentKey && toolCall.status === "calling",
            );

          return (
            <HandoffCard
              key={`handoff-${index}`}
              action={action}
              isRunning={Boolean(isStreaming && (stillRunning || toolCallMerged.length === 0))}
            />
          );
        })}

        {toolCallMerged.map((action, index) => (
          <ToolCallCard key={`tool-call-${index}`} action={action} />
        ))}

        {paired.map((pair, index) => {
          const action = pair.end ?? pair.start!;
          return (
            <ActionCard
              key={`legacy-${index}`}
              action={action}
              isRunning={!pair.end && isStreaming}
            />
          );
        })}
      </div>
    </div>
  );
}

export default ActionCard;
