'use client';

import React, { useState } from 'react';
import {
  Brain,
  ChevronDown,
  Copy,
  Check,
  FileText,
  Sparkles,
  ExternalLink,
  Loader2,
  Search,
  Code2,
  ListTodo,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ChatMessage, SourceItem, AgentAction } from '../../types/chat.types';
import { renderMarkdown } from '../../utils/render-markdown';
import { ActionCardsGroup } from '../chat/action-card';
import { ResponseWidgets } from '../chat/response-widgets';

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
        className='w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary'
      >
        <Brain className={cn('size-3 shrink-0 text-primary', isOpen && 'animate-pulse motion-reduce:animate-none')} />
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

function MessageBubble({
  message,
  isLast,
}: {
  message: ChatMessage;
  isLast: boolean;
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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

        {/* Copy button on hover for assistant */}
        {!isUser && (
          <button
            type='button'
            onClick={handleCopy}
            className='absolute top-2 right-2 p-1 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-muted text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary'
            title='Copy message'
            aria-label='Copy message'
          >
            {copied ? <Check className='size-3 text-success' /> : <Copy className='size-3' />}
          </button>
        )}
      </div>

      {/* Sources Pill List */}
      {message.sources && message.sources.length > 0 && (
        <div className='flex flex-wrap gap-1 mt-1 max-w-[92%]'>
          {message.sources.map((src, i) => (
            <div
              key={i}
              className='flex items-center gap-1 px-2 py-0.5 rounded-md text-10 border border-border bg-muted/30 text-muted-foreground'
              title={src.title}
            >
              <FileText className='size-2.5 shrink-0 text-primary' />
              <span className='truncate max-w-[180px]'>{src.title}</span>
            </div>
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
}

const STARTER_PROMPTS = [
  {
    label: 'Summarize literature',
    desc: 'Synthesize papers and extract key evidence',
    prompt: 'Summarize key literature and papers in this project',
    icon: FileText,
  },
  {
    label: 'Search references',
    desc: 'Discover citations and related research',
    prompt: 'Find relevant references and research papers for my current task',
    icon: Search,
  },
  {
    label: 'Generate LaTeX',
    desc: 'Formulas, scientific tables and templates',
    prompt: 'Generate a LaTeX equation and table template',
    icon: Code2,
  },
  {
    label: 'Decompose cycle goals',
    desc: 'Break down milestones into work items',
    prompt: 'Break down current cycle goals into executable tasks',
    icon: ListTodo,
  },
];

export function CompanionMessages({
  messages,
  streamContent,
  isStreaming,
  isLoadingHistory,
  activeAgent,
  activeActions,
  messagesEndRef,
  scrollContainerRef,
  onSelectPrompt,
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

  return (
    <div
      ref={scrollContainerRef as any}
      className='flex-1 overflow-y-auto min-h-0 p-3 space-y-3 select-text'
    >
      {isEmpty ? (
        <div className='flex flex-col items-center justify-center h-full text-center px-2 py-8 select-none max-w-[340px] mx-auto'>
          {/* Brand icon */}
          <div className='mb-3 flex items-center justify-center select-none'>
            <img
              src='/Chat.svg'
              alt='Flux AI'
              className='size-12 object-contain'
            />
          </div>

          <h3 className='text-14 font-semibold text-foreground tracking-tight'>
            How can I help you?
          </h3>
          <p className='text-11 text-muted-foreground mt-0.5 max-w-[260px] mx-auto leading-normal'>
            Choose a research action or ask anything below
          </p>

          {/* Polished suggestion cards */}
          <div className='mt-5 w-full space-y-2 text-left'>
            {STARTER_PROMPTS.map((item, i) => (
              <button
                key={i}
                type='button'
                onClick={() => onSelectPrompt(item.prompt)}
                className='w-full flex items-center justify-between gap-3 p-2.5 rounded-md border border-border bg-card hover:bg-muted transition-colors duration-150 cursor-pointer shadow-2xs group text-left outline-none focus-visible:ring-1 focus-visible:ring-primary'
              >
                <div className='size-7 rounded-md bg-muted border border-border/50 flex items-center justify-center shrink-0'>
                  <item.icon className='size-3.5 text-foreground shrink-0' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-12 font-medium text-foreground tracking-tight truncate'>
                    {item.label}
                  </p>
                  <p className='text-10 text-muted-foreground truncate leading-tight mt-0.5'>
                    {item.desc}
                  </p>
                </div>
                <ArrowUpRight className='size-3.5 text-muted-foreground shrink-0' />
              </button>
            ))}
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
                  <div className='text-10 font-medium text-primary mb-1 flex items-center gap-1'>
                    <Sparkles className='size-2.5 animate-spin motion-reduce:animate-none' />
                    <span>{activeAgent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Agent</span>
                  </div>
                )}
                <div className='prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words'>
                  {renderMarkdown(streamContent || 'Thinking...')}
                  <span className='inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse' />
                </div>
              </div>

              {activeActions.length > 0 && (
                <div className='w-full max-w-[95%] mt-1.5'>
                  <ActionCardsGroup actions={activeActions} />
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef as any} />
        </>
      )}
    </div>
  );
}
