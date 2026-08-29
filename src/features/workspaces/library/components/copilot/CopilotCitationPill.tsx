'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CopilotCitation } from '../../types/copilot.types';

interface CopilotCitationPillProps {
  citation: CopilotCitation;
  onClick?: (pageNumber: number) => void;
  className?: string;
}

export const CopilotCitationPill: React.FC<CopilotCitationPillProps> = ({
  citation,
  onClick,
  className,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      onClick(citation.pageNumber);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={citation.quote ? `Quote: "${citation.quote}"` : `Jump to Page ${citation.pageNumber}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium',
        'bg-muted/70 text-foreground border border-border/60 hover:bg-muted hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-95 transition-colors cursor-pointer select-none',
        className,
      )}
    >
      <BookOpen className="size-3 text-muted-foreground shrink-0" />
      <span className="tabular-nums font-mono">p. {citation.pageNumber}</span>
      {citation.section && (
        <span className="text-[10px] text-muted-foreground font-normal truncate max-w-28">
          ({citation.section})
        </span>
      )}
    </button>
  );
};
