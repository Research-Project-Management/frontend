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
  read: 'bg-[#3370ff]',
  create: 'bg-emerald-500',
  update: 'bg-amber-500',
  delete: 'bg-red-500',
  analyze: 'bg-violet-500',
};

const CATEGORY_TEXT: Record<ToolCategory, string> = {
  read: 'text-[#3370ff]',
  create: 'text-emerald-600 dark:text-emerald-400',
  update: 'text-amber-600 dark:text-amber-400',
  delete: 'text-red-500',
  analyze: 'text-violet-600 dark:text-violet-400',
};

const CATEGORY_SURFACE: Record<ToolCategory, string> = {
  read: 'bg-[#3370ff]/10 text-[#3370ff]',
  create: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  update: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  delete: 'bg-red-500/10 text-red-500',
  analyze: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
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
    <div className="my-2.5 rounded-xl border border-border/60 bg-card/40 overflow-hidden shadow-xs">
      {/* Header bar */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {runningAction ? (
            <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
          ) : hasErrors ? (
            <AlertCircle className="size-3.5 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
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
        <div className="border-t border-border/40 divide-y divide-border/20 px-3 py-2 space-y-1.5 bg-background/50">
          {thinkingAction && (
            <div className="text-[11px] text-muted-foreground italic flex items-center gap-1.5 py-1">
              <CircleDashed className="size-3 text-muted-foreground animate-spin" />
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
            <Icon className="size-3" />
          </span>
          <span className="text-xs font-medium text-foreground truncate">
            {toolMeta.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {action.status === 'calling' && (
            <Loader2 className="size-3 text-primary animate-spin" />
          )}
          {action.status === 'done' && (
            <CheckCircle2 className="size-3 text-emerald-500" />
          )}
          {action.status === 'error' && (
            <AlertCircle className="size-3 text-destructive" />
          )}

          {(action.input || action.output) && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary"
            >
              {open ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-1.5 rounded bg-muted/40 p-2 text-[11px] font-mono space-y-1">
          {action.input && (
            <div>
              <p className="text-[10px] text-muted-foreground font-sans font-semibold">Input:</p>
              <pre className="text-foreground/80 whitespace-pre-wrap">{JSON.stringify(action.input, null, 2)}</pre>
            </div>
          )}
          {action.output && (
            <div>
              <p className="text-[10px] text-muted-foreground font-sans font-semibold">Output:</p>
              <pre className="text-foreground/80 whitespace-pre-wrap">{JSON.stringify(action.output, null, 2)}</pre>
            </div>
          )}
          {action.error && (
            <div className="text-destructive">
              <p className="text-[10px] font-sans font-semibold">Error:</p>
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
