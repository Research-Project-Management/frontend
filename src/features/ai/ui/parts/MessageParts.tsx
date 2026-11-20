'use client';

import React, { memo } from 'react';
import { cn } from '@/shared/lib/utils';
import { renderMarkdown } from '@/shared/components/markdown/render-markdown';
import { getFileCategoryMeta } from '../../context/source.port';
import type {
  FluxMessage,
  HitlDecision,
  MessageAttachment,
  MessagePart,
} from '../../types/message';
import { getAgentMeta, shouldShowAgentBadge } from '../registry/agents';
import { getPartRenderer } from '../registry/parts';
import { HitlApprovalPart } from './HitlApprovalPart';
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

export interface MessagePartsProps {
  message: FluxMessage;
  isStreaming?: boolean;
  compact?: boolean;
  onResumeHitl?: (decisions: HitlDecision[]) => void | Promise<void>;
}

export const MessageParts = memo(function MessageParts({
  message,
  isStreaming = false,
  compact = false,
  onResumeHitl,
}: MessagePartsProps) {
  const isUser = message.role === 'user';

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

  const effectiveParts: MessagePart[] =
    message.parts.length > 0
      ? message.parts
      : (() => {
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
        })();

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
                  {renderMarkdown(part.text)}
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
              return <WidgetsPart key={`widgets-${idx}`} widgets={part.widgets} />;

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
