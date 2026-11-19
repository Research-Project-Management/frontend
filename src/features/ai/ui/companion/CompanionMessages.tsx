'use client';

import React from 'react';
import {
  AlertCircle,
  CornerDownRight,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { FluxMessage, HitlDecision } from '../../types/message';
import { CompanionHero } from '../parts/CompanionHero';
import { MessageParts } from '../parts/MessageParts';
import { getAgentMeta, shouldShowAgentBadge } from '../registry/agents';

const SUGGESTIONS = [
  {
    id: '1',
    text: 'Create a Page in the Wiki with work logs for each member in the last month',
    prompt:
      'Create a Page in the Wiki with work logs for each member in the last month',
  },
  {
    id: '2',
    text: 'Create a Sticky with details of all Urgent workitems across this workspace',
    prompt:
      'Create a Sticky with details of all Urgent workitems across this workspace',
  },
  {
    id: '3',
    text: 'Synthesize recent papers from the Project Library and summarize key evidence',
    prompt:
      'Synthesize recent papers from the Project Library and summarize key evidence',
  },
  {
    id: '4',
    text: 'Draft research work items and milestone targets for the current Cycle',
    prompt:
      'Draft research work items and milestone targets for the current Cycle',
  },
];

const READER_SUGGESTIONS = [
  {
    id: 'r1',
    text: 'Summarize the core methodology, architecture, and key contributions of this paper',
    prompt:
      'Summarize the core methodology, architecture, and key contributions of this paper',
  },
  {
    id: 'r2',
    text: 'Extract experimental setup, datasets, baselines, and main quantitative results',
    prompt:
      'Extract experimental setup, datasets, baselines, and main quantitative results from this paper',
  },
  {
    id: 'r3',
    text: 'Analyze limitations, failure modes, and open research questions discussed by the authors',
    prompt:
      'Analyze the limitations, failure modes, and open research questions discussed in this paper',
  },
  {
    id: 'r4',
    text: 'Synthesize my highlights and annotations on this paper into structured literature notes',
    prompt:
      'Synthesize my highlights and annotations on this paper into structured literature notes',
  },
];

export interface CompanionMessagesProps {
  messages: readonly FluxMessage[];
  isStreaming: boolean;
  isLoadingHistory: boolean;
  activeAgent: string | null;
  error: Error | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectPrompt: (prompt: string) => void;
  onResumeHitl: (decisions: HitlDecision[]) => void;
  onRetry: () => void;
  isReaderContext?: boolean;
}

export const CompanionMessages = React.memo(function CompanionMessages({
  messages,
  isStreaming,
  isLoadingHistory,
  activeAgent,
  error,
  messagesEndRef,
  scrollContainerRef,
  onSelectPrompt,
  onResumeHitl,
  onRetry,
  isReaderContext = false,
}: CompanionMessagesProps) {
  if (isLoadingHistory) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="size-5 animate-spin text-foreground" />
        <span className="text-12 font-medium">Loading conversation...</span>
      </div>
    );
  }

  const isEmpty = messages.length === 0 && !isStreaming;
  const activeSuggestions = isReaderContext ? READER_SUGGESTIONS : SUGGESTIONS;
  const lastMsg = messages[messages.length - 1];
  const isWaitingFirstChunk =
    isStreaming && (!lastMsg || lastMsg.role === 'user');

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'flex-1 min-h-0 select-text',
        isReaderContext ? 'px-3' : 'px-3.5',
        isEmpty
          ? 'overflow-y-auto flex flex-col justify-center py-2 custom-scrollbar'
          : 'overflow-y-auto py-2.5 space-y-3 custom-scrollbar',
      )}
    >
      {isEmpty ? (
        <div
          className={cn(
            'flex flex-col justify-center select-none my-auto',
            isReaderContext ? 'py-1 gap-2' : 'py-1 gap-2.5',
          )}
        >
          <CompanionHero compact={isReaderContext} />

          <div className="mt-0.5">
            <div className="mb-1 px-2 flex items-center justify-between">
              <span className="text-11 font-medium text-muted-foreground">
                {isReaderContext ? 'Paper actions & analysis' : 'Suggestions'}
              </span>
            </div>

            <div className="space-y-0.5">
              {activeSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectPrompt(item.prompt)}
                  className={cn(
                    'w-full flex items-start gap-2 px-2.5 text-left text-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer group',
                    isReaderContext
                      ? 'py-1.5 text-12'
                      : 'py-2 text-13 rounded-lg gap-2.5',
                  )}
                >
                  <CornerDownRight
                    className={cn(
                      'text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors',
                      isReaderContext ? 'size-3' : 'size-3.5',
                    )}
                  />
                  <span
                    className={cn(
                      'leading-snug font-normal text-foreground',
                      isReaderContext ? 'text-12' : 'text-13',
                    )}
                  >
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            return (
              <MessageParts
                key={msg.id || i}
                message={msg}
                compact
                isStreaming={isLast && isStreaming && msg.role === 'assistant'}
                onResumeHitl={onResumeHitl}
              />
            );
          })}

          {isWaitingFirstChunk && (
            <div className="flex flex-col gap-1 w-full items-start text-13">
              <div className="relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed bg-muted/50 border border-border/80 text-foreground">
                <div className="text-11 text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin text-ai shrink-0" />
                  <span>
                    {activeAgent && shouldShowAgentBadge(activeAgent)
                      ? `${getAgentMeta(activeAgent).label} thinking...`
                      : 'Thinking...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-11 text-destructive">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="size-3.5 shrink-0" />
                <span className="truncate">
                  {error.message || 'Failed to get AI response.'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-6 px-2 text-11 gap-1 border-destructive/30 text-destructive hover:bg-destructive/15 shrink-0"
              >
                <RotateCcw className="size-3" />
                <span>Retry</span>
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
});
