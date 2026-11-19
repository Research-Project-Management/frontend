import type {
  AgentAction,
  FluxMessage,
  MessageAttachment,
  MessagePart,
  ResponseWidget,
  WorkItemItem,
} from '../types/message';
import type { StoredChatMessage } from '../types/session';

type WorkItemLike = {
  id?: string;
  title?: string;
  priority?: string;
  assignee?: { name?: string } | string | null;
  dueDate?: string | null;
  isOverdue?: boolean;
  completed?: boolean;
  project?: { name?: string; avatar?: string } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeWorkItem(item: WorkItemLike): WorkItemItem {
  const assignee =
    typeof item.assignee === 'string'
      ? item.assignee
      : item.assignee?.name || '';
  return {
    id: item.id,
    title: item.title || 'Untitled work item',
    priority: item.priority || 'none',
    assignee,
    dueDate: item.dueDate ?? null,
    isOverdue: Boolean(item.isOverdue),
    completed: Boolean(item.completed),
    project: item.project
      ? {
          name: item.project.name || 'Unknown Project',
          avatar: item.project.avatar,
        }
      : null,
  };
}

function buildWorkItemWidget(
  tool: string,
  output: Record<string, unknown>,
): ResponseWidget | null {
  const rawColumns = asRecord(output.columns);
  const rawItems = Array.isArray(output.workItems)
    ? (output.workItems as WorkItemLike[])
    : Array.isArray(output.tasks)
      ? (output.tasks as WorkItemLike[])
      : Array.isArray(output.items)
        ? (output.items as WorkItemLike[])
        : [];

  if (!rawColumns && rawItems.length === 0) return null;

  const isMyItems = tool === 'get_my_work_items' || tool === 'get_my_tasks';
  const groups = rawColumns
    ? Object.entries(rawColumns)
        .map(([columnName, items]) => ({
          label: columnName,
          workItems: Array.isArray(items)
            ? items.map((item) => normalizeWorkItem(item as WorkItemLike))
            : [],
        }))
        .filter((group) => group.workItems.length > 0)
    : [
        {
          label: isMyItems ? 'Assigned to you' : 'Work Items',
          workItems: rawItems.map(normalizeWorkItem),
        },
      ];

  const allItems = groups.flatMap((g) => g.workItems);
  const done = allItems.filter((item) => item.completed).length;
  const overdue = allItems.filter((item) => item.isOverdue).length;

  return {
    type: 'work_item_overview',
    title: isMyItems
      ? 'My Work Items Overview'
      : 'Workspace Work Items Overview',
    subtitle: `${allItems.length} work item${allItems.length === 1 ? '' : 's'} tracked across this view`,
    total: allItems.length,
    done,
    inProgress: Math.max(allItems.length - done, 0),
    overdue,
    groups,
  };
}

function buildMetricWidget(
  output: Record<string, unknown>,
): ResponseWidget | null {
  const metrics: Array<{
    label: string;
    value: string | number;
    tone?: 'default' | 'good' | 'warn' | 'bad';
  }> = [];

  const totalCount =
    typeof output.total_work_items === 'number'
      ? output.total_work_items
      : typeof output.total_tasks === 'number'
        ? output.total_tasks
        : undefined;
  const completedCount =
    typeof output.completed_work_items === 'number'
      ? output.completed_work_items
      : typeof output.completed_tasks === 'number'
        ? output.completed_tasks
        : undefined;
  const overdueCount =
    typeof output.overdue_work_items === 'number'
      ? output.overdue_work_items
      : typeof output.overdue_tasks === 'number'
        ? output.overdue_tasks
        : undefined;

  if (typeof totalCount === 'number') {
    metrics.push({ label: 'Total Work Items', value: totalCount });
  }
  if (typeof completedCount === 'number') {
    metrics.push({ label: 'Completed', value: completedCount, tone: 'good' });
  }
  if (typeof overdueCount === 'number') {
    metrics.push({
      label: 'Overdue',
      value: overdueCount,
      tone: overdueCount > 0 ? 'warn' : 'default',
    });
  }
  if (typeof output.completion_rate === 'number') {
    metrics.push({
      label: 'Completion Rate',
      value: `${Math.round(output.completion_rate * 100)}%`,
      tone: output.completion_rate >= 0.7 ? 'good' : 'default',
    });
  }

  if (metrics.length === 0) return null;

  return {
    type: 'metric_summary',
    title: 'Workload Summary',
    metrics,
  };
}

export function buildWidgetsFromToolOutput(
  toolName: string,
  output: Record<string, unknown> | undefined,
): ResponseWidget[] {
  if (!output) return [];
  if (
    toolName === 'list_work_items' ||
    toolName === 'list_tasks' ||
    toolName === 'get_my_work_items' ||
    toolName === 'get_my_tasks'
  ) {
    const widget = buildWorkItemWidget(toolName, output);
    return widget ? [widget] : [];
  }
  if (
    toolName === 'summarize_member_work_items' ||
    toolName === 'summarize_member_tasks' ||
    toolName === 'get_workload_distribution'
  ) {
    const widget = buildMetricWidget(output);
    return widget ? [widget] : [];
  }
  return [];
}

export function buildWidgetsFromActions(
  actions: AgentAction[],
): ResponseWidget[] {
  const widgets: ResponseWidget[] = [];
  for (const action of actions) {
    const isFinishedTool =
      (action.type === 'tool_end' || action.type === 'tool_call') &&
      action.status === 'done';
    if (!isFinishedTool) continue;

    if (Array.isArray(action.widgets) && action.widgets.length > 0) {
      widgets.push(...action.widgets);
      continue;
    }

    if (action.tool && action.output) {
      widgets.push(...buildWidgetsFromToolOutput(action.tool, action.output));
    }
  }
  return widgets;
}

export function parseThinkBlocks(raw: string): {
  reasoning: string | null;
  text: string;
  isReasoningOpen: boolean;
} {
  const openIdx = raw.indexOf('<think>');
  if (openIdx === -1) {
    return { reasoning: null, text: raw, isReasoningOpen: false };
  }
  const closeIdx = raw.indexOf('</think>', openIdx);
  if (closeIdx === -1) {
    return {
      reasoning: raw.slice(openIdx + 7),
      text: raw.slice(0, openIdx).trim(),
      isReasoningOpen: true,
    };
  }
  const before = raw.slice(0, openIdx).trim();
  const after = raw.slice(closeIdx + 8).trimStart();
  const combined = [before, after].filter(Boolean).join('\n\n');
  return {
    reasoning: raw.slice(openIdx + 7, closeIdx).trim(),
    text: combined,
    isReasoningOpen: false,
  };
}

export function mapStoredMessagesToFlux(
  rawMessages: StoredChatMessage[],
): FluxMessage[] {
  return (rawMessages || []).map((msg, idx) => {
    const role =
      msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system'
        ? msg.role
        : 'assistant';
    const content = typeof msg.content === 'string' ? msg.content : '';
    const attachments: MessageAttachment[] | undefined =
      Array.isArray(msg.attachments) && msg.attachments.length > 0
        ? msg.attachments
        : role === 'user' && Array.isArray(msg.sources) && msg.sources.length > 0
          ? msg.sources.map((s, sIdx) => ({
              id: s.id || `legacy-att-${idx}-${sIdx}`,
              name: s.title || s.source || 'Attachment',
              sourceType:
                s.sourceType === 'library' ||
                s.sourceType === 'storage' ||
                s.sourceType === 'paper'
                  ? s.sourceType
                  : 'upload',
            }))
          : undefined;

    const actions = Array.isArray(msg.actions) ? msg.actions : undefined;
    const widgets =
      Array.isArray(msg.widgets) && msg.widgets.length > 0
        ? msg.widgets
        : actions
          ? buildWidgetsFromActions(actions)
          : undefined;
    const sources =
      role !== 'user' && Array.isArray(msg.sources) && msg.sources.length > 0
        ? msg.sources
        : undefined;

    const parts: MessagePart[] = [];
    if (role === 'assistant') {
      if (actions && actions.length > 0) {
        actions.forEach((act, aIdx) => {
          if (act.type === 'agent_handoff' && act.to) {
            parts.push({
              type: 'agent-handoff',
              to: act.to,
              parallel: act.parallel,
              status: act.status ?? 'done',
            });
          } else if (act.tool) {
            parts.push({
              type: 'tool',
              toolCallId: `hist-tool-${idx}-${aIdx}`,
              toolName: act.tool,
              agent: act.agent,
              status: act.status ?? 'done',
              input: act.input,
              output: act.output,
              error: act.error,
            });
          }
        });
      }

      const { reasoning, text, isReasoningOpen } = parseThinkBlocks(content);
      if (reasoning) {
        parts.push({
          type: 'reasoning',
          text: reasoning,
          streaming: isReasoningOpen,
        });
      }
      if (text) {
        parts.push({ type: 'text', text });
      }
      if (widgets && widgets.length > 0) {
        parts.push({ type: 'widgets', widgets });
      }
      if (sources && sources.length > 0) {
        parts.push({ type: 'sources', sources });
      }
    } else if (content) {
      parts.push({ type: 'text', text: content });
    }

    return {
      id: msg.id || `hist-${idx}`,
      role,
      content,
      parts,
      attachments,
      sources,
      actions,
      widgets: widgets && widgets.length > 0 ? widgets : undefined,
      agent: msg.agent,
      createdAt: msg.createdAt,
    };
  });
}
