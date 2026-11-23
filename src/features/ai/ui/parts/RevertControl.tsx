'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { revertAiTurn } from '../../engine/queries';
import type {
  RevertibleTurnItem,
  RevertibleTurnWidget,
} from '../../types/message';

function formatToolTag(tool: string): string {
  return tool.replace(/_/g, ' ').trim();
}

export function RevertControl({ widget }: { widget: RevertibleTurnWidget }) {
  const [pending, setPending] = useState<RevertibleTurnItem[]>(
    () => widget.data.items ?? [],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((widget.data.items ?? []).map((item) => item.entity_id)),
  );
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'reverting' | 'reverted' | 'error'
  >('idle');
  const [revertedTotal, setRevertedTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const remainingCount = pending.length || (status === 'reverted' ? 0 : widget.data.count);
  const selectedIds = pending
    .filter((item) => selected.has(item.entity_id))
    .map((item) => item.entity_id);

  const toggleItem = (entityId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const runRevert = async (targetIds?: string[]) => {
    if (status === 'reverting' || status === 'reverted') return;
    setStatus('reverting');
    setErrorMsg('');

    const isSelective =
      Boolean(targetIds?.length) &&
      ((targetIds?.length ?? 0) < pending.length || revertedTotal > 0);

    try {
      const res = await revertAiTurn(
        widget.data.traceId,
        widget.data.spaceId,
        isSelective ? targetIds : undefined,
      );

      const doneIds = new Set(
        res.results
          .filter((r) => r.status === 'reverted' || r.status === 'already_gone')
          .map((r) => r.entity_id),
      );
      const nextPending =
        pending.length > 0
          ? pending.filter((item) => !doneIds.has(item.entity_id))
          : [];
      const nextTotal =
        revertedTotal + (doneIds.size > 0 ? doneIds.size : res.reverted_count || 0);

      if (doneIds.size > 0) {
        setPending(nextPending);
        setSelected((prev) => {
          const next = new Set(prev);
          doneIds.forEach((id) => next.delete(id));
          return next;
        });
        setRevertedTotal(nextTotal);
      }

      const failed = res.results.find((r) => r.status === 'failed');
      if (failed) {
        setStatus('error');
        setErrorMsg(failed.error || 'Revert failed');
        return;
      }

      if (nextPending.length === 0) {
        setRevertedTotal(nextTotal || widget.data.count);
        setStatus('reverted');
        setExpanded(false);
        return;
      }

      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Revert failed');
    }
  };

  if (status === 'reverted') {
    return (
      <div className="inline-flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
        <CheckCircle2
          className="size-3.5 text-success/80 shrink-0"
          aria-hidden="true"
        />
        <span>Reverted {revertedTotal}</span>
      </div>
    );
  }

  return (
    <div className="py-0.5 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={status === 'reverting'}
          onClick={() => {
            void runRevert(pending.map((item) => item.entity_id));
          }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60 transition-colors cursor-pointer rounded px-1.5 py-0.5 hover:bg-muted/60"
        >
          {status === 'reverting' ? (
            <Loader2
              className="size-3 text-ai animate-spin shrink-0"
              aria-hidden="true"
            />
          ) : (
            <RotateCcw className="size-3 shrink-0" aria-hidden="true" />
          )}
          <span>Undo ({remainingCount})</span>
        </button>

        {pending.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label="Preview changes"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 text-11 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60"
          >
            <span>{expanded ? 'Hide' : 'Preview'}</span>
            {expanded ? (
              <ChevronUp className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
            )}
          </button>
        )}

        {revertedTotal > 0 && (
          <span className="text-11 text-muted-foreground">
            ({revertedTotal} reverted)
          </span>
        )}

        {status === 'error' && errorMsg && (
          <span className="text-xs text-destructive/90">{errorMsg}</span>
        )}
      </div>

      {expanded && pending.length > 0 && (
        <div className="mt-1.5 rounded-md border border-border/70 bg-card/70 px-2.5 py-2 space-y-1.5">
          <ul className="space-y-1">
            {pending.map((item) => {
              const checked = selected.has(item.entity_id);
              return (
                <li
                  key={item.entity_id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={status === 'reverting'}
                      onChange={() => toggleItem(item.entity_id)}
                      className="size-3.5 rounded border-border accent-primary shrink-0"
                    />
                    <span className="truncate text-foreground">
                      {item.label || item.entity_id}
                    </span>
                  </label>
                  <span className="shrink-0 text-11 font-mono text-muted-foreground">
                    {formatToolTag(item.tool)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end pt-1 border-t border-border/50">
            <button
              type="button"
              disabled={selectedIds.length === 0 || status === 'reverting'}
              onClick={() => {
                void runRevert(selectedIds);
              }}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-11 font-medium text-foreground bg-muted/70 hover:bg-muted disabled:opacity-50 cursor-pointer transition-colors"
            >
              <span>Undo selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
