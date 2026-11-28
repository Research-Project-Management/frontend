'use client';

import React, { useRef, useMemo } from "react";
import { Bold, Italic, Heading3, List, Quote, BookOpen, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Textarea } from '@/shared/components/ui/textarea';
import { normalizeCitationLinkHref, parseAnnotationDeepLinkUrl, extractStructuredDeepLinksFromMarkdown, tokenizeCitationDeepLinksForEditor, detokenizeCitationDeepLinksFromEditor, renderInlineMarkdown, FormattedNoteBody, getNoteDisplayTitle, getNotePreviewSnippet, type ParsedAnnotationDeepLink, type CompactCitationTokenEntry } from './FormattedNoteBody';
import { useState, useEffect } from 'react';
import { SchemaFieldDefinition } from '@/features/library/types/core.types';
import { isValidValue } from '@/features/library/domain/metadata/mapper';
import { InlineField } from '@/features/library/ui/inspector/GeneralFields';

export {
  normalizeCitationLinkHref,
  parseAnnotationDeepLinkUrl,
  extractStructuredDeepLinksFromMarkdown,
  tokenizeCitationDeepLinksForEditor,
  detokenizeCitationDeepLinksFromEditor,
  renderInlineMarkdown,
  FormattedNoteBody,
  getNoteDisplayTitle,
  getNotePreviewSnippet,
  type ParsedAnnotationDeepLink,
  type CompactCitationTokenEntry,
};

/**
 * Formatting toolbar for Rich-Text / Markdown note editing (Rich Note Editor)
 */
function NoteFormattingToolbar({
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

interface NoteEditorBoxProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  isSaving?: boolean;
  minRows?: number;
}

/**
 * Standard note editor box with integrated formatting toolbar, compact `@cite:N` citation link protection,
 * interactive linked highlight pills, and footer actions.
 */
export function NoteEditorBox({
  value,
  onChange,
  onSave,
  onCancel,
  onNavigateToAnnotation,
  autoFocus = true,
  placeholder = "Write a research note... (Supports **bold**, *italic*, ### headings, - lists, > quotes)",
  isSaving = false,
  minRows = 3,
}: NoteEditorBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const citationTokenMapRef = useRef<Map<string, CompactCitationTokenEntry>>(
    new Map(),
  );

  const { displayText, entries: linkedCitations } = useMemo(() => {
    const tokenized = tokenizeCitationDeepLinksForEditor(
      value,
      citationTokenMapRef.current,
    );
    citationTokenMapRef.current = tokenized.tokenMap;
    return tokenized;
  }, [value]);

  const handleEditorChange = (nextDisplayText: string) => {
    const restored = detokenizeCitationDeepLinksFromEditor(
      nextDisplayText,
      citationTokenMapRef.current,
    );
    onChange(restored);
  };

  const handleDropAnnotation = (e: React.DragEvent<HTMLDivElement>) => {
    const droppedPayload =
      e.dataTransfer.getData("application/x-flux-annotation") ||
      e.dataTransfer.getData("text/plain");
    if (!droppedPayload || !droppedPayload.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? displayText.length;
      const end = el.selectionEnd ?? displayText.length;
      const before = displayText.slice(0, start);
      const after = displayText.slice(end);
      const separatorBefore = before && !before.endsWith("\n") ? "\n\n" : "";
      const separatorAfter = after && !after.startsWith("\n") ? "\n\n" : "";
      const combined = `${before}${separatorBefore}${droppedPayload.trim()}${separatorAfter}${after}`;
      handleEditorChange(combined);
    } else {
      const combined = displayText
        ? `${displayText}\n\n${droppedPayload.trim()}`
        : droppedPayload.trim();
      handleEditorChange(combined);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes("application/x-flux-annotation") ||
          e.dataTransfer.types.includes("text/plain")
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleDropAnnotation}
      className="flex flex-col p-2.5 rounded-lg border border-border bg-card gap-1.5 transition-all focus-within:border-ring focus-within:ring-1 focus-within:ring-ring"
    >
      <NoteFormattingToolbar
        textareaRef={textareaRef}
        value={displayText}
        onChange={handleEditorChange}
      />
      <Textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={displayText}
        onChange={(e) => handleEditorChange(e.target.value)}
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
      {linkedCitations.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/30 select-none"
          aria-label="Linked PDF citations"
        >
          <span className="inline-flex items-center gap-1 text-10 text-muted-foreground mr-0.5">
            <BookOpen className="size-2.5 shrink-0" />
            <span>Citations:</span>
          </span>
          {linkedCitations.map((cite) => (
            <Tooltip key={cite.token}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToAnnotation) {
                      onNavigateToAnnotation(cite.pageNumber, cite.annotationId);
                    }
                  }}
                  aria-label={`${cite.label} (${cite.token})`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-10 font-medium cursor-pointer transition-colors"
                >
                  <span className="font-mono opacity-75">{cite.token}</span>
                  <span>p. {cite.pageNumber}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="text-11 max-w-xs">
                {cite.label} ({cite.token})
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
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
