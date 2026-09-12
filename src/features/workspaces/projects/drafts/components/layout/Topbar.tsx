'use client';

import React from 'react';
import { DraftsIcon } from '@/shared/components/icons';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';

export interface TopbarProps {
  totalDrafts?: number;
  onCreateDraft: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  totalDrafts,
  onCreateDraft,
}) => {
  return (
    <header
      className="h-11 px-4 flex items-center justify-between border-b border-border bg-background shrink-0 select-none sticky top-0 z-10"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      {/* Title with DraftsIcon & item count */}
      <div className="flex items-center gap-2 min-w-0">
        <DraftsIcon className="size-4 shrink-0 text-foreground" />
        <h1 className="text-13 font-medium tracking-tight text-foreground">
          Drafts
        </h1>
        {totalDrafts !== undefined && totalDrafts > 0 && (
          <span className="px-1.5 py-0.5 rounded text-11 font-mono font-medium text-muted-foreground bg-muted">
            {totalDrafts}
          </span>
        )}
      </div>

      {/* Action CTA Button strictly adhering to DESIGN.md tokens */}
      <Button
        onClick={onCreateDraft}
        size="sm"
        className="h-7 px-2.5 rounded-md font-medium text-12 bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none shrink-0 cursor-pointer gap-1.5"
      >
        <Plus className="size-3.5 shrink-0 text-primary-foreground" />
        <span>Draft a work item</span>
      </Button>
    </header>
  );
};

export default Topbar;
