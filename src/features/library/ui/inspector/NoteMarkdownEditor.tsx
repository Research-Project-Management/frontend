"use client";

import React from "react";
import { Bold, Italic, Heading3, List, Quote } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

/**
 * Renders inline Markdown tokens (**bold**, *italic*, `code`) cleanly.
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-muted font-mono text-11 text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Formatted Markdown Note Renderer supporting headings, blockquotes, lists, and inline emphasis.
 */
export function FormattedNoteBody({
  content,
  isExpanded,
}: {
  content: string;
  isExpanded: boolean;
}) {
  const lines = content.split("\n");
  const visibleLines = isExpanded ? lines : lines.slice(0, 4);

  return (
    <div
      className={cn(
        "space-y-1 text-xs text-foreground leading-relaxed break-words select-text",
        !isExpanded && "line-clamp-3",
      )}
    >
      {visibleLines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
        if (line.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="text-xs font-semibold text-foreground pt-0.5"
            >
              {renderInlineMarkdown(line.slice(4))}
            </h4>
          );
        }
        if (line.startsWith("## ") || line.startsWith("# ")) {
          const cleanHeading = line.replace(/^#{1,2}\s+/, "");
          return (
            <h3
              key={idx}
              className="text-13 font-semibold text-foreground pt-0.5"
            >
              {renderInlineMarkdown(cleanHeading)}
            </h3>
          );
        }
        if (line.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-primary/50 pl-2 italic text-muted-foreground my-0.5"
            >
              {renderInlineMarkdown(line.slice(2))}
            </blockquote>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-muted-foreground select-none">•</span>
              <span className="flex-1">
                {renderInlineMarkdown(line.slice(2))}
              </span>
            </div>
          );
        }
        if (line === "---") {
          return <hr key={idx} className="border-border my-1" />;
        }
        return <p key={idx}>{renderInlineMarkdown(rawLine)}</p>;
      })}
    </div>
  );
}

/**
 * Formatting toolbar for Rich-Text / Markdown note editing (Zotero 7 Note Editor parity)
 */
export function NoteFormattingToolbar({
  textareaRef,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (nextValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const applyWrap = (prefix: string, suffix = prefix, placeholder = "text") => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${prefix}${placeholder}${suffix}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const nextValue =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length,
      );
    });
  };

  const applyLinePrefix = (linePrefix: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value ? `${value}\n${linePrefix}` : `${linePrefix}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextValue =
      value.slice(0, lineStart) + linePrefix + value.slice(lineStart);
    onChange(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      const nextCursor = start + linePrefix.length;
      el.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="flex items-center justify-between gap-1 pb-1.5 mb-1 border-b border-border select-none">
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => applyWrap("**", "**", "bold")}
              className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Bold"
            >
              <Bold className="size-3.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Bold (**text**)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => applyWrap("*", "*", "italic")}
              className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Italic"
            >
              <Italic className="size-3.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Italic (*text*)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => applyLinePrefix("### ")}
              className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Heading"
            >
              <Heading3 className="size-3.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Heading (### )</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => applyLinePrefix("- ")}
              className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Bullet list"
            >
              <List className="size-3.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Bullet List (- )</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => applyLinePrefix("> ")}
              className="size-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Quote"
            >
              <Quote className="size-3.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Citation / Quote (&gt; )</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-5 px-1.5 rounded text-10 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim()}
          className="h-5 px-2 rounded text-10 font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
