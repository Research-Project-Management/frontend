'use client';

import { useState, useRef, useMemo, useCallback, type RefObject, useEffect } from 'react';
import { Columns2, ArrowUpRight, X, StickyNote, Check, Quote, Copy, Underline, MessageSquare, FileText } from 'lucide-react';
import type { DocumentFulltext, AnnotationRect, ReaderDocument, ReaderAnnotation } from '@/features/library/types/reader.types';
import { copyToClipboard, cn } from '@/shared/lib/utils';
import { formatInTextCitation } from '@/features/library/domain/reader.domain';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import { ANNOTATION_PALETTE_COLORS } from '@/features/library/ui/reader/ReaderToolbar';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/shared/components/ui/tooltip';

interface SmartHoverCardData {
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

interface TextSelectionToolbarProps {
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
  ) => Promise<unknown> | void;
  onSelectColor?: (colorHex: string) => void;
  onSelectTool?: (tool: ReaderAnnotationTool) => void;
  onOpenAnnotationCard?: (createdAnn: ReaderAnnotation, el?: HTMLElement) => void;
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
  onSelectColor,
  onSelectTool,
  onOpenAnnotationCard,
  onAddToNote,
  onAskAi,
  onClose,
}: TextSelectionToolbarProps) {
  const [copiedSelection, setCopiedSelection] = useState(false);
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

  const effectiveColor = activeColor || "#ffd400";

  return (
    <div
      className="pdf-floating-selection-menu absolute z-50 flex items-center gap-1 whitespace-nowrap w-max bg-popover text-popover-foreground p-1 rounded-lg border border-border shadow-raised-200 duration-150 select-none animate-in fade-in zoom-in-95 font-sans"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transform: "translateX(-50%)",
      }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* 1. All 8 Academic Colors (Zotero 7 standard: 1-click Highlight) */}
      {onAnnotate && (
        <div className="flex items-center gap-1 px-0.5 shrink-0">
          {ANNOTATION_PALETTE_COLORS.map((c) => {
            const isSelected = activeColor === c.hex;
            return (
              <Tooltip key={c.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Highlight in ${c.label}`}
                    onClick={async () => {
                      onSelectColor?.(c.hex);
                      await onAnnotate(
                        selectedText,
                        selectedPageNum,
                        c.hex,
                        selectedRects,
                        "highlight",
                      );
                      onClose();
                      window.getSelection()?.removeAllRanges();
                    }}
                    className={cn(
                      "size-3.5 rounded-full border border-border transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1 md:before:hidden hover:scale-125",
                      isSelected && "ring-2 ring-primary ring-offset-1 scale-110",
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="text-11">
                  Highlight in {c.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* 2. Underline (Zotero parity) */}
      {onAnnotate && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Underline selected text"
              onClick={async () => {
                onSelectTool?.("underline");
                await onAnnotate(
                  selectedText,
                  selectedPageNum,
                  effectiveColor,
                  selectedRects,
                  "underline",
                );
                onClose();
                window.getSelection()?.removeAllRanges();
              }}
              className="size-6 rounded-md flex items-center justify-center cursor-pointer transition-colors text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Underline className="size-3.5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-11">
            Underline
          </TooltipContent>
        </Tooltip>
      )}

      {/* 3. Add to Note (Zotero standard: send quote into Note editor) */}
      {onAddToNote && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Add to Note"
              onClick={() => {
                onAddToNote(selectedText, selectedPageNum || visiblePage);
                onClose();
                window.getSelection()?.removeAllRanges();
              }}
              className="size-6 rounded-md flex items-center justify-center cursor-pointer transition-colors text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <FileText className="size-3.5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-11">
            Add to Note
          </TooltipContent>
        </Tooltip>
      )}

      {/* 4. Copy Action */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Copy selected text"
            onClick={handleCopySelection}
            className="size-6 rounded-md flex items-center justify-center cursor-pointer transition-colors text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {copiedSelection ? (
              <Check className="size-3.5 text-primary" strokeWidth={1.5} />
            ) : (
              <Copy className="size-3.5 text-foreground" strokeWidth={1.5} />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="text-11">
          {copiedSelection ? "Copied" : "Copy"}
        </TooltipContent>
      </Tooltip>

      {/* 5. Ask AI Action */}
      {onAskAi && (
        <button
          type="button"
          aria-label="Ask AI about selected text"
          onClick={() => {
            onAskAi(selectedText, selectedPageNum || visiblePage);
            onClose();
            window.getSelection()?.removeAllRanges();
          }}
          className="h-6 px-2 rounded-md flex items-center gap-1 cursor-pointer transition-colors text-foreground hover:bg-muted text-11 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <img
            src="/Chat.svg"
            alt="AI Assistant"
            className="size-3.5 rounded-full object-cover shrink-0"
          />
          <span>Ask AI</span>
        </button>
      )}
    </div>
  );
}
