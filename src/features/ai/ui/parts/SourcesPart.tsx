'use client';

import React from 'react';
import { ExternalLink, FileText, Quote } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import type { SourceItem } from '../../types/message';

export function SourcesPart({ sources }: { sources: SourceItem[] }) {
  if (!sources || sources.length === 0) return null;

  const webSources = sources.filter((s) => Boolean(s.url));
  const ragSources = sources.filter((s) => !s.url && (s.source || s.title));

  if (webSources.length === 0 && ragSources.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-border space-y-1.5">
      <p className="text-11 font-semibold text-muted-foreground/80">Sources</p>
      <div className="flex flex-wrap gap-1.5">
        {webSources.map((s, i) => (
          <a
            key={s.id || s.url || i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={[s.authors, s.snippet].filter(Boolean).join('\n')}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-ai/10 text-ai hover:bg-ai/20 transition-colors max-w-55 truncate"
          >
            <ExternalLink className="size-2.5 shrink-0" />
            <span className="truncate">{s.title || s.url}</span>
            {s.year && <span className="shrink-0 font-mono tabular-nums opacity-75">{s.year}</span>}
          </a>
        ))}

        {ragSources.map((s, i) => {
          const label = s.title || s.source || 'Source';
          return s.snippet ? (
            <Popover key={s.id || i}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-ai/10 text-ai max-w-55 truncate cursor-pointer hover:bg-ai/20 transition-colors"
                >
                  <FileText className="size-2.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-80 p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-secondary/60 flex items-center gap-2">
                  <Quote className="size-3 text-ai shrink-0" />
                  <span className="text-xs font-semibold text-foreground/80 truncate">
                    {label}
                  </span>
                </div>
                <div className="px-3 py-2.5 max-h-52 overflow-y-auto">
                  <p className="text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap">
                    {s.snippet}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <span
              key={s.id || i}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-ai/10 text-ai max-w-55 truncate cursor-default"
            >
              <FileText className="size-2.5 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
