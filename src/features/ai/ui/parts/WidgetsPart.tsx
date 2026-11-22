'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitCompare,
  ListTodo,
  Loader2,
  RotateCcw,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { revertAiTurn } from '../../engine/queries';
import type {
  EditorPatchesWidget,
  EditorPatchItem,
  ResponseWidget,
  RevertibleTurnWidget,
} from '../../types/message';

function normalizePriority(priority?: string) {
  const value = (priority || 'none').toLowerCase();
  if (value === 'urgent') {
    return { label: 'Urgent', dotClass: 'bg-destructive' };
  }
  if (value === 'high') {
    return { label: 'High', dotClass: 'bg-warning' };
  }
  if (value === 'medium') {
    return { label: 'Medium', dotClass: 'bg-primary' };
  }
  if (value === 'low') {
    return { label: 'Low', dotClass: 'bg-success' };
  }
  return { label: 'None', dotClass: 'bg-muted-foreground' };
}

function StatBadge({
  icon: Icon,
  label,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const toneIndicator = {
    default: {
      dotClass: 'bg-muted-foreground',
      iconClass: 'text-muted-foreground',
    },
    good: { dotClass: 'bg-success', iconClass: 'text-success' },
    warn: { dotClass: 'bg-warning', iconClass: 'text-warning' },
  }[tone];

  return (
    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-sm border border-border bg-card text-11 font-medium text-foreground shrink-0">
      <span
        className={cn('size-1.5 rounded-full shrink-0', toneIndicator.dotClass)}
        aria-hidden="true"
      />
      <Icon
        className={cn('size-3 shrink-0', toneIndicator.iconClass)}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

function MetricSummaryCard({
  widget,
}: {
  widget: Extract<ResponseWidget, { type: 'metric_summary' }>;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h4 className="text-xs font-semibold text-muted-foreground">
        {widget.title}
      </h4>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {widget.metrics.map((metric, i) => (
          <div key={i} className="border-t border-border/50 pt-2.5">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold font-mono tabular-nums text-foreground">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkItemOverviewCard({
  widget,
}: {
  widget: Extract<ResponseWidget, { type: 'work_item_overview' }>;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">
            {widget.title}
          </h4>
          {widget.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {widget.subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-11">
          <StatBadge icon={ListTodo} label={`${widget.total} Total`} />
          <StatBadge
            icon={CheckCircle2}
            label={`${widget.done} Done`}
            tone="good"
          />
          {widget.overdue > 0 && (
            <StatBadge
              icon={AlertTriangle}
              label={`${widget.overdue} Overdue`}
              tone="warn"
            />
          )}
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {widget.groups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {group.label}
            </p>
            <div className="divide-y divide-border-subtle">
              {group.workItems.map((item, itemIdx) => {
                const priority = normalizePriority(item.priority);
                return (
                  <div
                    key={item.id || itemIdx}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {item.completed ? (
                        <CheckCircle2
                          className="size-3.5 text-success shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <CircleDot
                          className="size-3.5 text-muted-foreground/60 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`truncate ${
                          item.completed
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {item.project?.name && (
                        <span className="hidden sm:inline text-11 px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                          {item.project.name}
                        </span>
                      )}
                      {item.assignee && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <UserRound className="size-3 shrink-0" aria-hidden="true" />
                          <span>{item.assignee}</span>
                        </span>
                      )}
                      {item.dueDate && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${
                            item.isOverdue
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                          <span>
                            {new Date(item.dueDate).toLocaleDateString(
                              undefined,
                              {
                                month: 'short',
                                day: 'numeric',
                              },
                            )}
                          </span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-sm border border-border bg-card text-11 font-medium text-foreground shrink-0">
                        <span
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            priority.dotClass,
                          )}
                          aria-hidden="true"
                        />
                        <span>{priority.label}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatchDiffPreview({
  searchText,
  replaceText,
  kind,
}: {
  searchText: string;
  replaceText: string;
  kind?: EditorPatchItem['kind'];
}) {
  const removedLines =
    kind === 'insert_preamble'
      ? []
      : searchText
          ? searchText.split('\n')
          : [];
  const addedLines =
    kind === 'insert_preamble'
      ? replaceText
          .split('\n')
          .filter((ln) => ln.trim() !== '\\begin{document}')
      : replaceText
        ? replaceText.split('\n')
        : [];

  const maxLines = 8;
  const shownRemoved = removedLines.slice(0, maxLines);
  const shownAdded = addedLines.slice(0, maxLines);

  if (shownRemoved.length === 0 && shownAdded.length === 0) return null;

  return (
    <div className="mt-1.5 rounded-sm border border-border/80 bg-background font-mono text-[11px] leading-snug overflow-x-auto">
      {shownRemoved.map((line, i) => (
        <div
          key={`del-${i}`}
          className="px-2 py-0.5 bg-destructive/8 text-destructive whitespace-pre"
        >
          {`- ${line}`}
        </div>
      ))}
      {removedLines.length > maxLines && (
        <div className="px-2 py-0.5 text-muted-foreground text-10">
          {`... ${removedLines.length - maxLines} more removed line(s)`}
        </div>
      )}
      {shownAdded.map((line, i) => (
        <div
          key={`add-${i}`}
          className="px-2 py-0.5 bg-success/8 text-success whitespace-pre"
        >
          {`+ ${line}`}
        </div>
      ))}
      {addedLines.length > maxLines && (
        <div className="px-2 py-0.5 text-muted-foreground text-10">
          {`... ${addedLines.length - maxLines} more added line(s)`}
        </div>
      )}
    </div>
  );
}

function EditorPatchesCard({
  widget,
  onReviewEditorPatch,
  onApplyAllEditorPatches,
}: {
  widget: EditorPatchesWidget;
  onReviewEditorPatch?: (patch: EditorPatchItem) => void;
  onApplyAllEditorPatches?: (patches: EditorPatchItem[]) => void;
}) {
  const patches = widget.patches || [];
  if (patches.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileCode2 className="size-3.5 text-ai shrink-0" aria-hidden="true" />
          <h4 className="text-12 font-semibold text-foreground truncate">
            {widget.title}
          </h4>
          <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-px text-10 font-mono tabular-nums text-muted-foreground">
            {patches.length}
          </span>
          {widget.streaming && (
            <span className="inline-flex items-center rounded-sm bg-ai/10 px-1.5 py-px text-10 font-medium text-ai shrink-0">
              Live preview
            </span>
          )}
        </div>
        {patches.length > 1 && onApplyAllEditorPatches && (
          <button
            type="button"
            onClick={() => onApplyAllEditorPatches(patches)}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 text-11 font-medium text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <Check className="size-3 text-success" aria-hidden="true" />
            <span>Apply All</span>
          </button>
        )}
      </div>

      {widget.provenance && widget.provenance.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/20 px-3 py-1.5">
          <span className="text-10 font-medium text-muted-foreground">
            Source:
          </span>
          {widget.provenance.map((item, idx) => {
            const safeUrl =
              item.url.startsWith('https://') || item.url.startsWith('http://')
                ? item.url
                : undefined;
            if (!safeUrl) return null;
            return (
              <a
                key={`${item.repo}-${item.commitSha}-${idx}`}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`${item.repo}/${item.path} @ ${item.commitSha}`}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-10 text-foreground hover:bg-muted transition-colors"
              >
                <GitBranch
                  className="size-3 text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
                <span>{`${item.repo}@${item.commitSha.slice(0, 7)}`}</span>
                <ExternalLink
                  className="size-2.5 text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              </a>
            );
          })}
        </div>
      )}

      <div className="divide-y divide-border">
        {patches.map((patch, idx) => {
          const lineLabel =
            typeof patch.fromLine === 'number'
              ? typeof patch.toLine === 'number' && patch.toLine > patch.fromLine
                ? `L${patch.fromLine}-${patch.toLine}`
                : `L${patch.fromLine}`
              : null;

          return (
            <div key={patch.id || idx} className="p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="font-mono text-11 font-medium text-foreground truncate"
                    title={patch.filePath}
                  >
                    {patch.filePath}
                  </span>
                  {lineLabel && (
                    <span className="rounded-sm bg-muted px-1.5 py-px font-mono text-10 tabular-nums text-muted-foreground shrink-0">
                      {lineLabel}
                    </span>
                  )}
                </div>

                {onReviewEditorPatch && (
                  <button
                    type="button"
                    onClick={() => onReviewEditorPatch(patch)}
                    className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-11 font-medium text-ai bg-ai/10 hover:bg-ai/15 transition-colors cursor-pointer shrink-0"
                    title="Inspect hunk interactively in CodeMirror"
                  >
                    <GitCompare className="size-3" aria-hidden="true" />
                    <span>Review Diff</span>
                  </button>
                )}
              </div>

              <p className="text-12 font-medium text-foreground">
                {patch.title}
              </p>
              {patch.rationale && (
                <p className="text-11 text-muted-foreground leading-snug">
                  {patch.rationale}
                </p>
              )}

              {patch.warnings && patch.warnings.length > 0 && (
                <div className="flex items-start gap-1.5 rounded-sm bg-warning/10 px-2 py-1 text-11 text-warning">
                  <AlertTriangle className="size-3 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{patch.warnings.join(' ')}</span>
                </div>
              )}

              <PatchDiffPreview
                searchText={patch.searchText}
                replaceText={patch.replaceText}
                kind={patch.kind}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevertibleTurnControl({
  widget,
}: {
  widget: RevertibleTurnWidget;
}) {
  const [status, setStatus] = useState<'idle' | 'reverting' | 'reverted' | 'error'>('idle');
  const [revertedCount, setRevertedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRevert = async () => {
    if (status === 'reverting' || status === 'reverted') return;
    setStatus('reverting');
    setErrorMsg('');
    try {
      const res = await revertAiTurn(
        widget.data.traceId,
        widget.data.spaceId,
      );
      const failed = res.results.find((r) => r.status === 'failed');
      if (failed) {
        setStatus('error');
        setErrorMsg(failed.error || 'Revert failed');
        return;
      }
      setRevertedCount(res.reverted_count || widget.data.count);
      setStatus('reverted');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Revert failed');
    }
  };

  if (status === 'reverted') {
    return (
      <div className="inline-flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-success/80 shrink-0" aria-hidden="true" />
        <span>Reverted {revertedCount}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-0.5 text-xs">
      <button
        type="button"
        disabled={status === 'reverting'}
        onClick={() => {
          void handleRevert();
        }}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60 transition-colors cursor-pointer rounded px-1.5 py-0.5 hover:bg-muted/60"
      >
        {status === 'reverting' ? (
          <Loader2 className="size-3 text-ai animate-spin shrink-0" aria-hidden="true" />
        ) : (
          <RotateCcw className="size-3 shrink-0" aria-hidden="true" />
        )}
        <span>Undo ({widget.data.count})</span>
      </button>
      {status === 'error' && errorMsg && (
        <span className="text-xs text-destructive/90">{errorMsg}</span>
      )}
    </div>
  );
}

export interface WidgetsPartProps {
  widgets?: ResponseWidget[];
  onReviewEditorPatch?: (patch: EditorPatchItem) => void;
  onApplyAllEditorPatches?: (patches: EditorPatchItem[]) => void;
}

export function WidgetsPart({
  widgets,
  onReviewEditorPatch,
  onApplyAllEditorPatches,
}: WidgetsPartProps) {
  if (!widgets || widgets.length === 0) return null;

  return (
    <div className="my-2.5 space-y-2.5">
      {widgets.map((widget, index) =>
        widget.type === 'work_item_overview' ? (
          <WorkItemOverviewCard key={index} widget={widget} />
        ) : widget.type === 'editor_patches' ? (
          <EditorPatchesCard
            key={index}
            widget={widget}
            onReviewEditorPatch={onReviewEditorPatch}
            onApplyAllEditorPatches={onApplyAllEditorPatches}
          />
        ) : widget.type === 'revertible_turn' ? (
          <RevertibleTurnControl key={index} widget={widget} />
        ) : (
          <MetricSummaryCard key={index} widget={widget} />
        ),
      )}
    </div>
  );
}
