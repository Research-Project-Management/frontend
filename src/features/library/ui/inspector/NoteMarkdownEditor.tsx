"use client";

import React, { useRef } from "react";
import { Bold, Italic, Heading3, List, Quote } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

export interface ParsedAnnotationDeepLink {
  pageNumber: number;
  annotationId?: string;
}

/**
 * Extracts structured page and annotation deep-link parameters from a markdown URL
 * (`/library/papers/...?page=X&annotation=Y` or `flux://...?page=X&annotation=Y`).
 */
export function parseAnnotationDeepLinkUrl(rawUrl: string): ParsedAnnotationDeepLink | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (
    !trimmed.startsWith("/library/papers") &&
    !trimmed.startsWith("flux://") &&
    !trimmed.includes("/library/papers/")
  ) {
    return null;
  }
  const qIdx = trimmed.indexOf("?");
  if (qIdx === -1) return null;
  const search = new URLSearchParams(trimmed.slice(qIdx + 1));
  const rawPage = search.get("page");
  if (!rawPage) return null;
  const pageNumber = parseInt(rawPage, 10);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return null;
  const annotationId = search.get("annotation") || undefined;
  return { pageNumber, annotationId };
}

/**
 * Scans markdown content for structured citation deep-links (`[...](url?page=X&annotation=Y)`).
 */
export function extractStructuredDeepLinksFromMarkdown(
  content: string,
): ParsedAnnotationDeepLink[] {
  if (!content) return [];
  const results: ParsedAnnotationDeepLink[] = [];
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(content)) !== null) {
    const parsed = parseAnnotationDeepLinkUrl(match[1]);
    if (parsed) {
      results.push(parsed);
    }
  }
  return results;
}

/**
 * Renders inline Markdown tokens (**bold**, *italic*, `code`) cleanly.
 */
export function renderInlineMarkdown(
  text: string,
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void,
): React.ReactNode {
  // Supports markdown links [text](url) as well as **bold**, *italic*, `code`
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const linkText = match[1];
        const linkUrl = match[2].trim();
        const deepLink = parseAnnotationDeepLinkUrl(linkUrl);
        if (deepLink && onNavigateToAnnotation) {
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToAnnotation(deepLink.pageNumber, deepLink.annotationId);
              }}
              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0 text-left"
            >
              {renderInlineMarkdown(linkText, onNavigateToAnnotation)}
            </button>
          );
        }
        const isSafeUrl = /^(https?:\/\/|mailto:|(\/projects\/[^/]+)?\/library\/papers)/i.test(linkUrl);
        if (!isSafeUrl) {
          return <span key={idx}>{renderInlineMarkdown(linkText, onNavigateToAnnotation)}</span>;
        }
        return (
          <a
            key={idx}
            href={linkUrl}
            target={linkUrl.startsWith("/") ? undefined : "_blank"}
            rel={linkUrl.startsWith("/") ? undefined : "noopener noreferrer"}
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 break-all"
          >
            {renderInlineMarkdown(linkText, onNavigateToAnnotation)}
          </a>
        );
      }
    }
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
  omitFirstHeading = false,
  onNavigateToAnnotation,
}: {
  content: string;
  isExpanded: boolean;
  omitFirstHeading?: boolean;
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void;
}) {
  let lines = content.split("\n");

  if (omitFirstHeading && lines.length > 0 && lines[0].startsWith("#")) {
    lines = lines.slice(1);
    while (lines.length > 0 && (!lines[0].trim() || lines[0].trim() === "---")) {
      lines = lines.slice(1);
    }
  }

  const visibleLines = isExpanded ? lines : lines.slice(0, 3);

  return (
    <div
      className={cn(
        "space-y-1 text-xs text-foreground leading-relaxed break-words select-text",
        !isExpanded && "line-clamp-2",
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
              className="text-11 font-semibold text-foreground pt-0.5"
            >
              {renderInlineMarkdown(line.slice(4), onNavigateToAnnotation)}
            </h4>
          );
        }
        if (line.startsWith("## ") || line.startsWith("# ")) {
          const cleanHeading = line.replace(/^#{1,2}\s+/, "");
          return (
            <h3
              key={idx}
              className="text-xs font-semibold text-foreground pt-0.5"
            >
              {renderInlineMarkdown(cleanHeading, onNavigateToAnnotation)}
            </h3>
          );
        }
        if (line.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l border-border pl-2.5 my-1 text-muted-foreground bg-muted/20 py-0.5 rounded-r"
            >
              {renderInlineMarkdown(line.slice(2), onNavigateToAnnotation)}
            </blockquote>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-muted-foreground select-none">•</span>
              <span className="flex-1">
                {renderInlineMarkdown(line.slice(2), onNavigateToAnnotation)}
              </span>
            </div>
          );
        }
        if (line === "---") {
          return <hr key={idx} className="border-border my-1" />;
        }
        return <p key={idx}>{renderInlineMarkdown(rawLine, onNavigateToAnnotation)}</p>;
      })}
    </div>
  );
}

