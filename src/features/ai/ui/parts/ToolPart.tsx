'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { MessagePart } from '../../types/message';
import { getToolMeta, type ToolPartData } from '../registry/tools';

export type TracePartData =
  | ToolPartData
  | Extract<MessagePart, { type: 'agent-handoff' }>;

const CONTEXT_KEYS = [
  'title',
  'file_path',
  'query',
  'identifier',
  'name',
  'action',
  'target_bib_file',
] as const;

function formatToolContext(input?: Record<string, unknown>): string | null {
  if (!input) return null;
  for (const key of CONTEXT_KEYS) {
    const val = input[key];
    if (typeof val === 'string' && val.trim()) {
      const clean = val.trim();
      return clean.length <= 48 ? clean : `${clean.slice(0, 47)}…`;
    }
  }
  return null;
}

export function ToolPart({ part }: { part: ToolPartData }) {
  const [open, setOpen] = useState(false);

  const meta = getToolMeta(part.toolName);
  const Icon = meta.icon;
  const contextLabel = formatToolContext(part.input);
  const hasInspectorData = Boolean(part.input || part.output);

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground/90 truncate">
            {meta.label}
          </span>
          {contextLabel && (
            <span className="text-xs text-muted-foreground truncate">
              · {contextLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {part.status === 'calling' && (
            <Loader2 className="size-3 text-ai animate-spin shrink-0" />
          )}
          {part.status === 'done' && (
            <CheckCircle2 className="size-3 text-success/80 shrink-0" />
          )}
          {part.status === 'error' && (
            <AlertCircle className="size-3 text-destructive shrink-0" />
          )}

          {hasInspectorData && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-11 text-muted-foreground hover:text-foreground px-1 py-0.5 rounded hover:bg-muted/60 transition-colors cursor-pointer"
            >
              {open ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {part.error && (
        <p className="mt-1 ml-5 text-xs text-destructive/90 bg-destructive/5 rounded px-2 py-1 break-words">
          {part.error}
        </p>
      )}

      {open && hasInspectorData && (
        <div className="mt-1.5 ml-5 rounded-sm bg-muted/50 p-2 text-xs font-mono space-y-1">
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
        </div>
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
  const toolItems = items.filter(
    (item): item is ToolPartData => item.type === 'tool',
  );
  const runningTool = toolItems.find((t) => t.status === 'calling');
  const hasErrors = toolItems.some((item) => item.status === 'error');
  const defaultExpanded = isStreaming || hasErrors;

  const [toggleState, setToggleState] = useState<{
    forDefault: boolean;
    collapsed: boolean;
  }>({ forDefault: defaultExpanded, collapsed: !defaultExpanded });

  if (items.length === 0) return null;

  const runningHandoff = items.find(
    (item) => item.type === 'agent-handoff' && item.status === 'calling',
  );

  if (toolItems.length === 0) {
    if (
      !isStreaming ||
      !runningHandoff ||
      runningHandoff.type !== 'agent-handoff'
    ) {
      return null;
    }
    return (
      <div className="my-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 text-ai animate-spin shrink-0" />
        <span>{getActivityLabel(runningHandoff.to)}</span>
      </div>
    );
  }

  const collapsed =
    toggleState.forDefault === defaultExpanded
      ? toggleState.collapsed
      : !defaultExpanded;

  const runningContext = runningTool
    ? formatToolContext(runningTool.input)
    : null;
  const stepNoun = toolItems.length === 1 ? 'step' : 'steps';

  return (
    <div className="my-1.5">
      <button
        type="button"
        onClick={() =>
          setToggleState({
            forDefault: defaultExpanded,
            collapsed: !collapsed,
          })
        }
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
      >
        {runningTool ? (
          <Loader2 className="size-3 text-ai animate-spin shrink-0" />
        ) : hasErrors ? (
          <AlertCircle className="size-3 text-destructive shrink-0" />
        ) : (
          <CheckCircle2 className="size-3 text-success/80 shrink-0" />
        )}

        <span className="truncate">
          {runningTool ? (
            <>
              {getToolMeta(runningTool.toolName).label}
              {runningContext ? ` · ${runningContext}` : '…'}
            </>
          ) : hasErrors ? (
            `${toolItems.length} ${stepNoun} · failed`
          ) : (
            `${toolItems.length} ${stepNoun}`
          )}
        </span>

        <ChevronRight
          className={cn(
            'size-3 text-muted-foreground/60 transition-transform shrink-0',
            !collapsed && 'rotate-90',
          )}
        />
      </button>

      {!collapsed && (
        <div className="ml-1.5 mt-1 pl-3 border-l border-border/50 space-y-1">
          {toolItems.map((item, idx) => (
            <ToolPart key={item.toolCallId || idx} part={item} />
          ))}
        </div>
      )}
    </div>
  );
}
