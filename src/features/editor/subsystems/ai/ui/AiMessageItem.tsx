'use client';

import React from 'react';
import {
  Copy,
  Check,
  ArrowDownToLine,
  Replace,
  GitCompare,
  Loader2,
} from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/shared/lib/utils';
import type { ChatMessage } from '@/features/ai/types/chat.types';
import { ThinkingBlock, parseThinkingContent } from './ThinkingBlock';

export interface AiMessageItemProps {
  msg?: ChatMessage;
  rawStreamingContent?: string;
  isStreaming?: boolean;
  hasSelectionContext?: boolean;
  copiedIndex: string | null;
  onCopyCode: (code: string, blockId: string) => void;
  onInsertAtCursor: (code: string) => void;
  onProposeDiff: (code: string) => void;
  onReplaceSelection: (code: string) => void;
}

export function AiMessageItem({
  msg,
  rawStreamingContent,
  isStreaming = false,
  hasSelectionContext = false,
  copiedIndex,
  onCopyCode,
  onInsertAtCursor,
  onProposeDiff,
  onReplaceSelection,
}: AiMessageItemProps) {
  const isUser = msg?.role === 'user';
  const rawText = isStreaming ? rawStreamingContent || '' : msg?.content || '';

  const { thinking, answer, isThinkingOpen } = isUser
    ? { thinking: null, answer: rawText, isThinkingOpen: false }
    : parseThinkingContent(rawText);

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const isBlock = Boolean(match) || codeString.includes('\n');
      const lang = match ? match[1] : 'latex';
      const blockId = `${lang}-${codeString.slice(0, 16)}`;

      if (isBlock) {
        const isCopied = copiedIndex === blockId;
        return (
          <div className="my-2.5 overflow-hidden rounded-md border border-border bg-background/90 text-foreground">
            <div className="flex items-center justify-between border-b border-border/80 bg-muted/50 px-2.5 py-1 text-10">
              <span className="font-mono text-muted-foreground uppercase">{lang}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onCopyCode(codeString, blockId)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Copy code"
                >
                  {isCopied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onInsertAtCursor(codeString)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ai hover:bg-ai-subtle transition-colors cursor-pointer font-medium"
                  title="Insert code at cursor"
                >
                  <ArrowDownToLine className="size-3" />
                  <span>Insert</span>
                </button>
                <button
                  type="button"
                  onClick={() => onProposeDiff(codeString)}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ai hover:bg-ai-subtle transition-colors cursor-pointer font-medium"
                  title="Review diff interactively in editor (⌘⏎ Accept, Esc Reject)"
                >
                  <GitCompare className="size-3" />
                  <span>Diff</span>
                </button>
                {hasSelectionContext && (
                  <button
                    type="button"
                    onClick={() => onReplaceSelection(codeString)}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-warning hover:bg-warning/15 transition-colors cursor-pointer font-medium"
                    title="Replace selection with this code"
                  >
                    <Replace className="size-3" />
                    <span>Replace</span>
                  </button>
                )}
              </div>
            </div>
            <pre className="overflow-x-auto p-2.5 font-mono text-xs leading-relaxed text-foreground">
              <code>{codeString}</code>
            </pre>
          </div>
        );
      }

      return (
        <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-ai font-medium" {...props}>
          {children}
        </code>
      );
    },
    p({ children }) {
      return <p className="mb-2 text-13 leading-relaxed text-foreground last:mb-0">{children}</p>;
    },
  };

  if (isStreaming) {
    return (
      <div className="flex flex-col gap-1 w-full items-start text-13">
        <div className="relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed bg-muted/50 border border-border/80 text-foreground">
          <div className="text-10 font-medium text-ai mb-1 flex items-center gap-1 select-none">
            <Loader2 className="size-2.5 animate-spin motion-reduce:animate-none" />
            <span>Flux AI Assistant</span>
          </div>
          {thinking && <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />}
          <div className="prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words [&>p]:leading-relaxed [&>ul]:pl-4 [&>ol]:pl-4 [&_code]:font-mono [&_code]:text-11">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={markdownComponents}
            >
              {answer || (!thinking ? rawStreamingContent || '' : '')}
            </ReactMarkdown>
            <span className="inline-block w-1.5 h-3.5 bg-ai ml-0.5 animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 w-full text-13',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground font-normal whitespace-pre-wrap'
            : 'bg-muted/50 border border-border/80 text-foreground'
        )}
      >
        {thinking && <ThinkingBlock content={thinking} isOpen={isThinkingOpen} />}
        {isUser ? (
          <div>{msg?.content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words [&>p]:leading-relaxed [&>ul]:pl-4 [&>ol]:pl-4 [&_code]:font-mono [&_code]:text-11">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={markdownComponents}
            >
              {answer || msg?.content || ''}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
