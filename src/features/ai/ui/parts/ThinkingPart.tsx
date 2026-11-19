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
  if (openIdx === -1) {
    return { thinking: null, answer: raw, isThinkingOpen: false };
  }

  const closeIdx = raw.indexOf('</think>', openIdx);
  if (closeIdx === -1) {
    return {
      thinking: raw.slice(openIdx + 7),
      answer: raw.slice(0, openIdx).trim(),
      isThinkingOpen: true,
    };
  }

  return {
    thinking: raw.slice(openIdx + 7, closeIdx).trim(),
    answer: [raw.slice(0, openIdx).trim(), raw.slice(closeIdx + 8).trimStart()]
      .filter(Boolean)
      .join('\n\n'),
    isThinkingOpen: false,
  };
}

export interface ThinkingPartProps {
  content: string;
  isStreaming?: boolean;
  isOpen?: boolean;
  compact?: boolean;
}

export function ThinkingPart({
  content,
  isStreaming,
  isOpen,
  compact = false,
}: ThinkingPartProps) {
  const active = Boolean(isStreaming ?? isOpen);
  const [collapsed, setCollapsed] = useState(!active);

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-panel/35 overflow-hidden',
        compact ? 'mb-2 text-11' : 'mb-2.5 text-xs',
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={active ? 'AI is thinking' : 'Toggle thought process'}
        className={cn(
          'w-full flex items-center text-left hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai select-none',
          !collapsed && 'border-b border-border/60',
          compact ? 'gap-1.5 px-2.5 py-1.5' : 'gap-2 px-3 py-2',
        )}
      >
        <Brain
          className={cn(
            'shrink-0 text-ai',
            compact ? 'size-3' : 'size-3.5',
            active && 'animate-pulse motion-reduce:animate-none',
          )}
        />
        <span
          className={cn(
            'font-medium text-muted-foreground flex-1',
            compact ? 'text-11' : 'text-xs',
          )}
        >
          {active ? 'Thinking...' : 'Thought process'}
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground/60 transition-transform shrink-0',
            compact ? 'size-3' : 'size-3.5',
            collapsed && '-rotate-90',
          )}
        />
      </button>
      {!collapsed && (
        <div
          className={cn(
            compact ? 'px-3 pb-2 pt-1.5' : 'px-3.5 pb-2.5 pt-2',
          )}
        >
          <p
            className={cn(
              'leading-relaxed text-muted-foreground/80 whitespace-pre-wrap font-mono',
              compact ? 'text-11' : 'text-xs',
            )}
          >
            {content}
          </p>
        </div>
      )}
    </div>
  );
}
