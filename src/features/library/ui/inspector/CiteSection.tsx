"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Copy,
  Check,
  ChevronDown,
  Download,
  ShieldAlert,
  ExternalLink,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { safeHttpUrl } from "@/features/library/domain/retraction";
import { cn, copyToClipboard } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/components/ui/tooltip";
import {
  useCslCitation,
  useCitationStyles,
} from "@/features/library/sdk/queries/citation.queries";
import type {
  Item,
  CslStyle,
} from "@/features/library/domain/types/library.types";
import {
  getCleanStyleLabel,
  normalizeCitationStyleId,
} from "@/features/library/domain/citations";
import { triggerBrowserTextDownload } from "@/features/library/core/coordinator/citation-export.coordinator";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import DOMPurify from "dompurify";

export interface CiteSectionProps {
  item?: Item;
  scopeId?: string;
}

export type CitationFormat = string;

/**
 * Robust CSL HTML sanitizer powered by DOMPurify.
 * Strictly whitelists semantic markup (i, b, em, strong, span, a, div)
 * and safe attributes (href, class) required for citation styling while
 * neutralizing any XSS payloads, inline script injection, or javascript: URIs.
 */
function sanitizeCslHtml(html?: string): string {
  if (!html) return "";
  try {
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "i",
        "b",
        "em",
        "strong",
        "span",
        "a",
        "div",
        "p",
        "sub",
        "sup",
      ],
      ALLOWED_ATTR: ["href", "class", "target", "rel"],
    });
    return sanitized;
  } catch {
    return "";
  }
}

