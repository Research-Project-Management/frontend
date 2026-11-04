'use client';

import { useState, useRef, useMemo, useCallback, type RefObject, useEffect } from 'react';
import { Columns2, ArrowUpRight, X, StickyNote, Check, Quote, Copy, Sparkles } from 'lucide-react';
import type { DocumentFulltext, AnnotationRect, ReaderDocument } from '@/features/library/domain/types/reader.schema';
import { copyToClipboard, cn } from '@/shared/lib/utils';
import { formatInTextCitation } from '@/features/library/domain/reader.domain';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import { ANNOTATION_PALETTE_COLORS } from '@/features/library/ui/reader/ReaderToolbar';

export interface SmartHoverCardData {
  kind: "Reference" | "Figure" | "Table" | "Section";
  label: string;
  body: string;
  targetPage?: number;
  top: number;
  left: number;
}

export function useViewerSmartHover({
  fulltext,
  numPages,
  scrollContainerRef,
}: {
  fulltext?: DocumentFulltext | null;
  numPages: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const [smartHoverCard, setSmartHoverCard] = useState<SmartHoverCardData | null>(null);
  const hoverDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHoveredSpanRef = useRef<HTMLElement | null>(null);

  const hoverLookupIndex = useMemo(() => {
    const figureByKey = new Map<string, NonNullable<DocumentFulltext["figures"]>[number]>();
    const figureList: Array<{ fig: NonNullable<DocumentFulltext["figures"]>[number]; lowerLabel: string }> = [];
    if (Array.isArray(fulltext?.figures)) {
      for (const f of fulltext.figures) {
        const lowerId = f.id?.toLowerCase();
        if (lowerId) {
          figureByKey.set(lowerId, f);
          if (lowerId.startsWith("fig-")) figureByKey.set(lowerId.slice(4), f);
        }
        const lowerLabel = f.label?.toLowerCase() || "";
        const labelNumMatch = lowerLabel.match(/\b(?:fig\.?|figure)\s*(\d+[a-z]?)\b/i);
        if (labelNumMatch?.[1]) figureByKey.set(labelNumMatch[1].toLowerCase(), f);
        figureList.push({ fig: f, lowerLabel });
      }
    }

    const tableByKey = new Map<string, NonNullable<DocumentFulltext["tables"]>[number]>();
    const tableList: Array<{ tbl: NonNullable<DocumentFulltext["tables"]>[number]; lowerLabel: string }> = [];
    if (Array.isArray(fulltext?.tables)) {
      for (const t of fulltext.tables) {
        const lowerId = t.id?.toLowerCase();
        if (lowerId) {
          tableByKey.set(lowerId, t);
          if (lowerId.startsWith("table-")) tableByKey.set(lowerId.slice(6), t);
        }
        const lowerLabel = t.label?.toLowerCase() || "";
        const labelNumMatch = lowerLabel.match(/\b(?:table|tab\.?)\s*(\d+[a-z]?)\b/i);
        if (labelNumMatch?.[1]) tableByKey.set(labelNumMatch[1].toLowerCase(), t);
        tableList.push({ tbl: t, lowerLabel });
      }
    }

    let bibliographyStartPage: number | undefined;
    if (Array.isArray(fulltext?.sections)) {
      const refSec = fulltext.sections.find((s) =>
        /\b(?:references|bibliography|works\s+cited|literature\s+cited)\b/i.test(s.title || ""),
      );
      if (refSec?.page && refSec.page >= 1) bibliographyStartPage = refSec.page;
    }
    if (!bibliographyStartPage && Array.isArray(fulltext?.pages)) {
      for (let i = fulltext.pages.length - 1; i >= 0; i--) {
        const p = fulltext.pages[i];
        if (p && p.pageNumber >= 1 && /(?:^|\n)\s*(?:references|bibliography|works\s+cited)\s*(?:\n|$)/i.test(p.text || "")) {
          bibliographyStartPage = p.pageNumber;
        }
      }
    }

    const indexedReferences = Array.isArray(fulltext?.references)
      ? fulltext.references.map((r) => {
          const rec = r as typeof r & { page?: number; pageNumber?: number; pageIndex?: number };
          const explicitPage = rec.pageNumber ?? rec.page ?? (typeof rec.pageIndex === "number" ? rec.pageIndex + 1 : undefined);
          return {
            ref: r,
            year: r.year,
            lowerAuthors: Array.isArray(r.authors) ? r.authors.map((a) => a.toLowerCase()) : [],
            lowerCitation: r.rawCitation ? r.rawCitation.toLowerCase() : "",
            targetPage: explicitPage && explicitPage >= 1 ? explicitPage : bibliographyStartPage,
          };
        })
      : [];

    const referencesByYear = new Map<number, typeof indexedReferences>();
    for (const item of indexedReferences) {
      if (typeof item.year === "number") {
        const list = referencesByYear.get(item.year);
        if (list) list.push(item);
        else referencesByYear.set(item.year, [item]);
      }
    }

    return { figureByKey, figureList, tableByKey, tableList, indexedReferences, referencesByYear, bibliographyStartPage };
  }, [fulltext]);

  const cancelHoverDismiss = useCallback(() => {
    if (hoverDismissTimerRef.current) {
      clearTimeout(hoverDismissTimerRef.current);
      hoverDismissTimerRef.current = null;
    }
  }, []);

  const scheduleDismissSmartHover = useCallback(() => {
    if (hoverDismissTimerRef.current) clearTimeout(hoverDismissTimerRef.current);
    hoverDismissTimerRef.current = setTimeout(() => {
      setSmartHoverCard(null);
    }, 280);
  }, []);

  const handleContainerMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!fulltext) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const textSpan = (
        target.tagName === "SPAN" && target.closest(".react-pdf__Page__textContent")
          ? target
          : target.closest(".react-pdf__Page__textContent span, .annotationLayer a")
      ) as HTMLElement | null;
      if (!textSpan) {
        lastHoveredSpanRef.current = null;
        return;
      }
      if (lastHoveredSpanRef.current === textSpan) return;
      lastHoveredSpanRef.current = textSpan;

      const rawText = (textSpan.textContent || "").trim();
      if (!rawText || rawText.length > 140) return;

      const container = scrollContainerRef.current;
      if (!container) return;

      let matchedCard: Omit<SmartHoverCardData, "top" | "left"> | null = null;

      const figMatch = rawText.match(/\b(?:Fig\.?|Figure)\s*(\d+[A-Za-z]?)\b/i);
      if (figMatch && hoverLookupIndex.figureList.length > 0) {
        const figNum = figMatch[1]!.toLowerCase();
        const foundFig =
          hoverLookupIndex.figureByKey.get(figNum) ||
          hoverLookupIndex.figureByKey.get(`fig-${figNum}`) ||
          hoverLookupIndex.figureList.find((item) => item.lowerLabel.includes(figNum))?.fig;
        if (foundFig) {
          matchedCard = {
            kind: "Figure",
            label: foundFig.label || `Figure ${figMatch[1]}`,
            body: foundFig.caption || "Figure in document",
            targetPage: foundFig.page,
          };
        }
      }

      if (!matchedCard) {
        const tblMatch = rawText.match(/\b(?:Table|Tab\.?)\s*(\d+[A-Za-z]?)\b/i);
        if (tblMatch && hoverLookupIndex.tableList.length > 0) {
          const tblNum = tblMatch[1]!.toLowerCase();
          const foundTbl =
            hoverLookupIndex.tableByKey.get(tblNum) ||
            hoverLookupIndex.tableByKey.get(`table-${tblNum}`) ||
            hoverLookupIndex.tableList.find((item) => item.lowerLabel.includes(tblNum))?.tbl;
          if (foundTbl) {
            matchedCard = {
              kind: "Table",
              label: foundTbl.label || `Table ${tblMatch[1]}`,
              body: foundTbl.caption || "Table in document",
              targetPage: foundTbl.page,
            };
          }
        }
      }

      if (!matchedCard && hoverLookupIndex.indexedReferences.length > 0) {
        const fallbackRefPage = hoverLookupIndex.bibliographyStartPage ?? (numPages > 0 ? numPages : undefined);
        const bracketMatch = rawText.match(/\[(\d{1,3})(?:\s*[,\-–]\s*\d{1,3})?\]/);
        if (bracketMatch) {
          const refIdx = parseInt(bracketMatch[1]!, 10) - 1;
          const foundEntry = hoverLookupIndex.indexedReferences[refIdx];
          if (foundEntry) {
            const foundRef = foundEntry.ref;
            const authorsStr =
              Array.isArray(foundRef.authors) && foundRef.authors.length > 0
                ? foundRef.authors.slice(0, 3).join(", ") + (foundRef.authors.length > 3 ? " et al." : "")
                : "";
            const bodyParts = [
              authorsStr,
              foundRef.year ? `(${foundRef.year})` : "",
              foundRef.title ? `"${foundRef.title}"` : "",
              foundRef.journal || "",
            ].filter(Boolean);
            matchedCard = {
              kind: "Reference",
              label: `Reference [${bracketMatch[1]}]`,
              body: foundRef.rawCitation || bodyParts.join(" ") || `Reference #${bracketMatch[1]}`,
              targetPage: foundEntry.targetPage ?? fallbackRefPage,
            };
          }
        } else {
          const authorYearMatch = rawText.match(/\b([A-Z][a-zA-Z\-]{2,24})(?:\s+et\s+al\.?)?\s*\(?(\d{4})\)?/);
          if (authorYearMatch) {
            const surname = authorYearMatch[1]!.toLowerCase();
            const yearNum = parseInt(authorYearMatch[2]!, 10);
            const yearStr = String(yearNum);
            const candidates = hoverLookupIndex.referencesByYear.get(yearNum) ?? hoverLookupIndex.indexedReferences;
            const foundEntry = candidates.find(
              (item) =>
                (item.year === yearNum || !item.year) &&
                (item.lowerAuthors.some((a) => a.includes(surname)) ||
                  (item.lowerCitation.includes(surname) && item.lowerCitation.includes(yearStr))),
            );
            if (foundEntry) {
              const foundRef = foundEntry.ref;
              matchedCard = {
                kind: "Reference",
                label: `${authorYearMatch[1]} (${yearNum})`,
                body:
                  foundRef.rawCitation ||
                  [foundRef.authors?.join(", "), foundRef.title, foundRef.journal].filter(Boolean).join(" — "),
                targetPage: foundEntry.targetPage ?? fallbackRefPage,
              };
            }
          }
        }
      }

      if (!matchedCard) return;

      cancelHoverDismiss();

      const spanRect = textSpan.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const top = spanRect.bottom - containerRect.top + container.scrollTop + 6;
      const left = Math.max(
        16,
        Math.min(container.clientWidth - 320, spanRect.left - containerRect.left + container.scrollLeft),
      );

      setSmartHoverCard({ ...matchedCard, top, left });
    },
    [fulltext, hoverLookupIndex, numPages, scrollContainerRef, cancelHoverDismiss],
  );

  return {
    smartHoverCard,
    setSmartHoverCard,
    cancelHoverDismiss,
    scheduleDismissSmartHover,
    handleContainerMouseOver,
  };
}

