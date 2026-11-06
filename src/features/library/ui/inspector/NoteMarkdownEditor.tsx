'use client';

import React, { useRef, useMemo } from "react";
import { Bold, Italic, Heading3, List, Quote, BookOpen, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Textarea } from '@/shared/components/ui/textarea';
import { normalizeCitationLinkHref, parseAnnotationDeepLinkUrl, extractStructuredDeepLinksFromMarkdown, tokenizeCitationDeepLinksForEditor, detokenizeCitationDeepLinksFromEditor, renderInlineMarkdown, FormattedNoteBody, getNoteDisplayTitle, getNotePreviewSnippet, type ParsedAnnotationDeepLink, type CompactCitationTokenEntry } from './FormattedNoteBody';
import { useState, useEffect } from 'react';
import { SchemaFieldDefinition } from '@/features/library/types/core.types';
import { isValidValue } from '@/features/library/domain/metadata.mapper';
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
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mr-0.5">
            <BookOpen className="size-2.5 shrink-0" />
            <span>Citations:</span>
          </span>
          {linkedCitations.map((cite) => (
            <button
              key={cite.token}
              type="button"
              onClick={() => {
                if (onNavigateToAnnotation) {
                  onNavigateToAnnotation(cite.pageNumber, cite.annotationId);
                }
              }}
              title={`${cite.label} (${cite.token})`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium cursor-pointer transition-colors"
            >
              <span className="font-mono opacity-75">{cite.token}</span>
              <span>p. {cite.pageNumber}</span>
            </button>
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

interface DynamicInspectorFieldProps {
  fieldDef: SchemaFieldDefinition;
  val: string;
  displayDoi: string;
  copiedKey: string | null;
  canEdit?: boolean;
  onSave: (newVal: string) => void;
  onCopy: (text: string, label: string) => void;
}

/** Check if a string represents an external link / URL */
function isUrlLike(str?: string | null): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!trimmed || trimmed === "http://" || trimmed === "https://") return false;
  if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed)) return true;
  if (/^www\.[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(trimmed)) return true;
  if (/^(dx\.)?doi\.org\//i.test(trimmed)) return true;
  if (
    /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/[^\s]*)?$/i.test(trimmed) &&
    trimmed.includes(".")
  ) {
    const hasDomainExtension =
      /\.(org|com|net|edu|gov|io|ai|app|dev|co|uk|de|fr|vn|jp|cn|info|me|tech|xyz)(\/|$)/i.test(
        trimmed,
      );
    return hasDomainExtension;
  }
  return false;
}

/** Ensure link starts with valid protocol */
function toValidUrl(str: string): string {
  const trimmed = str.trim();
  if (/^(https?:\/\/|ftp:\/\/|mailto:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const MONO_FIELD_KEYS = new Set<string>([
  "doi",
  "citationkey",
  "citekey",
  "isbn",
  "issn",
  "pmid",
  "pmcid",
  "arxiv",
  "arxivid",
  "year",
  "volume",
  "issue",
  "pages",
  "date",
  "citationcount",
]);

interface InspectorFieldActionDescriptor {
  type: "external-link" | "copy-cite";
  href?: string;
  copyText?: string;
  title: string;
  label: string;
}

interface InspectorFieldDescriptor {
  isMono: boolean;
  isCitationKey: boolean;
  action?: InspectorFieldActionDescriptor;
}

interface FieldActionStrategy {
  matches(fieldKeyLower: string, value: string, options?: { displayDoi?: string; fieldDef?: SchemaFieldDefinition }): boolean;
  resolve(fieldKeyLower: string, value: string, options?: { displayDoi?: string; fieldDef?: SchemaFieldDefinition }): InspectorFieldActionDescriptor;
}

const INSPECTOR_FIELD_ACTION_STRATEGIES: readonly FieldActionStrategy[] = [
  {
    matches: (key, val, opts) =>
      key === "doi" && Boolean(opts?.displayDoi || isValidValue(val)),
    resolve: (_key, val, opts) => {
      const targetDoi = (opts?.displayDoi || val).trim();
      return {
        type: "external-link",
        href: `https://doi.org/${targetDoi}`,
        title: "Open DOI",
        label: "Open DOI",
      };
    },
  },
  {
    matches: (key, val) =>
      (key === "citationkey" || key === "citekey") && isValidValue(val),
    resolve: (_key, val) => ({
      type: "copy-cite",
      copyText: `\\cite{${val}}`,
      title: "Copy citation key",
      label: "Citation Key",
    }),
  },
  {
    matches: (key, val) =>
      (key === "pmid" || key === "pmcid") && Boolean(val && val.trim()),
    resolve: (key, val) => ({
      type: "external-link",
      href:
        key === "pmid"
          ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(val)}/`
          : `https://www.ncbi.nlm.nih.gov/pmc/articles/${encodeURIComponent(val)}/`,
      title: "Open in PubMed",
      label: "Open in PubMed",
    }),
  },
  {
    matches: (key, val) =>
      (key === "arxivid" || key === "arxiv") && Boolean(val && val.trim()),
    resolve: (_key, val) => ({
      type: "external-link",
      href: `https://arxiv.org/abs/${encodeURIComponent(val.replace(/^arxiv:/i, ""))}`,
      title: "Open in arXiv",
      label: "Open in arXiv",
    }),
  },
  {
    matches: (key, val, opts) => {
      if (
        key === "doi" ||
        key === "pmid" ||
        key === "pmcid" ||
        key === "arxivid" ||
        key === "arxiv"
      ) {
        return false;
      }
      const isUrlField = key === "url" || opts?.fieldDef?.type === "url";
      return (
        isUrlLike(val) ||
        (isUrlField &&
          isValidValue(val) &&
          val.trim() !== "http://" &&
          val.trim() !== "https://")
      );
    },
    resolve: (_key, val, opts) => {
      const fieldLabel = opts?.fieldDef?.label || "URL";
      return {
        type: "external-link",
        href: toValidUrl(val),
        title: `Open ${fieldLabel.toLowerCase()} link`,
        label: `Open ${fieldLabel} link`,
      };
    },
  },
];

function resolveInspectorFieldAction(
  fieldKeyOrDef: string | SchemaFieldDefinition,
  value: string,
  displayDoi?: string,
): InspectorFieldDescriptor {
  const fieldDef =
    typeof fieldKeyOrDef === "object" && fieldKeyOrDef !== null
      ? fieldKeyOrDef
      : undefined;
  const rawKey = typeof fieldKeyOrDef === "string" ? fieldKeyOrDef : fieldDef?.field || "";
  const keyLower = rawKey.trim().toLowerCase();
  const isCitationKey = keyLower === "citationkey" || keyLower === "citekey";
  const isMono = Boolean(fieldDef?.mono || MONO_FIELD_KEYS.has(keyLower));

  for (const strategy of INSPECTOR_FIELD_ACTION_STRATEGIES) {
    if (strategy.matches(keyLower, value, { displayDoi, fieldDef })) {
      return {
        isMono,
        isCitationKey,
        action: strategy.resolve(keyLower, value, { displayDoi, fieldDef }),
      };
    }
  }

  return { isMono, isCitationKey };
}

export function DynamicInspectorField({
  fieldDef,
  val,
  displayDoi,
  copiedKey,
  canEdit = true,
  onSave,
  onCopy,
}: DynamicInspectorFieldProps) {
  const [liveValue, setLiveValue] = useState(val);

  useEffect(() => {
    setLiveValue(val);
  }, [val]);

  const currentVal = liveValue ?? val;
  const descriptor = resolveInspectorFieldAction(fieldDef, currentVal, displayDoi);
  const { isMono, isCitationKey, action } = descriptor;

  return (
    <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5 group">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground text-right font-medium select-none pr-1 text-11 leading-normal whitespace-nowrap truncate">
            {fieldDef.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" sideOffset={6}>
          {fieldDef.label}
        </TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1 min-w-0 w-full">
        <InlineField
          itemKey={fieldDef.field}
          value={val}
          onChange={setLiveValue}
          ariaLabel={isCitationKey ? "BibTeX Citation Key" : fieldDef.label}
          onSave={onSave}
          mono={isMono}
          readOnly={!canEdit}
          className="flex-1 w-full"
        />

        {action && (
          <div className="invisible group-hover:visible group-focus-within:visible max-md:visible flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                {action.type === "external-link" && action.href ? (
                  <a
                    href={action.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none transition-colors relative before:absolute before:-inset-2 md:before:hidden"
                    aria-label={action.label}
                  >
                    <ExternalLink
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      action.copyText && onCopy(action.copyText, action.label)
                    }
                    className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none transition-colors relative before:absolute before:-inset-2 md:before:hidden"
                    aria-label={action.title}
                  >
                    {copiedKey === action.label ? (
                      <CheckCircle2
                        className="size-3.5 text-primary shrink-0"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <Copy
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    )}
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                {action.title}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

export default DynamicInspectorField;