// ─── CiteSection Component ───────────────────────────────────────────────────
export default function CiteSection({ item, scopeId }: CiteSectionProps) {
  const openModal = useLibraryUIStore((s) => s.openModal);
  const [activeFormat, setActiveFormat] = useState<CitationFormat>("apa-7th");
  const [copied, setCopied] = useState(false);
  const [copiedInText, setCopiedInText] = useState(false);
  const [searchedStyle, setSearchedStyle] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const activeScopeId = scopeId || item?.projectId || "user";

  // 1. Backend CSL style registry is the single source of truth for styles
  const { data: serverStyles = [] } = useCitationStyles(activeScopeId);

  const dropdownStyles = useMemo(() => {
    if (!serverStyles || serverStyles.length === 0) return [];
    const secondaries = serverStyles.filter((s) => !s.isPrimary);
    return secondaries.length > 0 ? secondaries : serverStyles.slice(4);
  }, [serverStyles]);

  const handleSelectSearchedStyle = useCallback(
    (style: { id: string; label: string }) => {
      const normalizedId = normalizeCitationStyleId(style.id);
      setSearchedStyle({ id: normalizedId, label: style.label });
      setActiveFormat(normalizedId);
    },
    [],
  );

  const normalizedActiveFormat = useMemo(
    () => normalizeCitationStyleId(activeFormat),
    [activeFormat],
  );

  const isExportFormat =
    normalizedActiveFormat === "bibtex" || normalizedActiveFormat === "ris";

  // 2. Backend CSL engine is the single source of truth for formatted output
  const currentCslStyle = normalizedActiveFormat as CslStyle;

  const { data: cslData, isLoading } = useCslCitation(
    activeScopeId,
    item?.id || "",
    currentCslStyle,
  );

  const rawCiteKey = item?.citationKey || item?.id || "";
  const citeKey = useMemo(() => {
    return (rawCiteKey || "ref").replace(/[^a-zA-Z0-9_-]/g, "");
  }, [rawCiteKey]);

  // 4 Core primary styles (APA, IEEE, MLA, BibTeX) - ALWAYS FIXED and NEVER replaced!
  const coreStyles = useMemo(
    () => [
      { id: "apa-7th", label: "APA" },
      { id: "ieee", label: "IEEE" },
      { id: "mla-9th", label: "MLA" },
      { id: "bibtex", label: "BibTeX" },
    ],
    [],
  );

  const isCoreSelected = coreStyles.some(
    (s) => s.id === normalizedActiveFormat,
  );

  const moreButtonLabel = useMemo(() => {
    if (isCoreSelected) return "More";
    if (searchedStyle && normalizeCitationStyleId(searchedStyle.id) === normalizedActiveFormat) {
      return searchedStyle.label;
    }
    const found = serverStyles.find(
      (s) => normalizeCitationStyleId(s.id) === normalizedActiveFormat,
    );
    return (
      found?.shortTitle ||
      found?.name ||
      getCleanStyleLabel(normalizedActiveFormat)
    );
  }, [isCoreSelected, searchedStyle, normalizedActiveFormat, serverStyles]);

  const barItems = coreStyles.map((s) => ({
    id: s.id,
    label: s.label,
    isSelected: s.id === normalizedActiveFormat,
  }));

  const rawHtml =
    cslData?.bibliographyHtml || cslData?.html || cslData?.bibliography || "";
  const sanitizedHtml = useMemo(() => sanitizeCslHtml(rawHtml), [rawHtml]);
  const inTextPreview = cslData?.inText || "";

  const getContentToCopy = useCallback(() => {
    const rawBib = cslData?.bibliography || "";
    if (!rawBib) return "";
    if (isExportFormat) return rawBib;
    // Strip any raw HTML tags when building plain-text representation
    return rawBib.replace(/<[^>]*>/g, "").trim();
  }, [cslData?.bibliography, isExportFormat]);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyInTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (copyInTextTimerRef.current) clearTimeout(copyInTextTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    const plainText = getContentToCopy();
    if (!plainText) return;

    let success = false;
    if (
      !isExportFormat &&
      sanitizedHtml &&
      typeof navigator !== "undefined" &&
      navigator.clipboard?.write &&
      typeof ClipboardItem !== "undefined"
    ) {
      try {
        const htmlBlob = new Blob([sanitizedHtml], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);
        success = true;
      } catch {
        success = await copyToClipboard(plainText);
      }
    } else {
      success = await copyToClipboard(plainText);
    }

    if (success) {
      setCopied(true);
      toast.success("Copied citation to clipboard", {
        id: "library-clipboard",
      });
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy", { id: "library-clipboard" });
    }
  }, [getContentToCopy, isExportFormat, sanitizedHtml]);

  const handleCopyInText = useCallback(async () => {
    const text = inTextPreview;
    if (!text) return;
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedInText(true);
      toast.success("Copied in-text citation to clipboard", {
        id: "library-clipboard",
      });
      if (copyInTextTimerRef.current) clearTimeout(copyInTextTimerRef.current);
      copyInTextTimerRef.current = setTimeout(
        () => setCopiedInText(false),
        2000,
      );
    } else {
      toast.error("Failed to copy", { id: "library-clipboard" });
    }
  }, [inTextPreview]);

  const handleDownload = useCallback(() => {
    const content = getContentToCopy();
    if (!content) return;
    const ext =
      activeFormat === "bibtex"
        ? "bib"
        : activeFormat === "ris"
          ? "ris"
          : "txt";
    const filename = `${citeKey || "reference"}.${ext}`;
    triggerBrowserTextDownload(content, filename);
    toast.success(`Exported ${filename}`, { id: "library-export" });
  }, [citeKey, activeFormat, getContentToCopy]);

  return (
    <>
      <div className="flex flex-col gap-2 min-w-0 font-sans select-none">
        {/* ⚠️ Citation Guard: Retraction Notice */}
        {(item?.isRetracted || item?.retractionStatus === "retracted") && (
          <div className="p-2 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2 select-none shrink-0">
            <ShieldAlert
              className="size-4 text-destructive shrink-0 mt-0.5"
              strokeWidth={1.5}
            />
            <div className="flex-1 space-y-1 min-w-0">
              <span className="font-semibold text-destructive block text-12">
                Warning: Retracted Publication
              </span>
              <p className="text-11 text-destructive leading-snug break-words">
                This publication has been flagged as retracted in academic
                databases. Citing this paper may compromise academic rigor.
              </p>
              {safeHttpUrl(
                (item?.retractionDetails?.noticeUrl as string | undefined) ||
                  item?.noticeUrl ||
                  (item?.doi ? `https://doi.org/${item.doi}` : undefined),
              ) && (
                <a
                  href={safeHttpUrl(
                    (item?.retractionDetails?.noticeUrl as
                      string | undefined) ||
                      item?.noticeUrl ||
                      (item?.doi ? `https://doi.org/${item?.doi}` : undefined),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-11 font-medium text-destructive hover:underline mt-0.5"
                >
                  <span>View Retraction Notice</span>
                  <ExternalLink className="size-3 shrink-0" strokeWidth={1.5} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* 4 Standard/Active Slots + 1 Fixed "More ▾" Button */}
        <div className="flex items-center gap-1 text-xs w-full overflow-hidden shrink-0 select-none">
          {barItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveFormat(item.id)}
              className={cn(
                "h-6 px-2 text-xs rounded-md cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary font-medium shrink-0 transition-colors relative before:absolute before:-inset-2 md:before:hidden",
                item.isSelected
                  ? "bg-muted text-foreground font-semibold"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "h-6 px-2 text-xs rounded-md cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary font-medium inline-flex items-center gap-1 shrink-0 transition-colors relative before:absolute before:-inset-2 md:before:hidden",
                  !isCoreSelected
                    ? "bg-muted text-foreground font-semibold"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <span className="truncate max-w-[80px]">{moreButtonLabel}</span>
                <ChevronDown className="size-3 text-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              className="w-52 p-1.5 space-y-0.5 bg-popover border border-border rounded-md shadow-raised-200 text-xs z-50 max-h-72 overflow-y-auto"
            >
              {dropdownStyles.map((fmt) => {
                const isSelected =
                  normalizeCitationStyleId(fmt.id) === normalizedActiveFormat;
                return (
                  <DropdownMenuItem
                    key={fmt.id}
                    onSelect={() =>
                      setActiveFormat(normalizeCitationStyleId(fmt.id))
                    }
                    className={cn(
                      "h-7.5 px-2 text-xs cursor-pointer rounded-md hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center justify-between",
                      isSelected
                        ? "font-medium text-foreground bg-muted"
                        : "text-foreground",
                    )}
                  >
                    <span className="truncate pr-2">
                      {fmt.shortTitle || fmt.name}
                    </span>
                    {isSelected && (
                      <Check className="size-3 text-foreground shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })}

              <DropdownMenuSeparator className="my-1 bg-border" />

              <DropdownMenuItem
                onSelect={() =>
                  openModal("CSL_STYLE_MANAGER", {
                    currentStyleId: normalizedActiveFormat,
                    onSelectStyle: handleSelectSearchedStyle,
                  })
                }
                className="h-7.5 px-2 text-xs cursor-pointer rounded-md hover:bg-muted text-foreground font-medium flex items-center gap-1.5"
              >
                <Search
                  className="size-3.5 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span>Search more styles...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* In-Text Citation Card (Academic styles only) */}
        {!isExportFormat && inTextPreview && (
          <div
            tabIndex={0}
            className="flex items-center justify-between px-2.5 py-1 rounded-md border border-border bg-transparent hover:border-border-hover focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors text-12 cursor-text"
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <span className="text-foreground text-11 shrink-0 font-medium">
                In-text:
              </span>
              <span className="font-mono text-12 text-foreground break-words leading-snug select-text">
                {inTextPreview}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopyInText}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden"
                  aria-label="Copy in-text citation"
                >
                  {copiedInText ? (
                    <Check className="size-3.5 text-foreground shrink-0" />
                  ) : (
                    <Copy className="size-3.5 text-foreground shrink-0" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                Copy in-text citation
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Citation Box with Hover-Only Action Icons */}
        <div
          tabIndex={0}
          className="group relative p-2.5 rounded-md border border-border bg-transparent hover:border-border-hover focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors min-h-[50px] max-h-56 overflow-y-auto leading-relaxed select-text font-sans text-12 cursor-text"
        >
          <div
            className={cn(
              "absolute top-1.5 right-1.5 flex items-center gap-1 z-10 select-none transition-opacity duration-150",
              copied
                ? "opacity-100"
                : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto max-md:opacity-100 max-md:pointer-events-auto",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!getContentToCopy()}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none relative before:absolute before:-inset-2 md:before:hidden"
                  aria-label="Download citation"
                >
                  <Download className="size-3.5 text-foreground shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                Download citation
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!getContentToCopy()}
                  className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none relative before:absolute before:-inset-2 md:before:hidden"
                  aria-label="Copy citation"
                >
                  {copied ? (
                    <Check className="size-3.5 text-foreground shrink-0" />
                  ) : (
                    <Copy className="size-3.5 text-foreground shrink-0" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                Copy citation
              </TooltipContent>
            </Tooltip>
          </div>

          <div>
            {isLoading && !cslData ? (
              <div className="space-y-1.5 py-1 select-none">
                <div className="h-3.5 bg-muted rounded animate-pulse w-full" />
                <div className="h-3.5 bg-muted rounded animate-pulse w-4/5" />
                <div className="h-3.5 bg-muted rounded animate-pulse w-2/3" />
              </div>
            ) : isExportFormat ? (
              <pre className="font-mono text-12 text-foreground whitespace-pre select-text overflow-x-auto leading-relaxed">
                {cslData?.bibliography || ""}
              </pre>
            ) : sanitizedHtml ? (
              <div
                className={cn(
                  "text-foreground leading-relaxed font-sans text-12 break-words select-text",
                  // CSL container formatting
                  "[&_.csl-bib-body]:space-y-1.5",
                  // Numeric citation style alignment ([1], [2], 1., etc.)
                  "[&_.csl-entry]:leading-relaxed",
                  "[&_.csl-entry:has(.csl-left-margin)]:flex [&_.csl-entry:has(.csl-left-margin)]:items-baseline [&_.csl-entry:has(.csl-left-margin)]:gap-2",
                  "[&_.csl-left-margin]:shrink-0 [&_.csl-left-margin]:min-w-[1.75rem] [&_.csl-left-margin]:tabular-nums [&_.csl-left-margin]:font-medium [&_.csl-left-margin]:text-foreground",
                  "[&_.csl-right-inline]:flex-1 [&_.csl-right-inline]:min-w-0",
                  // Fallback inline styling for left-margin/right-inline if :has is not triggered
                  "[&:not(:has(.csl-left-margin))_.csl-left-margin]:inline-block [&:not(:has(.csl-left-margin))_.csl-left-margin]:mr-1.5",
                  "[&:not(:has(.csl-left-margin))_.csl-right-inline]:inline",
                  "[&_.csl-indent]:pl-4",
                  // Semantic HTML elements from Citation.js
                  "[&_i]:italic [&_b]:font-medium [&_strong]:font-medium [&_em]:italic",
                  "[&_a]:underline [&_a]:text-foreground [&_a]:break-all hover:[&_a]:text-primary",
                )}
                dangerouslySetInnerHTML={{
                  __html: sanitizedHtml,
                }}
              />
            ) : (
              <div className="text-foreground text-xs italic select-none py-1">
                Citation data unavailable.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
