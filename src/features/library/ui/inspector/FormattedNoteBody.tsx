"use client";

import React from "react";
import { cn } from "@/shared/lib/utils";

export interface ParsedAnnotationDeepLink {
  pageNumber: number;
  annotationId?: string;
}

export interface CompactCitationTokenEntry {
  token: string;
  label: string;
  url: string;
  pageNumber: number;
  annotationId?: string;
}

/**
 * Normalizes a citation deep-link URL (`flux://open-pdf/...`, `/library/items/:id/reader?...`, or full origin URLs)
 * into a standard web path (`/library/papers/:id?...` or `/projects/:projectId/library/papers/:id?...`)
 * so citation links remain clickable both inside and outside the PDF Reader.
 */
export function normalizeCitationLinkHref(rawUrl: string): string {
  if (!rawUrl) return "";
  let url = rawUrl.trim();
  if (url.startsWith("flux://open-pdf/")) {
    url = `/${url.slice("flux://open-pdf/".length)}`;
  } else if (url.startsWith("flux://")) {
    url = `/${url.slice("flux://".length)}`;
  }
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    url.startsWith(window.location.origin)
  ) {
    url = url.slice(window.location.origin.length) || "/";
  }
  // Normalize legacy `/library/items/:id/reader` paths to canonical `/library/papers/:id`
  url = url.replace(
    /^((?:\/projects\/[^/]+)?)\/library\/items\/([^/?#]+)(?:\/reader)?/i,
    "$1/library/papers/$2",
  );
  return url;
}

/**
 * Extracts structured page and annotation deep-link parameters from a markdown URL
 * (`/library/papers/...?page=X&annotation=Y` or `flux://...?page=X&annotation=Y`).
 */
export function parseAnnotationDeepLinkUrl(
  rawUrl: string,
): ParsedAnnotationDeepLink | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const zoteroMatch = trimmed.match(
    /^zotero:\/\/open-pdf\/[^/]+\/(\d+)(?:\?annotation=([^&#\s]+))?/i,
  );
  if (zoteroMatch) {
    const pageNumber = parseInt(zoteroMatch[1], 10);
    if (Number.isFinite(pageNumber) && pageNumber >= 1) {
      return {
        pageNumber,
        annotationId: zoteroMatch[2] || undefined,
      };
    }
  }
  const normalized = normalizeCitationLinkHref(trimmed);
  if (
    !normalized.startsWith("/library/papers") &&
    !normalized.includes("/library/papers/") &&
    !normalized.includes("/library/items/")
  ) {
    return null;
  }
  const qIdx = normalized.indexOf("?");
  if (qIdx === -1) return null;
  const search = new URLSearchParams(normalized.slice(qIdx + 1));
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
 * Compacts long PDF annotation deep-link URLs into short `@cite:N` tokens for clean editing in a `<Textarea>`,
 * and returns a lookup table so tokens can be losslessly restored back to full Markdown URLs on change/save.
 */
export function tokenizeCitationDeepLinksForEditor(
  rawMarkdown: string,
  existingMap?: Map<string, CompactCitationTokenEntry>,
): {
  displayText: string;
  tokenMap: Map<string, CompactCitationTokenEntry>;
  entries: CompactCitationTokenEntry[];
} {
  const tokenMap = new Map<string, CompactCitationTokenEntry>(existingMap);
  const urlToToken = new Map<string, string>();
  let maxIndex = 0;

  for (const [token, entry] of tokenMap.entries()) {
    urlToToken.set(entry.url, token);
    const num = parseInt(token.replace("@cite:", ""), 10);
    if (Number.isFinite(num) && num > maxIndex) maxIndex = num;
  }

  const activeEntries: CompactCitationTokenEntry[] = [];
  const seenTokensInText = new Set<string>();

  const displayText = (rawMarkdown || "").replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (fullMatch, label: string, rawUrl: string) => {
      const trimmedUrl = rawUrl.trim();
      if (/^@cite:\d+$/.test(trimmedUrl)) {
        const existing = tokenMap.get(trimmedUrl);
        if (existing && !seenTokensInText.has(trimmedUrl)) {
          seenTokensInText.add(trimmedUrl);
          activeEntries.push(existing);
        }
        return fullMatch;
      }
      const parsed = parseAnnotationDeepLinkUrl(trimmedUrl);
      if (!parsed) return fullMatch;

      let token = urlToToken.get(trimmedUrl);
      if (!token) {
        maxIndex += 1;
        token = `@cite:${maxIndex}`;
        urlToToken.set(trimmedUrl, token);
      }
      const entry: CompactCitationTokenEntry = {
        token,
        label: label.trim(),
        url: trimmedUrl,
        pageNumber: parsed.pageNumber,
        annotationId: parsed.annotationId,
      };
      tokenMap.set(token, entry);
      if (!seenTokensInText.has(token)) {
        seenTokensInText.add(token);
        activeEntries.push(entry);
      }
      return `[${label}](${token})`;
    },
  );

  return { displayText, tokenMap, entries: activeEntries };
}

/**
 * Expands compact `@cite:N` tokens back into their canonical Markdown deep-link URLs.
 */
export function detokenizeCitationDeepLinksFromEditor(
  editorText: string,
  tokenMap: Map<string, CompactCitationTokenEntry>,
): string {
  if (!editorText || tokenMap.size === 0) return editorText;
  // 1. Expand standard [label](@cite:N) links (also tolerating accidental missing closing paren)
  let restored = editorText.replace(
    /\[([^\]]+)\]\(\s*(@cite:\d+)\s*\)?/g,
    (fullMatch, label: string, token: string) => {
      const entry = tokenMap.get(token);
      if (!entry) return fullMatch;
      return `[${label}](${entry.url})`;
    },
  );
  // 2. Expand any standalone @cite:N tokens so raw tokens never leak into persisted Markdown
  restored = restored.replace(
    /(?<![(\w])(@cite:\d+)\b/g,
    (fullMatch, token: string) => {
      const entry = tokenMap.get(token);
      if (!entry) return fullMatch;
      return `[${entry.label}](${entry.url})`;
    },
  );
  return restored;
}

/**
 * Renders inline Markdown tokens (**bold**, *italic*, `code`, and citation pills) cleanly.
 */
export function renderInlineMarkdown(
  text: string,
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void,
): React.ReactNode {
  // Supports markdown links [text](url) as well as **bold**, *italic*, `code`
  const parts = text.split(
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g,
  );
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
                onNavigateToAnnotation(
                  deepLink.pageNumber,
                  deepLink.annotationId,
                );
              }}
              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-primary/10 hover:bg-primary/15 cursor-pointer border-0 text-left transition-colors"
            >
              {renderInlineMarkdown(linkText, onNavigateToAnnotation)}
            </button>
          );
        }
        const normalizedHref = normalizeCitationLinkHref(linkUrl);
        const isSafeUrl =
          /^(https?:\/\/|mailto:|(\/projects\/[^/]+)?\/library\/papers)/i.test(
            normalizedHref,
          );
        if (!isSafeUrl) {
          return (
            <span key={idx}>
              {renderInlineMarkdown(linkText, onNavigateToAnnotation)}
            </span>
          );
        }
        return (
          <a
            key={idx}
            href={normalizedHref}
            target={normalizedHref.startsWith("/") ? undefined : "_blank"}
            rel={
              normalizedHref.startsWith("/")
                ? undefined
                : "noopener noreferrer"
            }
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "text-primary hover:underline font-medium inline-flex items-center gap-0.5",
              deepLink
                ? "px-1 py-0.2 rounded bg-primary/10 hover:bg-primary/15"
                : "break-all",
            )}
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
 * Formatted Markdown Note Renderer supporting headings, blockquotes, bullet/numbered lists, fenced code blocks, and inline emphasis.
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
    while (
      lines.length > 0 &&
      (!lines[0].trim() || lines[0].trim() === "---")
    ) {
      lines = lines.slice(1);
    }
  }

  const visibleLines = isExpanded ? lines : lines.slice(0, 3);

  // Group consecutive blockquote lines (`> ...` or `>`) and fenced code blocks (` ``` `)
  type RenderBlock =
    | { kind: "quote"; lines: string[]; key: number }
    | { kind: "code"; lines: string[]; key: number }
    | { kind: "line"; rawLine: string; key: number };

  const blocks: RenderBlock[] = [];
  let inCodeFence = false;
  for (let idx = 0; idx < visibleLines.length; idx++) {
    const rawLine = visibleLines[idx];
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      if (!inCodeFence) {
        inCodeFence = true;
        blocks.push({ kind: "code", lines: [], key: idx });
      } else {
        inCodeFence = false;
      }
      continue;
    }
    if (inCodeFence) {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "code") {
        prev.lines.push(rawLine);
      } else {
        blocks.push({ kind: "code", lines: [rawLine], key: idx });
      }
      continue;
    }
    if (trimmed === ">" || trimmed.startsWith("> ")) {
      const quoteContent = trimmed === ">" ? "" : trimmed.slice(2);
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "quote") {
        prev.lines.push(quoteContent);
      } else {
        blocks.push({ kind: "quote", lines: [quoteContent], key: idx });
      }
    } else {
      blocks.push({ kind: "line", rawLine, key: idx });
    }
  }

  return (
    <div
      className={cn(
        "space-y-1 text-xs text-foreground leading-relaxed break-words select-text",
        !isExpanded && "line-clamp-2",
      )}
    >
      {blocks.map((block) => {
        if (block.kind === "code") {
          return (
            <pre
              key={block.key}
              className="my-1 rounded-sm border border-border-subtle bg-muted/50 px-2.5 py-1.5 font-mono text-11 text-foreground overflow-x-auto"
            >
              <code>{block.lines.join("\n")}</code>
            </pre>
          );
        }
        if (block.kind === "quote") {
          return (
            <blockquote
              key={block.key}
              className="my-1 rounded-sm border border-border-subtle bg-muted/30 px-2.5 py-1.5 text-muted-foreground space-y-0.5"
            >
              {block.lines.map((qLine, qIdx) => (
                <div key={qIdx}>
                  {qLine ? (
                    renderInlineMarkdown(qLine, onNavigateToAnnotation)
                  ) : (
                    <div className="h-1" />
                  )}
                </div>
              ))}
            </blockquote>
          );
        }

        const { rawLine, key: idx } = block;
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
        if (line.startsWith("#### ") || line.startsWith("### ")) {
          const cleanSubheading = line.replace(/^#{3,6}\s+/, "");
          return (
            <h4
              key={idx}
              className="text-11 font-semibold text-foreground pt-0.5"
            >
              {renderInlineMarkdown(cleanSubheading, onNavigateToAnnotation)}
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
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1">
              <span className="text-muted-foreground select-none font-mono text-11">
                {numberedMatch[1]}.
              </span>
              <span className="flex-1">
                {renderInlineMarkdown(numberedMatch[2], onNavigateToAnnotation)}
              </span>
            </div>
          );
        }
        if (line === "---") {
          return <hr key={idx} className="border-border my-1" />;
        }
        return (
          <p key={idx}>
            {renderInlineMarkdown(rawLine, onNavigateToAnnotation)}
          </p>
        );
      })}
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
  const stripInline = (str: string) =>
    str
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#+\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^>\s+/gm, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();

  const lines = content
    .trim()
    .split("\n")
    .filter((l) => l.trim().length > 0 && l.trim() !== "---");

  if (lines.length === 0) return "";

  const firstLineCleaned = stripInline(lines[0]);
  const cleanTitle = (displayTitle || "").replace(/…$/, "").trim().toLowerCase();

  let startIndex = 0;
  if (
    lines[0].startsWith("#") ||
    !cleanTitle ||
    cleanTitle === "note" ||
    firstLineCleaned.toLowerCase() === cleanTitle ||
    firstLineCleaned.toLowerCase().startsWith(cleanTitle) ||
    cleanTitle.startsWith(firstLineCleaned.toLowerCase())
  ) {
    startIndex = 1;
  }

  if (startIndex >= lines.length) {
    return "";
  }

  return stripInline(lines.slice(startIndex).join(" "));
}
