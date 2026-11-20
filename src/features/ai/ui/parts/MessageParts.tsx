'use client';

import React, { memo, useMemo } from 'react';
import {
  ArrowDownToLine,
  Check,
  Copy,
  GitCompare,
  Replace,
} from 'lucide-react';
import type { Components } from 'react-markdown';
import { cn } from '@/shared/lib/utils';
import { renderMarkdown } from '@/shared/components/markdown/render-markdown';
import { getFileCategoryMeta } from '../../context/source.port';
import type {
  EditorPatchItem,
  FluxMessage,
  HitlDecision,
  MessageAttachment,
  MessagePart,
} from '../../types/message';
import { getAgentMeta, shouldShowAgentBadge } from '../registry/agents';
import { getPartRenderer } from '../registry/parts';
import {
  buildCitationLookup,
  parseCitationHref,
  preprocessCitationMarkdown,
} from './citations';
import { HitlApprovalPart } from './HitlApprovalPart';
import { InlineCitation } from './InlineCitation';
import { SourcesPart } from './SourcesPart';
import { ThinkingPart, parseThinkingContent } from './ThinkingPart';
import { ToolTraceGroup, type TracePartData } from './ToolPart';
import { WidgetsPart } from './WidgetsPart';

export function AgentBadge({ agent }: { agent: string }) {
  if (!shouldShowAgentBadge(agent)) return null;
  const info = getAgentMeta(agent);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-5 text-11 font-medium px-1.5 rounded-sm',
        info.badgeClass,
      )}
    >
      {info.label}
    </span>
  );
}

