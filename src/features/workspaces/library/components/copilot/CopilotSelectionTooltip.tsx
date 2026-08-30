'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface CopilotSelectionTooltipProps {
  position: { x: number; y: number } | null;
  selectedText: string;
  onAskCopilot: (text: string) => void;
  className?: string;
}

export const CopilotSelectionTooltip: React.FC<CopilotSelectionTooltipProps> = ({
  position,
  selectedText,
  onAskCopilot,
  className,
}) => {
  if (!position || !selectedText.trim()) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -120%)',
      }}
      className={cn(
        'z-50 animate-in fade-in zoom-in-95 duration-150',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onAskCopilot(selectedText)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-medium border border-border/40 hover:bg-foreground/90 active:scale-95 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-none"
      >
        <Sparkles className="size-3 text-background shrink-0" />
        <span>Ask Copilot about selection</span>
      </button>
    </div>
  );
};