export function ViewerSmartHoverPopover({
  card,
  onCancelDismiss,
  onScheduleDismiss,
  onDismiss,
  onJumpToPage,
  onOpenInSplitView,
}: {
  card: SmartHoverCardData;
  onCancelDismiss: () => void;
  onScheduleDismiss: () => void;
  onDismiss: () => void;
  onJumpToPage: (page: number) => void;
  onOpenInSplitView?: (page: number) => void;
}) {
  return (
    <div
      role="status"
      aria-label={`${card.kind} preview`}
      onMouseEnter={onCancelDismiss}
      onMouseLeave={onScheduleDismiss}
      style={{ top: `${card.top}px`, left: `${card.left}px` }}
      className="absolute z-40 w-80 max-w-[90vw] rounded-md border border-border bg-popover p-2.5 text-11 text-popover-foreground shadow-raised-200 font-sans animate-in fade-in duration-100 select-text"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-border-subtle">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-1.5 py-0.5 text-10 font-mono font-medium rounded-sm bg-muted text-foreground shrink-0">
            {card.kind}
          </span>
          <span className="font-semibold text-foreground truncate">{card.label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {card.targetPage && (
            <button
              type="button"
              onClick={() => {
                onJumpToPage(card.targetPage!);
                onDismiss();
              }}
              className="h-5 px-1.5 rounded-sm text-10 font-mono text-primary hover:bg-primary/10 flex items-center gap-0.5 cursor-pointer transition-colors"
              title={`Jump to page ${card.targetPage}`}
            >
              <span>p. {card.targetPage}</span>
              <ArrowUpRight className="size-2.5" strokeWidth={1.5} />
            </button>
          )}
          {card.targetPage && onOpenInSplitView && (
            <button
              type="button"
              onClick={() => {
                onOpenInSplitView(card.targetPage!);
                onDismiss();
              }}
              className="h-5 px-1.5 rounded-sm text-10 font-sans font-medium text-foreground hover:bg-muted flex items-center gap-1 cursor-pointer transition-colors"
              title="Open target page in Split View"
            >
              <Columns2 className="size-3 shrink-0" strokeWidth={1.5} />
              <span>Split</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="size-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
            aria-label="Dismiss preview"
          >
            <X className="size-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <p className="text-11 leading-relaxed text-foreground/90 line-clamp-4">{card.body}</p>
    </div>
  );
}

export interface TextSelectionToolbarProps {
  selectedText: string;
  selectedPageNum: number;
  selectedRects: AnnotationRect[];
  menuPosition: { top: number; left: number };
  activeColor?: string;
  activeTool?: ReaderAnnotationTool;
  paper?: ReaderDocument;
  visiblePage: number;
  onAnnotate?: (
    selectedText: string,
    pageNumber: number,
    colorHex?: string,
    rects?: AnnotationRect[],
    type?: "highlight" | "underline" | "note" | "text" | "rect" | "area",
    comment?: string,
  ) => void;
  onAddToNote?: (
    selectedText: string,
    pageNumber?: number,
    annotationId?: string,
  ) => void;
  onAskAi?: (selectedText: string, pageNumber?: number) => void;
  onClose: () => void;
}

export function TextSelectionToolbar({
  selectedText,
  selectedPageNum,
  selectedRects,
  menuPosition,
  activeColor,
  activeTool,
  paper,
  visiblePage,
  onAnnotate,
  onAddToNote,
  onAskAi,
  onClose,
}: TextSelectionToolbarProps) {
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const handleCopySelection = async () => {
    if (!selectedText) return;
    const ok = await copyToClipboard(selectedText);
    if (ok) {
      setCopiedSelection(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopiedSelection(false);
        onClose();
      }, 1200);
    }
  };

  const handleCopyCitation = async () => {
    if (!paper || !selectedText) return;
    const citation = formatInTextCitation(paper, selectedPageNum || visiblePage);
    const citeText = `${citation} "${selectedText}"`;
    const ok = await copyToClipboard(citeText);
    if (ok) {
      setCopiedCitation(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopiedCitation(false);
        onClose();
      }, 1200);
    }
  };

  return (
    <div
      className="pdf-floating-selection-menu absolute z-50 flex items-center gap-1 whitespace-nowrap w-max bg-background text-foreground px-2 py-1 rounded-md border border-border shadow-raised-200 duration-150 select-none"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transform: "translateX(-50%)",
      }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* 8 Standard Highlight Color Dots */}
      {onAnnotate && (
        <div className="flex items-center gap-1 pr-1.5 border-r border-border shrink-0">
          {ANNOTATION_PALETTE_COLORS.map((c) => {
            const isSelected = activeColor === c.hex;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Highlight in ${c.label}`}
                onClick={() => {
                  const targetType =
                    activeTool === "underline" ? "underline" : "highlight";
                  onAnnotate(
                    selectedText,
                    selectedPageNum,
                    c.hex,
                    selectedRects,
                    targetType,
                  );
                  onClose();
                  window.getSelection()?.removeAllRanges();
                }}
                title={`Highlight in ${c.label}`}
                className={cn(
                  "size-3.5 rounded-full border border-border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-2.5 md:before:hidden",
                  isSelected && "ring-2 ring-primary ring-offset-1",
                )}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      )}

      {/* Note Action */}
      {onAddToNote && (
        <button
          type="button"
          aria-label="Add selected text to Note"
          onClick={() => {
            onAddToNote(selectedText, selectedPageNum);
            onClose();
            window.getSelection()?.removeAllRanges();
          }}
          className="flex items-center gap-1 h-7 px-2 rounded-md text-12 font-medium whitespace-nowrap shrink-0 hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
          title="Add selected text to Note"
        >
          <StickyNote
            className="size-3.5 text-foreground shrink-0"
            strokeWidth={1.5}
          />
          <span>Note</span>
        </button>
      )}

      {/* Cite Action */}
      {paper && (
        <button
          type="button"
          aria-label="Copy in-text citation"
          onClick={handleCopyCitation}
          className="flex items-center gap-1 h-7 px-2 rounded-md text-12 font-medium whitespace-nowrap shrink-0 hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
          title="Copy in-text citation: (Author, Year, p. X)"
        >
          {copiedCitation ? (
            <Check
              className="size-3.5 text-primary shrink-0"
              strokeWidth={1.5}
            />
          ) : (
            <Quote
              className="size-3.5 text-foreground shrink-0"
              strokeWidth={1.5}
            />
          )}
          <span>{copiedCitation ? "Cited" : "Cite"}</span>
        </button>
      )}

      {/* Copy Action */}
      <button
        type="button"
        aria-label="Copy selected text"
        onClick={handleCopySelection}
        className="flex items-center gap-1 h-7 px-2 rounded-md text-12 font-medium whitespace-nowrap shrink-0 hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
        title="Copy text"
      >
        {copiedSelection ? (
          <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
        ) : (
          <Copy
            className="size-3.5 text-foreground shrink-0"
            strokeWidth={1.5}
          />
        )}
        <span>{copiedSelection ? "Copied" : "Copy"}</span>
      </button>

      {/* Ask AI Action */}
      {onAskAi && (
        <button
          type="button"
          aria-label="Ask AI about selected text"
          onClick={() => {
            onAskAi(selectedText, selectedPageNum || visiblePage);
            onClose();
            window.getSelection()?.removeAllRanges();
          }}
          className="flex items-center gap-1.5 h-7 px-2 rounded-md text-12 font-medium whitespace-nowrap shrink-0 hover:bg-muted text-ai transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
          title="Ask AI about selected text"
        >
          <Sparkles className="size-3.5 text-ai shrink-0" strokeWidth={1.5} />
          <span>Ask AI</span>
        </button>
      )}
    </div>
  );
}
