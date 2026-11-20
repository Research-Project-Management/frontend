'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { MessagePart } from '../../types/message';
import { getAgentMeta } from '../registry/agents';
import {
  CATEGORY_SURFACE,
  getToolMeta,
  getToolUI,
  type ToolPartData,
} from '../registry/tools';

export type TracePartData =
  | ToolPartData
  | Extract<MessagePart, { type: 'agent-handoff' }>;

export function ToolPart({ part }: { part: ToolPartData }) {
  const [open, setOpen] = useState(false);
  const CustomUI = getToolUI(part.toolName);
  if (CustomUI) {
    return <CustomUI part={part} />;
  }

  const meta = getToolMeta(part.toolName);
  const Icon = meta.icon;

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`p-1 rounded-md ${CATEGORY_SURFACE[meta.category]}`}>
            <Icon className="size-3 shrink-0" />
          </span>
          <span className="text-xs font-medium text-foreground truncate">
            {meta.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {part.status === 'calling' && (
            <Loader2 className="size-3 text-ai animate-spin shrink-0" />
          )}
          {part.status === 'done' && (
            <CheckCircle2 className="size-3 text-success shrink-0" />
          )}
          {part.status === 'error' && (
            <AlertCircle className="size-3 text-destructive shrink-0" />
          )}

          {(part.input || part.output || part.error) && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-xs text-foreground px-1.5 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
            >
              {open ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-1.5 rounded-sm bg-muted/60 p-2 text-xs font-mono space-y-1">
          {part.input && (
            <div>
              <p className="text-xs text-muted-foreground font-sans font-semibold">
                Input:
              </p>
              <pre className="text-foreground/80 whitespace-pre-wrap">
                {JSON.stringify(part.input, null, 2)}
              </pre>
            </div>
          )}
          {part.output && (
            <div>
              <p className="text-xs text-muted-foreground font-sans font-semibold">
                Output:
              </p>
              <pre className="text-foreground/80 whitespace-pre-wrap">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          )}
          {part.error && (
            <div className="text-destructive">
              <p className="text-xs font-sans font-semibold">Error:</p>
              <p>{part.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentHandoffPart({
  part,
}: {
  part: Extract<MessagePart, { type: 'agent-handoff' }>;
}) {
  const names = part.to
    .split(',')
    .map((id) => getAgentMeta(id.trim()).label)
    .join(', ');

  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2 min-w-0">
        <ArrowRight className="size-3 text-ai shrink-0" />
        <span className="truncate">
          Delegating to <strong className="font-semibold text-foreground">{names}</strong>
        </span>
      </div>
      {part.status === 'calling' && (
        <Loader2 className="size-3 text-ai animate-spin shrink-0" />
      )}
      {part.status === 'done' && (
        <CheckCircle2 className="size-3 text-success shrink-0" />
      )}
      {part.status === 'error' && (
        <AlertCircle className="size-3 text-destructive shrink-0" />
      )}
    </div>
  );
}

function getActivityLabel(target: string): string {
  const first = target.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first === 'library_agent' || first === 'library') {
    return 'Searching library…';
  }
  if (first === 'rag_agent' || first === 'rag') {
    return 'Reading documents…';
  }
  if (first === 'web_search_agent' || first === 'web_search') {
    return 'Searching web…';
  }
  return 'Working…';
}

export function ToolTraceGroup({
  items,
  isStreaming = false,
}: {
  items: TracePartData[];
  isStreaming?: boolean;
}) {
  const [toggleState, setToggleState] = useState<{
    forStreaming: boolean;
    collapsed: boolean;
  }>({ forStreaming: isStreaming, collapsed: !isStreaming });

  if (items.length === 0) return null;

  const toolItems = items.filter(
    (item): item is ToolPartData => item.type === 'tool',
  );
  const runningTool = toolItems.find((t) => t.status === 'calling');
  const runningHandoff = items.find(
    (item) => item.type === 'agent-handoff' && item.status === 'calling',
  );

  if (toolItems.length === 0) {
    if (!isStreaming || !runningHandoff || runningHandoff.type !== 'agent-handoff') {
      return null;
    }
    return (
      <div className="my-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 text-ai animate-spin shrink-0" />
        <span>{getActivityLabel(runningHandoff.to)}</span>
      </div>
    );
  }

  const collapsed =
    toggleState.forStreaming === isStreaming
      ? toggleState.collapsed
      : !isStreaming;
  const hasErrors = toolItems.some((item) => item.status === 'error');
  const doneTools = toolItems.filter((t) => t.status === 'done').length;

  let summaryPrefix = 'Executed ';
  let summaryCount = `${doneTools}/${toolItems.length}`;
  let summarySuffix = ` action${toolItems.length === 1 ? '' : 's'}`;
  if (runningTool) {
    summaryPrefix = `Running: ${getToolMeta(runningTool.toolName).label}`;
    summaryCount = '';
    summarySuffix = '';
  }

  return (
    <div className="my-2 rounded-md border border-border bg-panel/35 overflow-hidden">
      <button
        type="button"
        onClick={() =>
          setToggleState({
            forStreaming: isStreaming,
            collapsed: !collapsed,
          })
        }
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
          !collapsed && 'border-b border-border/60',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {runningTool ? (
            <Loader2 className="size-3.5 text-ai animate-spin shrink-0" />
          ) : hasErrors ? (
            <AlertCircle className="size-3.5 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className="size-3.5 text-success shrink-0" />
          )}

          <span className="text-xs font-medium text-foreground truncate">
            {summaryPrefix}
            {summaryCount && (
              <span className="font-mono tabular-nums">{summaryCount}</span>
            )}
            {summarySuffix}
          </span>
        </div>

        <ChevronDown
          className={`size-3.5 text-muted-foreground/60 transition-transform ${
            collapsed ? '-rotate-90' : ''
          } shrink-0`}
        />
      </button>

      {!collapsed && (
        <div className="divide-y divide-border/30 px-3 py-1.5">
          {toolItems.map((item, idx) => (
            <ToolPart key={item.toolCallId || idx} part={item} />
          ))}
        </div>
      )}
    </div>
  );
}
