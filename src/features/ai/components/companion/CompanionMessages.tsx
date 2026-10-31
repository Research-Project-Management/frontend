'use client';

import React, { useState } from 'react';
import {
  Brain,
  ChevronDown,
  FileText,
  Loader2,
  CornerDownRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import type { ChatMessage, AgentAction } from '../../types/chat.types';
import { renderMarkdown } from '../../utils/render-markdown';
import { ActionCardsGroup } from '../chat/action-card';
import { ResponseWidgets } from '../chat/response-widgets';
import { CompanionHero } from './CompanionHero';

interface CompanionMessagesProps {
  messages: ChatMessage[];
  streamContent: string;
  isStreaming: boolean;
  isLoadingHistory: boolean;
  activeAgent: string | null;
  activeActions: AgentAction[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectPrompt: (prompt: string) => void;
  isReaderContext?: boolean;
  readerPaperTitle?: string;
}

function parseThinkingContent(raw: string): {
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

function ThinkingBlock({ content, isOpen }: { content: string; isOpen: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className='mb-2 rounded-md border border-border bg-muted/40 overflow-hidden text-11'>
      <button
        type='button'
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={isOpen ? 'AI is thinking' : 'Toggle thought process'}
        className='w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai'
      >
        <Brain className={cn('size-3 shrink-0 text-ai', isOpen && 'animate-pulse motion-reduce:animate-none')} />
        <span className='text-11 font-medium text-muted-foreground flex-1'>
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
        <div className='px-3 pb-2 pt-1 border-t border-border'>
          <p className='text-11 leading-relaxed text-muted-foreground/80 whitespace-pre-wrap font-mono'>
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

const MessageBubble = React.memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
  isLast: boolean;
}) {
  const isUser = message.role === 'user';

  const { thinking, answer, isThinkingOpen } = isUser
    ? { thinking: null, answer: message.content, isThinkingOpen: false }
    : parseThinkingContent(message.content);

  return (
    <div
      className={cn(
        'group flex flex-col gap-1 w-full text-13',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      {/* Bubble Container */}
      <div
        className={cn(
          'relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground font-normal whitespace-pre-wrap'
            : 'bg-muted/50 border border-border/80 text-foreground'
        )}
      >
        {/* Thinking Block */}
        {thinking && <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />}

        {/* Content */}
        {isUser ? (
          <div>{message.content}</div>
        ) : (
          <div className='prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words [&>p]:leading-relaxed [&>ul]:pl-4 [&>ol]:pl-4 [&_code]:font-mono [&_code]:text-11 [&_pre]:p-2.5 [&_pre]:rounded-md [&_pre]:bg-background/80 [&_pre]:border [&_pre]:border-border'>
            {renderMarkdown(answer || message.content)}
          </div>
        )}
      </div>

      {/* Sources Pill List */}
      {message.sources && message.sources.length > 0 && (
        <div className={cn('flex flex-wrap gap-1 mt-1 max-w-[92%]', isUser && 'justify-end')}>
          {message.sources.map((src, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className='flex items-center gap-1 px-2 py-0.5 rounded-md text-10 border border-border bg-muted/30 text-muted-foreground cursor-default'
                >
                  <FileText className='size-2.5 shrink-0 text-ai' />
                  <span className='truncate max-w-[180px]'>{src.title}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side='top' sideOffset={4} className='max-w-xs text-11'>
                {src.title}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Response Widgets */}
      {message.widgets && message.widgets.length > 0 && (
        <div className='w-full max-w-[95%] mt-1.5'>
          <ResponseWidgets widgets={message.widgets} />
        </div>
      )}
    </div>
  );
});

const SUGGESTIONS = [
  {
    id: '1',
    text: 'Create a Page in the Wiki with work logs for each member in the last month',
    prompt: 'Create a Page in the Wiki with work logs for each member in the last month',
  },
  {
    id: '2',
    text: 'Create a Sticky with details of all Urgent workitems across this workspace',
    prompt: 'Create a Sticky with details of all Urgent workitems across this workspace',
  },
  {
    id: '3',
    text: 'Synthesize recent papers from the Project Library and summarize key evidence',
    prompt: 'Synthesize recent papers from the Project Library and summarize key evidence',
  },
  {
    id: '4',
    text: 'Draft research work items and milestone targets for the current Cycle',
    prompt: 'Draft research work items and milestone targets for the current Cycle',
  },
];

const READER_SUGGESTIONS = [
  {
    id: 'r1',
    text: 'Summarize the core methodology, architecture, and key contributions of this paper',
    prompt: 'Summarize the core methodology, architecture, and key contributions of this paper',
  },
  {
    id: 'r2',
    text: 'Extract experimental setup, datasets, baselines, and main quantitative results',
    prompt: 'Extract experimental setup, datasets, baselines, and main quantitative results from this paper',
  },
  {
    id: 'r3',
    text: 'Analyze limitations, failure modes, and open research questions discussed by the authors',
    prompt: 'Analyze the limitations, failure modes, and open research questions discussed in this paper',
  },
  {
    id: 'r4',
    text: 'Synthesize my highlights and annotations on this paper into structured literature notes',
    prompt: 'Synthesize my highlights and annotations on this paper into structured literature notes',
  },
];

export const CompanionMessages = React.memo(function CompanionMessages({
  messages,
  streamContent,
  isStreaming,
  isLoadingHistory,
  activeAgent,
  activeActions,
  messagesEndRef,
  scrollContainerRef,
  onSelectPrompt,
  isReaderContext = false,
}: CompanionMessagesProps) {
  if (isLoadingHistory) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-muted-foreground gap-2'>
        <Loader2 className='size-5 animate-spin text-foreground' />
        <span className='text-12 font-medium'>Loading conversation...</span>
      </div>
    );
  }

  const isEmpty = messages.length === 0 && !streamContent;
  const activeSuggestions = isReaderContext ? READER_SUGGESTIONS : SUGGESTIONS;

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'flex-1 min-h-0 select-text',
        isReaderContext ? 'px-3' : 'px-3.5',
        isEmpty
          ? 'overflow-y-auto flex flex-col justify-center py-2 custom-scrollbar'
          : 'overflow-y-auto py-2.5 space-y-3 custom-scrollbar'
      )}
    >
      {isEmpty ? (
        <div
          className={cn(
            'flex flex-col justify-center select-none my-auto',
            isReaderContext ? 'py-1 gap-2' : 'py-1 gap-2.5'
          )}
        >
          {/* 3D Animated AI Hero with background aura, floating levitation, and title */}
          <CompanionHero compact={isReaderContext} />

          {/* Suggestions Section */}
          <div className='mt-0.5'>
            <div className='mb-1 px-2 flex items-center justify-between'>
              <span className='text-11 font-medium text-muted-foreground'>
                {isReaderContext ? 'Paper actions & analysis' : 'Suggestions'}
              </span>
            </div>

            {/* Suggestions List */}
            <div className='space-y-0.5'>
              {activeSuggestions.map((item) => (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => onSelectPrompt(item.prompt)}
                  className={cn(
                    'w-full flex items-start gap-2 px-2.5 text-left text-foreground hover:bg-muted/60 rounded-md transition-colors cursor-pointer group',
                    isReaderContext ? 'py-1.5 text-12' : 'py-2 text-13 rounded-lg gap-2.5'
                  )}
                >
                  <CornerDownRight
                    className={cn(
                      'text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors',
                      isReaderContext ? 'size-3' : 'size-3.5'
                    )}
                  />
                  <span
                    className={cn(
                      'leading-snug font-normal text-foreground',
                      isReaderContext ? 'text-12' : 'text-13'
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
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} isLast={i === messages.length - 1} />
          ))}

          {/* Streaming Bubble */}
          {isStreaming && (
            <div className='flex flex-col gap-1 w-full items-start text-13'>
              <div className='relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed bg-muted/50 border border-border/80 text-foreground'>
                {activeAgent && (
                  <div className='text-10 font-medium text-ai mb-1 flex items-center gap-1'>
                    <Loader2 className='size-2.5 animate-spin motion-reduce:animate-none' />
                    <span>{activeAgent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Agent</span>
                  </div>
                )}
                <div className='prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words'>
                  {renderMarkdown(streamContent || 'Thinking...')}
                  <span className='inline-block w-1.5 h-3.5 bg-ai ml-0.5 animate-pulse' />
                </div>
              </div>

              {activeActions.length > 0 && (
                <div className='w-full max-w-[95%] mt-1.5'>
                  <ActionCardsGroup actions={activeActions} />
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
});
