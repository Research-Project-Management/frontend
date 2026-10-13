'use client';

import React, { useState } from 'react';
import { Brain, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function parseThinkingContent(raw: string): {
  thinking: string | null;
  answer: string;
  isThinkingOpen: boolean;
} {
  const openIdx = raw.indexOf('<think>');
  if (openIdx === -1) return { thinking: null, answer: raw, isThinkingOpen: false };

  const closeIdx = raw.indexOf('</think>', openIdx);
  if (closeIdx === -1) {
    return {
      thinking: raw.slice(openIdx + 7),
      answer: '',
      isThinkingOpen: true,
    };
  }
  return {
    thinking: raw.slice(openIdx + 7, closeIdx).trim(),
    answer: raw.slice(closeIdx + 8).trimStart(),
    isThinkingOpen: false,
  };
}

export function ThinkingBlock({ content, isOpen }: { content: string; isOpen: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-2 rounded-md border border-border bg-muted/40 overflow-hidden text-11">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={isOpen ? 'AI is thinking' : 'Toggle thought process'}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai select-none"
      >
        <Brain className={cn('size-3 shrink-0 text-ai', isOpen && 'animate-pulse motion-reduce:animate-none')} />
        <span className="text-11 font-medium text-muted-foreground flex-1">
          {isOpen ? 'Thinking...' : 'Thought process'}
        </span>
        {!isOpen && (
          <ChevronDown
            className={cn(
              'size-3 text-muted-foreground/60 transition-transform shrink-0',
              collapsed && '-rotate-90'
            )}
          />
        )}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 pt-1 border-t border-border">
          <p className="text-11 leading-relaxed text-muted-foreground/80 whitespace-pre-wrap font-mono">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}
