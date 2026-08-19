'use client';

import React from 'react';
import { Sparkles, Lightbulb, FunctionSquare, Table2, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { QuickPrompt } from '../../types/copilot.types';

export const DEFAULT_QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'contributions',
    title: 'Core Contributions',
    icon: 'Sparkles',
    prompt: 'Summarize the 3 main scientific contributions and novel insights of this paper in bullet points with page citations.',
    description: 'Key takeaways and novelty',
  },
  {
    id: 'methodology',
    title: 'Explain Methodology',
    icon: 'FunctionSquare',
    prompt: 'Explain the core algorithmic methodology, mathematical formulations, and system architecture used in this work.',
    description: 'Equations & model design',
  },
  {
    id: 'datasets_table',
    title: 'Extract Datasets & Metrics',
    icon: 'Table2',
    prompt: 'Extract all benchmark datasets, evaluation metrics, and comparative baseline results into a Markdown table.',
    description: 'Benchmarks and accuracy',
  },
  {
    id: 'limitations',
    title: 'Limitations & Future Work',
    icon: 'AlertCircle',
    prompt: 'What are the main experimental limitations, computational constraints, and future research directions mentioned by the authors?',
    description: 'Constraints and open problems',
  },
];

interface CopilotQuickPromptsProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
  className?: string;
}

export const CopilotQuickPrompts: React.FC<CopilotQuickPromptsProps> = ({
  onSelectPrompt,
  disabled = false,
  className,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="size-3.5 text-amber-500" />;
      case 'FunctionSquare':
        return <FunctionSquare className="size-3.5 text-sky-500" />;
      case 'Table2':
        return <Table2 className="size-3.5 text-emerald-500" />;
      case 'AlertCircle':
        return <AlertCircle className="size-3.5 text-rose-500" />;
      default:
        return <Lightbulb className="size-3.5 text-primary" />;
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Quick Academic Starters
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {DEFAULT_QUICK_PROMPTS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            className={cn(
              'flex flex-col items-start p-2.5 rounded-lg border border-border/70 bg-card/60 hover:bg-accent/70 hover:border-border transition-all text-left group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {getIcon(item.icon)}
              <span className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground line-clamp-1">
              {item.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