function AttachmentChips({
  attachments,
}: {
  attachments: MessageAttachment[];
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {attachments.map((att, idx) => {
        const meta = getFileCategoryMeta(att.name, att.sourceType, att.size);
        const Icon = meta.icon;
        return (
          <div
            key={att.id || idx}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-panel/70 border border-border max-w-xs select-none"
          >
            <div
              className={cn(
                'size-6 rounded-md flex items-center justify-center shrink-0 border',
                meta.badgeClassName,
              )}
            >
              <Icon className="size-3" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-11 font-medium text-foreground truncate"
                title={att.name}
              >
                {att.name}
              </p>
              <div className="flex items-center gap-1 text-11 text-muted-foreground">
                <span>{meta.typeLabel}</span>
                {meta.sizeText && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{meta.sizeText}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type RenderSegment =
  | { kind: 'trace'; items: TracePartData[] }
  | { kind: 'part'; part: MessagePart };

function groupPartsChronologically(
  parts: readonly MessagePart[],
): RenderSegment[] {
  const segments: RenderSegment[] = [];
  let traceBuffer: TracePartData[] = [];

  const flushTrace = () => {
    if (traceBuffer.length > 0) {
      segments.push({ kind: 'trace', items: traceBuffer });
      traceBuffer = [];
    }
  };

  for (const part of parts) {
    if (part.type === 'tool' || part.type === 'agent-handoff') {
      traceBuffer.push(part);
    } else {
      flushTrace();
      segments.push({ kind: 'part', part });
    }
  }
  flushTrace();
  return segments;
}

export interface MessageCodeActions {
  hasSelection?: boolean;
  copiedBlockId?: string | null;
  onCopyCode?: (code: string, blockId: string) => void;
  onInsertAtCursor?: (code: string) => void;
  onProposeDiff?: (code: string) => void;
  onReplaceSelection?: (code: string) => void;
}

function extractReactText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractReactText).join('');
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractReactText(props.children);
  }
  return '';
}

export interface MessagePartsProps {
  message: FluxMessage;
  isStreaming?: boolean;
  compact?: boolean;
  onResumeHitl?: (decisions: HitlDecision[]) => void | Promise<void>;
  onReviewEditorPatch?: (patch: EditorPatchItem) => void;
  onApplyAllEditorPatches?: (patches: EditorPatchItem[]) => void;
  codeActions?: MessageCodeActions;
}

export const MessageParts = memo(function MessageParts({
  message,
  isStreaming = false,
  compact = false,
  onResumeHitl,
  onReviewEditorPatch,
  onApplyAllEditorPatches,
  codeActions,
}: MessagePartsProps) {
  const isUser = message.role === 'user';

  const effectiveParts: MessagePart[] = useMemo(() => {
    if (isUser) return [];
    if (message.parts.length > 0) return message.parts;

    const fallback: MessagePart[] = [];
    const { thinking, answer, isThinkingOpen } = parseThinkingContent(
      message.content || '',
    );
    if (thinking !== null) {
      fallback.push({
        type: 'reasoning',
        text: thinking,
        streaming: isThinkingOpen && isStreaming,
      });
    }
    if (answer) {
      fallback.push({ type: 'text', text: answer, streaming: isStreaming });
    }
    if (message.widgets && message.widgets.length > 0) {
      fallback.push({ type: 'widgets', widgets: message.widgets });
    }
    if (message.sources && message.sources.length > 0) {
      fallback.push({ type: 'sources', sources: message.sources });
    }
    return fallback;
  }, [
    isUser,
    message.parts,
    message.content,
    message.widgets,
    message.sources,
    isStreaming,
  ]);

  const messageSources = useMemo(() => {
    if (message.sources && message.sources.length > 0) {
      return message.sources;
    }
    const sourcesPart = effectiveParts.find((p) => p.type === 'sources');
    return sourcesPart && sourcesPart.type === 'sources'
      ? sourcesPart.sources
      : undefined;
  }, [message.sources, effectiveParts]);

  const citationLookup = useMemo(
    () => buildCitationLookup(messageSources),
    [messageSources],
  );

  const citationMarkdownComponents = useMemo<Partial<Components>>(() => {
    const components: Partial<Components> = {
      a({ href, children }) {
        const citeIdx = parseCitationHref(href);
        if (citeIdx !== null) {
          return (
            <InlineCitation
              index={citeIdx}
              source={citationLookup.byIndex.get(citeIdx)}
              isMultiDocument={citationLookup.isMultiDocument}
              isStreaming={isStreaming}
            />
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-3 hover:underline"
          >
            {children}
          </a>
        );
      },
    };

    if (codeActions) {
      components.pre = ({ children }) => {
        const childNodes = React.Children.toArray(children);
        const firstElement = childNodes.find((child): child is React.ReactElement =>
          React.isValidElement(child),
        );
        const codeProps = firstElement
          ? (firstElement.props as { className?: string; children?: React.ReactNode })
          : undefined;
        const match = /language-([\w-]+)/.exec(codeProps?.className || '');
        const lang = match ? match[1] : 'latex';
        const codeString = extractReactText(codeProps?.children ?? children).replace(/\n$/, '');
        const blockId = `${lang}-${codeString.slice(0, 16)}`;
        const isCopied = codeActions.copiedBlockId === blockId;

        return (
          <div className="my-2 overflow-hidden rounded-md border border-border bg-background/90 text-foreground not-prose">
            <div className="flex items-center justify-between border-b border-border/80 bg-muted/50 px-2.5 py-1 text-10">
              <span className="font-mono text-muted-foreground">{lang}</span>
              <div className="flex items-center gap-1">
                {codeActions.onCopyCode && (
                  <button
                    type="button"
                    onClick={() => codeActions.onCopyCode?.(codeString, blockId)}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    title="Copy code"
                  >
                    {isCopied ? (
                      <Check className="size-3 text-success" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                {codeActions.onInsertAtCursor && (
                  <button
                    type="button"
                    onClick={() => codeActions.onInsertAtCursor?.(codeString)}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ai hover:bg-ai-subtle transition-colors cursor-pointer font-medium"
                    title="Insert code at cursor"
                  >
                    <ArrowDownToLine className="size-3" />
                    <span>Insert</span>
                  </button>
                )}
                {codeActions.onProposeDiff && (
                  <button
                    type="button"
                    onClick={() => codeActions.onProposeDiff?.(codeString)}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-ai hover:bg-ai-subtle transition-colors cursor-pointer font-medium"
                    title="Review diff interactively in editor"
                  >
                    <GitCompare className="size-3" />
                    <span>Diff</span>
                  </button>
                )}
                {codeActions.hasSelection && codeActions.onReplaceSelection && (
                  <button
                    type="button"
                    onClick={() => codeActions.onReplaceSelection?.(codeString)}
                    className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-warning hover:bg-warning/15 transition-colors cursor-pointer font-medium"
                    title="Replace selection with this code"
                  >
                    <Replace className="size-3" />
                    <span>Replace</span>
                  </button>
                )}
              </div>
            </div>
            <pre className="m-0 overflow-x-auto border-0 bg-transparent p-2.5 font-mono text-xs leading-relaxed text-foreground">
              <code>{codeString}</code>
            </pre>
          </div>
        );
      };
    }

    return components;
  }, [citationLookup, isStreaming, codeActions]);

  if (isUser) {
    const hasAttachments = Boolean(
      message.attachments && message.attachments.length > 0,
    );
    const hasContent = Boolean(
      message.content && message.content.trim().length > 0,
    );

    return (
      <div
        className={cn(
          'flex flex-col w-full items-end gap-1.5',
          compact && 'text-13',
        )}
      >
        {hasAttachments && <AttachmentChips attachments={message.attachments!} />}
        {(hasContent || !hasAttachments) && (
          <div
            className={cn(
              compact
                ? 'max-w-[92%] rounded-md px-3 py-2 leading-relaxed bg-primary text-primary-foreground font-normal'
                : 'max-w-[min(85%,56ch)] bg-muted/85 text-foreground rounded-lg rounded-br-sm px-3.5 py-2.5',
            )}
          >
            <p
              className={cn(
                compact ? 'text-13' : 'text-14',
                'leading-relaxed whitespace-pre-wrap break-words',
              )}
            >
              {message.content}
            </p>
          </div>
        )}
      </div>
    );
  }

  const segments = groupPartsChronologically(effectiveParts);

  return (
    <div
      className={cn(
        'flex flex-col w-full items-start',
        compact ? 'gap-1 text-13' : 'gap-1.5 text-14',
      )}
    >
      {message.agent && shouldShowAgentBadge(message.agent) && (
        <div>
          <AgentBadge agent={message.agent} />
        </div>
      )}

      <div
        className={cn(
          compact
            ? 'relative max-w-[92%] rounded-md px-3 py-2 leading-relaxed bg-muted/50 text-foreground text-13 space-y-1.5'
            : 'w-full text-14 leading-[1.625] space-y-2',
        )}
      >
        {segments.map((segment, idx) => {
          if (segment.kind === 'trace') {
            return (
              <ToolTraceGroup
                key={`trace-${idx}`}
                items={segment.items}
                isStreaming={isStreaming}
              />
            );
          }

          const { part } = segment;
          const CustomRenderer = getPartRenderer(part.type);
          if (CustomRenderer) {
            return (
              <CustomRenderer
                key={`custom-${idx}`}
                part={part}
                compact={compact}
                onResumeHitl={onResumeHitl}
              />
            );
          }

          switch (part.type) {
            case 'reasoning':
              return (
                <ThinkingPart
                  key={`reason-${idx}`}
                  content={part.text}
                  isStreaming={Boolean(part.streaming && isStreaming)}
                  compact={compact}
                />
              );

            case 'text':
              return (
                <div
                  key={`text-${idx}`}
                  className={cn(
                    compact
                      ? 'prose prose-sm dark:prose-invert max-w-none text-13 space-y-2 break-words [&>p]:leading-relaxed [&>ul]:pl-4 [&>ol]:pl-4 [&_code]:font-mono [&_code]:text-11 [&_pre]:p-2.5 [&_pre]:rounded-md [&_pre]:bg-background/80 [&_pre]:border [&_pre]:border-border'
                      : 'space-y-2.5 break-words',
                  )}
                >
                  {renderMarkdown(
                    preprocessCitationMarkdown(part.text, {
                      byIndex: citationLookup.byIndex,
                      isStreaming: Boolean(part.streaming && isStreaming),
                    }),
                    { components: citationMarkdownComponents },
                  )}
                  {part.streaming && isStreaming && (
                    <span
                      className="inline-block w-1.5 h-3.5 bg-ai ml-0.5 animate-pulse motion-reduce:animate-none align-text-bottom"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );

            case 'hitl':
              return (
                <HitlApprovalPart
                  key={part.interruptId || idx}
                  part={part}
                  onResume={onResumeHitl}
                  compact={compact}
                />
              );

            case 'widgets':
              return (
                <WidgetsPart
                  key={`widgets-${idx}`}
                  widgets={part.widgets}
                  onReviewEditorPatch={onReviewEditorPatch}
                  onApplyAllEditorPatches={onApplyAllEditorPatches}
                />
              );

            case 'sources':
              return (
                <SourcesPart key={`sources-${idx}`} sources={part.sources} />
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
});
