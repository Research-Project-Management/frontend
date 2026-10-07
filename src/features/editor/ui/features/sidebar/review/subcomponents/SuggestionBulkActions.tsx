'use client';

import React from 'react';

interface SuggestionBulkActionsProps {
  count: number;
  onRejectAll: () => void;
  onAcceptAll: () => void;
  isRejecting?: boolean;
  isAccepting?: boolean;
}

export function SuggestionBulkActions({
  count,
  onRejectAll,
  onAcceptAll,
  isRejecting = false,
  isAccepting = false,
}: SuggestionBulkActionsProps) {
  if (count <= 0) return null;

  return (
    <div className="flex items-center justify-between border-b border-border px-3.5 py-2 text-xs shrink-0 bg-muted/20">
      <span className="text-11 font-mono font-medium text-muted-foreground">
        {count} pending suggestion{count > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onRejectAll}
          disabled={isRejecting || isAccepting}
          className="px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          Reject All
        </button>
        <button
          type="button"
          onClick={onAcceptAll}
          disabled={isAccepting || isRejecting}
          className="px-2.5 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}

export default SuggestionBulkActions;
