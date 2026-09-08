'use client';

import { memo, useState } from 'react';
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
} from 'lucide-react';
import type { AgentAction, ToolCategory } from '../../types/chat.types';
import { TOOL_LABELS } from '../../types/chat.types';

const CATEGORY_ACCENT: Record<ToolCategory, string> = {
  read: 'bg-primary',
  create: 'bg-success',
  update: 'bg-warning',
  delete: 'bg-destructive',
  analyze: 'bg-primary',
};

const CATEGORY_TEXT: Record<ToolCategory, string> = {
  read: 'text-primary',
  create: 'text-success',
  update: 'text-warning',
  delete: 'text-destructive',
  analyze: 'text-primary',
};

const CATEGORY_SURFACE: Record<ToolCategory, string> = {
  read: 'bg-primary/10 text-primary',
  create: 'bg-success/10 text-success',
  update: 'bg-warning/10 text-warning',
  delete: 'bg-destructive/10 text-destructive',
  analyze: 'bg-primary/10 text-primary',
};

const AGENT_LABELS: Record<string, { label: string }> = {
  task_agent: { label: 'Task Agent' },
  project_agent: { label: 'Project Agent' },
  cycle_agent: { label: 'Cycle Agent' },
  workspace_agent: { label: 'Workspace Agent' },
};

function getToolIcon(tool: string, category: ToolCategory) {
  if (tool.includes('task')) return ListTodo;
  if (tool.includes('project')) return FolderKanban;
  if (tool.includes('cycle')) return Layers3;
  if (tool.includes('page')) return FileText;
  if (tool.includes('comment')) return MessageSquare;
  if (tool.includes('label')) return Tag;
  if (tool.includes('member') || tool.includes('user')) return User;
  if (tool.includes('search')) return Search;
  if (tool.includes('summary') || tool.includes('analysis') || tool.includes('report') || tool.includes('velocity')) {
    return BarChart3;
  }
  if (category === 'create') return Plus;
  if (category === 'update') return Pencil;
  if (category === 'delete') return Trash2;
  if (category === 'analyze') return BarChart3;
  return Settings2;
}

export function ActionCardsGroup({
  actions,
  isStreaming = false,
}: {
  actions: AgentAction[];
  isStreaming?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (actions.length === 0) return null;

  const thinkingAction = actions.find((a) => a.type === 'thinking');
  const otherActions = actions.filter((a) => a.type !== 'thinking');
  const runningAction = actions.find((a) => a.status === 'calling');
  const hasErrors = actions.some((a) => a.status === 'error' || a.success === false);

  const doneCount = otherActions.filter((a) => a.status === 'done' || a.success === true).length;
  const totalCount = otherActions.length;

  return (
    <div className="my-2.5 rounded-md border border-border bg-card/40 overflow-hidden ">
      {/* Header bar */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {runningAction ? (
            <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
          ) : hasErrors ? (
            <AlertCircle className="size-3.5 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className="size-3.5 text-success shrink-0" />
          )}

          <span className="text-xs font-medium text-foreground truncate">
            {runningAction
              ? `Running: ${TOOL_LABELS[runningAction.tool ?? '']?.label ?? runningAction.tool ?? 'tool'}`
              : totalCount > 0
              ? `Executed ${doneCount}/${totalCount} actions`
              : 'Thinking…'}
          </span>
        </div>

        <ChevronDown
          className={`size-3.5 text-muted-foreground/60 transition-transform ${
            collapsed ? '-rotate-90' : ''
          }`}
        />
      </button>

      {/* Action items list */}
      {!collapsed && (
        <div className="border-t border-border divide-y divide-border/20 px-3 py-2 space-y-1.5 bg-background/50">
          {thinkingAction && (
            <div className="text-xs text-muted-foreground italic flex items-center gap-1.5 py-1">
              <CircleDashed className="size-3 text-muted-foreground animate-spin shrink-0" />
              <span>Analyzing intent and workspace context…</span>
            </div>
          )}

          {otherActions.map((action, idx) => (
            <ActionRow key={idx} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: AgentAction }) {
  const [open, setOpen] = useState(false);

  if (action.type === 'agent_handoff') {
    const fromLabel = AGENT_LABELS[action.from ?? '']?.label ?? action.from;
    const toLabel = AGENT_LABELS[action.to ?? '']?.label ?? action.to;
    return (
      <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
        <ArrowRight className="size-3 text-primary shrink-0" />
        <span>Delegating to <strong>{toLabel}</strong></span>
      </div>
    );
  }

  const toolMeta = TOOL_LABELS[action.tool ?? ''] ?? {
    label: action.tool ?? 'Unknown Tool',
    icon: '⚙️',
    category: 'read' as ToolCategory,
  };

  const Icon = getToolIcon(action.tool ?? '', toolMeta.category);

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`p-1 rounded-md ${CATEGORY_SURFACE[toolMeta.category]}`}>
            <Icon className="size-3 shrink-0" />
          </span>
          <span className="text-xs font-medium text-foreground truncate">
            {toolMeta.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {action.status === 'calling' && (
            <Loader2 className="size-3 text-primary animate-spin shrink-0" />
          )}
          {action.status === 'done' && (
            <CheckCircle2 className="size-3 text-success shrink-0" />
          )}
          {action.status === 'error' && (
            <AlertCircle className="size-3 text-destructive shrink-0" />
          )}

          {(action.input || action.output) && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-foreground px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              {open ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-1.5 rounded bg-muted p-2 text-xs font-mono space-y-1">
          {action.input && (
            <div>
              <p className="text-xs text-muted-foreground font-sans font-semibold">Input:</p>
              <pre className="text-foreground/80 whitespace-pre-wrap">{JSON.stringify(action.input, null, 2)}</pre>
            </div>
          )}
          {action.output && (
            <div>
              <p className="text-xs text-muted-foreground font-sans font-semibold">Output:</p>
              <pre className="text-foreground/80 whitespace-pre-wrap">{JSON.stringify(action.output, null, 2)}</pre>
            </div>
          )}
          {action.error && (
            <div className="text-destructive">
              <p className="text-xs font-sans font-semibold">Error:</p>
              <p>{action.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ActionCard = memo(function ActionCard({ action }: { action: AgentAction }) {
  return <ActionCardsGroup actions={[action]} />;
});