/**
 * Formatting toolbar for Rich-Text / Markdown note editing (Rich Note Editor)
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
  onSave?: () => void;
  onCancel?: () => void;
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

  const hasActionButtons = Boolean(onSave && onCancel);

  return (
    <div className="flex items-center justify-between gap-1 pb-1 mb-1 border-b border-border/50 select-none">
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => applyWrap("**", "**", "bold")}
              className="size-5.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
              className="size-5.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
              className="size-5.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
              className="size-5.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
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
              className="size-5.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Quote"
            >
              <Quote className="size-3.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Citation / Quote (&gt; )</TooltipContent>
        </Tooltip>
      </div>

      {hasActionButtons && (
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
      )}
    </div>
  );
}

export interface NoteEditorBoxProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  isSaving?: boolean;
  minRows?: number;
}

/**
 * Standard note editor box with integrated formatting toolbar, non-resizing clean textarea, and footer actions.
 */
export function NoteEditorBox({
  value,
  onChange,
  onSave,
  onCancel,
  autoFocus = true,
  placeholder = "Write a research note... (Supports **bold**, *italic*, ### headings, - lists, > quotes)",
  isSaving = false,
  minRows = 3,
}: NoteEditorBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <div className="flex flex-col p-2.5 rounded-lg border border-border bg-card gap-1.5 transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
      <NoteFormattingToolbar
        textareaRef={textareaRef}
        value={value}
        onChange={onChange}
      />
      <Textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            if (value.trim()) onSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={minRows}
        className="text-xs resize-none w-full min-h-[68px] max-h-56 overflow-y-auto border-0 focus-visible:ring-0 p-0 bg-transparent rounded-none outline-none shadow-none placeholder:text-muted-foreground/60 leading-relaxed font-sans"
      />
      <div className="flex items-center justify-between pt-1 border-t border-border/40 select-none">
        <span className="text-10 text-muted-foreground font-sans">
          <kbd className="font-mono text-10">Ctrl+Enter</kbd> to save
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-6 px-2 rounded-md text-11 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!value.trim() || isSaving}
            className="h-6 px-2.5 rounded-md text-11 font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Extracts a clean, concise title for a note without markdown noise.
 */
export function getNoteDisplayTitle(note: {
  title?: string;
  content: string;
}): string {
  if (note.title && note.title.trim()) {
    return note.title.trim();
  }
  const lines = note.content.trim().split("\n");
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) || "";
  if (firstNonEmpty.startsWith("#")) {
    const cleaned = firstNonEmpty
      .replace(/^#+\s*/, "")
      .replace(/[*_`]/g, "")
      .trim();
    if (cleaned) return cleaned;
  }
  if (firstNonEmpty) {
    const cleaned = firstNonEmpty.replace(/[*_`]/g, "").trim();
    return cleaned.length > 50 ? `${cleaned.slice(0, 50)}…` : cleaned;
  }
  return "Note";
}

/**
 * Generates a clean text preview snippet of the note content, stripping redundant title headings and markdown syntax.
 */
export function getNotePreviewSnippet(
  content: string,
  displayTitle?: string,
): string {
  const lines = content.trim().split("\n");
  let startIndex = 0;

  if (lines.length > 0 && lines[0].startsWith("#")) {
    const headingText = lines[0]
      .replace(/^#+\s*/, "")
      .replace(/[*_`]/g, "")
      .trim();
    if (
      !displayTitle ||
      displayTitle === "Note" ||
      headingText.toLowerCase().includes(displayTitle.toLowerCase()) ||
      displayTitle.toLowerCase().includes(headingText.toLowerCase())
    ) {
      startIndex = 1;
    }
  }

  while (
    startIndex < lines.length &&
    (!lines[startIndex].trim() || lines[startIndex].trim() === "---")
  ) {
    startIndex++;
  }

  const remaining = lines.slice(startIndex).join(" ");
  return remaining
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
