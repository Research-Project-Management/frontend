'use client';

import React from 'react';
import { Terminal, Filter, Play, ArrowDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ParsedLogLine } from './dock.types';

export interface DockOutputTabProps {
  parsedLogLines: ParsedLogLine[];
  compileLog: string | null;
  showLogErrorsOnly: boolean;
  logSearch: string;
  wrapLines: boolean;
  setShowLogErrorsOnly: (val: boolean) => void;
  setLogSearch: (val: string) => void;
  logContainerRef: React.RefObject<HTMLDivElement | null>;
  onLogScroll: () => void;
  isScrolledUp: boolean;
  onScrollToBottom: () => void;
  onJumpToLine: (line?: number | null) => void;
  onTriggerCompile: () => void;
}

export const DockOutputTab = React.memo(function DockOutputTab({
  parsedLogLines,
  compileLog,
  showLogErrorsOnly,
  logSearch,
  wrapLines,
  setShowLogErrorsOnly,
  setLogSearch,
  logContainerRef,
  onLogScroll,
  isScrolledUp,
  onScrollToBottom,
  onJumpToLine,
  onTriggerCompile,
}: DockOutputTabProps) {
  return (
    <div
      ref={logContainerRef}
      onScroll={onLogScroll}
      className="h-full w-full overflow-y-auto font-mono text-12 bg-canvas text-foreground select-text"
    >
      {parsedLogLines.length > 0 ? (
        <div className="p-2 space-y-0.5">
          {parsedLogLines.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start hover:bg-muted/30 group py-0.5 rounded-xs transition-colors',
                item.type === 'error' &&
                  'bg-destructive/10 text-destructive font-semibold border-l border-destructive px-1.5'
              )}
            >
              {/* Gutter Line Number */}
              <span className="w-10 text-right pr-3 select-none text-muted-foreground/35 text-11 font-mono shrink-0 pt-0.5">
                {item.originalIndex}
              </span>

              {/* Line Content */}
              <div
                className={cn(
                  'flex-1 min-w-0 pr-3 font-mono text-12 leading-relaxed',
                  wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
                  item.type === 'error' && 'text-destructive',
                  item.type === 'warning' && 'text-warning font-medium',
                  item.type === 'success' && 'text-success font-semibold',
                  item.type === 'info' && 'text-muted-foreground/80',
                  item.type === 'asset' && 'text-muted-foreground/50 text-11',
                  item.type === 'normal' && 'text-foreground'
                )}
              >
                {item.jumpLine ? (
                  <span>
                    {item.text.split(new RegExp(`(l\\.${item.jumpLine})`)).map((part, pIdx) => {
                      if (part === `l.${item.jumpLine}`) {
                        return (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => onJumpToLine(item.jumpLine)}
                            className="inline-flex items-center text-primary font-semibold underline decoration-dotted hover:text-primary-hover cursor-pointer px-1 py-0.2 rounded-sm hover:bg-primary/10 transition-colors relative after:absolute after:-inset-1 after:content-['']"
                            title={`Jump to line ${item.jumpLine} in editor`}
                          >
                            {part}
                          </button>
                        );
                      }
                      return part;
                    })}
                  </span>
                ) : (
                  item.text
                )}
              </div>
            </div>
          ))}
        </div>
      ) : compileLog ? (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
          <Filter className="size-6 text-muted-foreground/60 mb-2" />
          <p className="text-13 font-semibold text-foreground">
            {showLogErrorsOnly
              ? 'No explicit error markers found in log'
              : `No log lines matching "${logSearch}"`}
          </p>
          <button
            type="button"
            onClick={() => {
              setShowLogErrorsOnly(false);
              setLogSearch('');
            }}
            className="mt-3 px-3 py-1.5 rounded-md border border-border bg-surface text-12 font-medium hover:bg-muted text-foreground transition-colors cursor-pointer"
          >
            Reset log filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center select-none">
          <Terminal className="size-6 text-muted-foreground/60 mb-2" strokeWidth={1.5} />
          <p className="text-13 font-semibold text-foreground">No compiler output yet</p>
          <p className="text-12 text-muted-foreground max-w-sm mt-1 leading-normal">
            Trigger LaTeX compilation to view engine diagnostics, package load logs, and PDF
            generation status.
          </p>
          <button
            type="button"
            onClick={onTriggerCompile}
            className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground text-12 font-medium hover:bg-primary-hover transition-colors cursor-pointer shadow-none"
          >
            <Play className="size-3.5 fill-current shrink-0" />
            <span>Compile Document (Ctrl+Enter)</span>
          </button>
        </div>
      )}

      {/* Floating "Scroll to Bottom" Button */}
      {isScrolledUp && (
        <button
          type="button"
          onClick={onScrollToBottom}
          className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded-full bg-surface/95 border border-border shadow-md text-11 font-medium text-foreground hover:bg-muted transition-all cursor-pointer select-none z-10 backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2"
        >
          <ArrowDown className="size-3 text-primary shrink-0" />
          <span>Scroll to bottom</span>
        </button>
      )}
    </div>
  );
});

