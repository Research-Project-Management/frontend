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
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium',
        'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all cursor-pointer select-none',
        className,
      )}
    >
      <BookOpen className="size-3 text-primary" />
      <span>p. {citation.pageNumber}</span>
      {citation.section && (
        <span className="text-[10px] opacity-75 font-normal truncate max-w-24">
          ({citation.section})
        </span>
      )}
    </button>
  );
};
