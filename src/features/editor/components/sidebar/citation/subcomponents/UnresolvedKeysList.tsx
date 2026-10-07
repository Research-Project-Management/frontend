'use client';

import React, { memo } from 'react';
import { AlertCircle, Search, Copy, Check } from 'lucide-react';

interface UnresolvedKeysListProps {
  missingKeys: string[];
  copiedKey: string | null;
  onFind: (key: string) => void;
  onCopy: (key: string) => void;
}

export const UnresolvedKeysList = memo(function UnresolvedKeysList({
  missingKeys,
  copiedKey,
  onFind,
  onCopy,
}: UnresolvedKeysListProps) {
  if (missingKeys.length === 0) return null;

  return (
    <div className="mb-2 space-y-1">
      <div className="flex items-center gap-1.5 px-1 py-0.5 text-11 font-medium text-warning">
        <AlertCircle className="size-3.5 shrink-0" />
        <span>Unresolved Citations ({missingKeys.length})</span>
      </div>

      {missingKeys.map((key) => {
        const isCopied = copiedKey === key;
        return (
          <div
            key={key}
            role="button"
            tabIndex={0}
            aria-label={`Unresolved key ${key}, search reference`}
            onClick={() => onFind(key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFind(key);
              }
            }}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-warning/10 border border-warning/20 text-foreground cursor-pointer hover:bg-warning/15 transition-colors group outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <span className="font-mono text-11 font-medium text-warning truncate">
              {key}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFind(key);
                }}
                className="h-6 px-1.5 rounded text-10 font-medium text-warning hover:bg-warning/20 transition-colors cursor-pointer flex items-center gap-1"
                title="Search reference in inspector"
              >
                <Search className="size-2.5" />
                <span>Find</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(key);
                }}
                className="h-6 px-1.5 rounded text-11 text-muted-foreground hover:text-foreground hover:bg-warning/20 transition-colors cursor-pointer"
                title="Copy \\cite command"
              >
                {isCopied ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default UnresolvedKeysList;
