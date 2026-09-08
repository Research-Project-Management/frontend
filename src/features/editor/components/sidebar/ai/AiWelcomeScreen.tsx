'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface AiWelcomeScreenProps {
  quickPrompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

export function AiWelcomeScreen({
  quickPrompts,
  onSelectPrompt,
}: AiWelcomeScreenProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex group flex-col items-center">
          <img
            src="/Chat.svg"
            alt="AI"
            className="size-10 mb-2 group-hover:rotate-180 transition-transform duration-1000"
          />
          <p className="text-sm font-semibold">AI Editor</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Your LaTeX co-pilot. Select code, then ask.
          </p>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {quickPrompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSelectPrompt(p)}
            className="w-full text-left text-xs px-3 py-2 rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors flex items-center gap-2 group cursor-pointer"
          >
            <Sparkles className="size-3 text-primary shrink-0 transition-colors" />
            <span className="truncate">{p}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/50 text-center">
        Type <kbd className="px-1 py-px rounded bg-muted font-mono text-xs border border-border">/</kbd> for editor commands
      </p>
    </div>
  );
}
