'use client';

import React, { useState, memo } from 'react';
import { Copy, Check, Download, Eye, Zap } from 'lucide-react';
import { renderMarkdown } from '@/features/editor/utils/markdown.util';

export interface EditOp {
  action: 'replace_lines' | 'insert_after' | 'insert_before' | 'delete_lines';
  startLine?: number;
  endLine?: number;
  afterLine?: number;
  beforeLine?: number;
  newContent?: string;
  explanation?: string;
}

export function DiffApplyBlock({
  op,
  fileContent,
  onApply,
}: {
  op: EditOp;
  fileContent: string;
  onApply: (op: EditOp) => void;
}) {
  const [applied, setApplied] = useState(false);
  const lines = fileContent.split('\n');

  const oldLines: string[] = [];
  const newLines = (op.newContent ?? '').split('\n');

  if (op.action === 'replace_lines' && op.startLine && op.endLine) {
    for (let i = op.startLine - 1; i < Math.min(op.endLine, lines.length); i++) {
      oldLines.push(lines[i]);
    }
  } else if (op.action === 'delete_lines' && op.startLine && op.endLine) {
    for (let i = op.startLine - 1; i < Math.min(op.endLine, lines.length); i++) {
      oldLines.push(lines[i]);
    }
  }

  const rangeLabel =
    op.action === 'insert_after'
      ? `insert after line ${op.afterLine}`
      : op.action === 'insert_before'
        ? `insert before line ${op.beforeLine}`
        : `lines ${op.startLine}–${op.endLine}`;

  return (
    <div className="my-2 rounded-lg border border-border overflow-hidden text-xs font-mono">
      <div className="flex items-center justify-between px-2.5 py-1 bg-secondary/60 border-b border-border">
        <span className="text-muted-foreground/60">{rangeLabel}</span>
        {!applied && (
          <button
            onClick={() => {
              onApply(op);
              setApplied(true);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/90 text-primary-foreground text-xs hover:bg-primary transition-colors"
          >
            <Zap className="size-2.5 shrink-0" /> Apply
          </button>
        )}
        {applied && <span className="text-success text-xs">✓ Applied</span>}
      </div>
      <div className="bg-muted overflow-x-auto max-h-48">
        {oldLines.map((l, i) => (
          <div key={`d${i}`} className="flex bg-destructive/15 text-destructive px-0">
            <span className="w-4 text-center text-destructive shrink-0 border-r border-border mr-2">
              -
            </span>
            <span className="text-destructive/80 line-through py-px pr-4 whitespace-pre">
              {l}
            </span>
          </div>
        ))}
        {newLines.map((l, i) => (
          <div key={`a${i}`} className="flex bg-success/15 text-success px-0">
            <span className="w-4 text-center text-success shrink-0 border-r border-border mr-2">
              +
            </span>
            <span className="text-success py-px pr-4 whitespace-pre">{l}</span>
          </div>
        ))}
      </div>
      {op.explanation && (
        <div className="px-2.5 py-1 text-xs text-muted-foreground/50 border-t border-border bg-secondary/20">
          {op.explanation}
        </div>
      )}
    </div>
  );
}

export interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
  onInsert: (latex: string) => void;
  onPreview: (latex: string) => void;
  onApply?: (op: EditOp) => void;
  onApplyDiff?: (diffText: string) => void;
  fileContent?: string;
}

export const AssistantMessage = memo(function AssistantMessage({
  content,
  isStreaming = false,
  onInsert,
  onPreview,
  onApply,
  onApplyDiff,
  fileContent = '',
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasEditorActionBlock = /```\s*(?:apply|diff|latex|tex\b|\n)/i.test(content);
  if (!hasEditorActionBlock) {
    return (
      <div className="group relative">
        <div className="text-sm leading-relaxed space-y-0.5">
          {renderMarkdown(content)}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
        {!isStreaming && content && (
          <button
            onClick={handleCopy}
            className="mt-1 flex items-center gap-1 text-xs text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
          >
            {copied ? <Check className="size-3 text-success shrink-0" /> : <Copy className="size-3 shrink-0" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    );
  }

  const lines = (typeof content === 'string' ? content : content ? String(content) : '').split('\n');
  const elements: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = '';
  let blockKey = 0;
  let textLines: string[] = [];

  const flushMarkdown = () => {
    if (textLines.length === 0) return;

    const markdown = textLines.join('\n').trim();
    if (markdown) {
      elements.push(
        <React.Fragment key={`md-${blockKey++}`}>
          {renderMarkdown(markdown)}
        </React.Fragment>,
      );
    }

    textLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        flushMarkdown();
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      } else {
        inCode = false;
        const isDiff = codeLang.toLowerCase() === 'diff';
        const isApply = codeLang.toLowerCase() === 'apply';
        const isLatex = !isDiff && !isApply && ['latex', 'tex', ''].includes(codeLang.toLowerCase());
        const code = codeLines.join('\n');
        const key = `code-${blockKey++}`;

        if (isApply && onApply) {
          try {
            const op = JSON.parse(code) as EditOp;
            elements.push(
              <DiffApplyBlock key={key} op={op} fileContent={fileContent} onApply={onApply} />,
            );
          } catch {
            elements.push(
              <pre
                key={key}
                className="text-xs bg-secondary/30 rounded p-2 my-1 whitespace-pre-wrap font-mono"
              >
                {code}
              </pre>,
            );
          }
          codeLines = [];
          codeLang = '';
          continue;
        }

        if (isDiff) {
          elements.push(
            <div key={key} className="my-3 rounded-lg overflow-hidden border border-border font-mono">
              <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 border-b border-border">
                <span className="text-xs font-mono text-muted-foreground">diff</span>
                {!isStreaming && (
                  <button
                    onClick={() => {
                      const diffText = codeLines.join('\n');
                      if (onApplyDiff) {
                        onApplyDiff(diffText);
                      } else {
                        const added = codeLines
                          .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
                          .map((l) => l.slice(1))
                          .join('\n');
                        if (added) onInsert(added);
                      }
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Download className="size-2.5 shrink-0" />
                    Apply diff
                  </button>
                )}
              </div>
              <div className="text-xs leading-relaxed overflow-x-auto bg-muted">
                {codeLines.map((dl, di) => {
                  const isAdd = dl.startsWith('+') && !dl.startsWith('+++');
                  const isDel = dl.startsWith('-') && !dl.startsWith('---');
                  const isMeta =
                    dl.startsWith('@@') || dl.startsWith('---') || dl.startsWith('+++');
                  return (
                    <div
                      key={di}
                      className={[
                        'flex px-0 min-w-0',
                        isAdd ? 'bg-success/15 text-success' : '',
                        isDel ? 'bg-destructive/15 text-destructive' : '',
                        isMeta ? 'bg-primary/10 text-primary' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span
                        className={[
                          'select-none shrink-0 w-5 text-center text-xs border-r border-border mr-2',
                          isAdd
                            ? 'text-success'
                            : isDel
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                        ].join(' ')}
                      >
                        {isAdd ? '+' : isDel ? '−' : ' '}
                      </span>
                      <span
                        className={[
                          'py-px pr-4 whitespace-pre font-mono text-xs',
                          isAdd
                            ? 'text-success'
                            : isDel
                              ? 'text-destructive line-through opacity-70'
                              : 'text-muted-foreground',
                          isMeta ? 'text-primary no-underline opacity-100' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {isAdd || isDel ? dl.slice(1) : dl}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        } else {
          elements.push(
            <div key={key} className="my-3 rounded-lg overflow-hidden border border-border">
              <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/80 border-b border-border">
                <span className="text-xs font-mono text-muted-foreground">
                  {codeLang || 'latex'}
                </span>
                {isLatex && !isStreaming && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onPreview(code)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
                    >
                      <Eye className="size-2.5 shrink-0" />
                      Preview
                    </button>
                    <button
                      onClick={() => onInsert(code)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Download className="size-2.5 shrink-0" />
                      Insert
                    </button>
                  </div>
                )}
              </div>
              <div className="flex overflow-x-auto bg-secondary/30 text-xs leading-relaxed">
                <div className="select-none shrink-0 text-right pr-3 py-3 pl-2 text-muted-foreground/40 border-r border-border font-mono text-xs leading-relaxed">
                  {codeLines.map((_, li) => (
                    <div key={li}>{li + 1}</div>
                  ))}
                </div>
                <pre className="px-3 py-3 overflow-x-auto flex-1 font-mono text-xs leading-relaxed">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          );
        }
        codeLines = [];
        codeLang = '';
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    textLines.push(line);
  }
  flushMarkdown();

  return (
    <div className="group relative">
      <div className="text-sm leading-relaxed space-y-0.5">
        {elements}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
      {!isStreaming && content && (
        <button
          onClick={handleCopy}
          className="mt-1 flex items-center gap-1 text-xs text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          {copied ? <Check className="size-3 text-success shrink-0" /> : <Copy className="size-3 shrink-0" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
});

export function MarkdownAssistantMessage({
  content,
  isStreaming = false,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative" data-ai-response-renderer="react-markdown">
      <div className="text-sm leading-relaxed space-y-0.5">
        {renderMarkdown(content)}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
      {!isStreaming && content && (
        <button
          onClick={handleCopy}
          className="mt-1 flex items-center gap-1 text-xs text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          {copied ? <Check className="size-3 text-success shrink-0" /> : <Copy className="size-3 shrink-0" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  );
}

export default AssistantMessage;
