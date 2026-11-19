'use client';

import React from 'react';
import { Check, Loader2, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { HitlDecision, MessagePart } from '../../types/message';

export type HitlPartData = Extract<MessagePart, { type: 'hitl' }>;

export interface HitlApprovalPartProps {
  part: HitlPartData;
  onResume?: (decisions: HitlDecision[]) => void | Promise<void>;
  compact?: boolean;
}

export function HitlApprovalPart({
  part,
  onResume,
  compact = false,
}: HitlApprovalPartProps) {
  const isPending = part.status === 'pending';
  const isSubmitting = part.status === 'submitting';
  const isApproved = part.status === 'approved';
  const isRejected = part.status === 'rejected';

  const handleDecision = (decision: 'approve' | 'reject') => {
    if (!onResume || isSubmitting) return;
    const decisions: HitlDecision[] = part.interrupts.map((intr) => ({
      decision,
      interruptId: intr.id,
    }));
    void onResume(decisions);
  };

  return (
    <div
      className={cn(
        'my-2 rounded-md border overflow-hidden',
        isPending || isSubmitting
          ? 'border-warning/40 bg-warning/10'
          : isApproved
            ? 'border-success/30 bg-success/10'
            : 'border-border bg-muted/40',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b border-border/50',
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldAlert
            className={cn(
              'size-3.5 shrink-0',
              isApproved
                ? 'text-success'
                : isRejected
                  ? 'text-muted-foreground'
                  : 'text-warning',
            )}
          />
          <span className="text-xs font-semibold text-foreground truncate">
            {isPending
              ? 'Confirmation required'
              : isSubmitting
                ? 'Submitting decision...'
                : isApproved
                  ? 'Action approved'
                  : 'Action rejected'}
          </span>
        </div>

        {(isApproved || isRejected) && (
          <span
            className={cn(
              'text-10 font-medium px-1.5 py-0.5 rounded-sm shrink-0',
              isApproved
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {isApproved ? 'Approved' : 'Rejected'}
          </span>
        )}
      </div>

      <div className={cn('divide-y divide-border/40', compact ? 'p-2.5' : 'p-3')}>
        {part.interrupts.map((intr) => (
          <div
            key={intr.id}
            className="py-2 first:pt-0 last:pb-0 text-xs space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-medium text-foreground truncate">
                {intr.tool || 'tool_call'}
              </span>
            </div>
            {intr.description && (
              <p className="text-11 text-muted-foreground leading-snug">
                {intr.description}
              </p>
            )}
            {intr.args && Object.keys(intr.args).length > 0 && (
              <pre className="rounded bg-muted p-1.5 font-mono text-10 text-foreground/80 overflow-x-auto max-h-28">
                {JSON.stringify(intr.args, null, 2)}
              </pre>
            )}
          </div>
        ))}

        {(isPending || isSubmitting) && onResume && (
          <div className="flex items-center justify-end gap-2 pt-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleDecision('reject')}
              className="h-7 px-2.5 text-xs gap-1"
            >
              <X className="size-3" />
              <span>Reject</span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleDecision('approve')}
              className="h-7 px-2.5 text-xs gap-1 bg-ai text-white hover:bg-ai-hover"
            >
              {isSubmitting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              <span>Approve</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
