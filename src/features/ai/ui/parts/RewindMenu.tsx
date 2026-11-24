'use client';

import React, { useState } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { fluxTransport } from '../../engine/queries';

export interface RewindCheckpointItem {
  checkpoint_id: string;
  parent_checkpoint_id?: string | null;
  created_at?: string | null;
  step?: number | null;
  message_count: number;
  route?: string | null;
  preview: string;
}

export interface RewindMenuProps {
  chatId: string;
  spaceId?: string | null;
  disabled?: boolean;
  onRewound?: (messageCount: number) => void;
}

/** Deduplicate LangGraph step snapshots down to newest checkpoint per distinct message_count. */
function dedupeByTurnBoundary(
  checkpoints: RewindCheckpointItem[],
): RewindCheckpointItem[] {
  const seenCounts = new Set<number>();
  const result: RewindCheckpointItem[] = [];
  for (const ckpt of checkpoints) {
    if (ckpt.message_count <= 0) continue;
    if (seenCounts.has(ckpt.message_count)) continue;
    seenCounts.add(ckpt.message_count);
    result.push(ckpt);
  }
  return result;
}

export function RewindMenu({
  chatId,
  spaceId,
  disabled = false,
  onRewound,
}: RewindMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rewindingId, setRewindingId] = useState<string | null>(null);
  const [items, setItems] = useState<RewindCheckpointItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const handleToggle = async () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fluxTransport.listCheckpoints(chatId, spaceId, 20);
      setItems(dedupeByTurnBoundary(res.checkpoints ?? []));
    } catch (err) {
      setItems([]);
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to load checkpoints',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRewind = async (ckpt: RewindCheckpointItem) => {
    if (rewindingId) return;
    setRewindingId(ckpt.checkpoint_id);
    setErrorMsg('');
    try {
      const res = await fluxTransport.rewindThread(
        chatId,
        ckpt.checkpoint_id,
        spaceId,
      );
      toast.success(`Rewound conversation to ${res.message_count} message(s)`);
      setOpen(false);
      onRewound?.(res.message_count);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to rewind conversation',
      );
    } finally {
      setRewindingId(null);
    }
  };

  return (
    <div className="relative inline-block text-xs">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-label="Rewind conversation"
        onClick={() => {
          void handleToggle();
        }}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors cursor-pointer rounded px-2 py-1 hover:bg-muted/60"
      >
        <History className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Rewind</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 z-30 rounded-md border border-border bg-card shadow-md p-2 space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-border/50">
            <span className="text-11 font-semibold text-foreground">
              Conversation checkpoints
            </span>
            {loading && (
              <Loader2
                className="size-3 text-ai animate-spin shrink-0"
                aria-hidden="true"
              />
            )}
          </div>

          {errorMsg && (
            <p className="px-1 py-0.5 text-11 text-destructive">{errorMsg}</p>
          )}

          {!loading && !errorMsg && items.length === 0 && (
            <p className="px-1 py-2 text-11 text-muted-foreground">
              No prior checkpoints found.
            </p>
          )}

          {items.length > 0 && (
            <ul className="max-h-60 overflow-y-auto space-y-1">
              {items.map((ckpt) => {
                const isBusy = rewindingId === ckpt.checkpoint_id;
                return (
                  <li key={ckpt.checkpoint_id}>
                    <button
                      type="button"
                      disabled={Boolean(rewindingId)}
                      onClick={() => {
                        void handleRewind(ckpt);
                      }}
                      className="w-full text-left flex items-start justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/70 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-foreground">
                          {ckpt.preview ||
                            `Turn (${ckpt.message_count} messages)`}
                        </p>
                        <p className="text-11 text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{ckpt.message_count} msgs</span>
                          {ckpt.route && (
                            <span className="font-mono text-11 text-muted-foreground/80">
                              {ckpt.route}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 shrink-0 text-11 text-muted-foreground mt-0.5">
                        {isBusy ? (
                          <Loader2
                            className="size-3 text-ai animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <RotateCcw className="size-3" aria-hidden="true" />
                        )}
                        <span>Rewind</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
