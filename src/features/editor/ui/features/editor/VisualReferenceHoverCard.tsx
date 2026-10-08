/**
 * VisualReferenceHoverCard.tsx
 *
 * Interactive In-Text Floating Hover Card & Quick Navigation for Citations and Cross-References in Visual Mode.
 * Location: `features/editor/ui/features/editor/VisualReferenceHoverCard.tsx`
 *
 * Capabilities:
 * 1. Citation Card (\cite{...}):
 *    - Resolves metadata via latexSymbolsIndex (Title, Authors, Journal, Year, DOI).
 *    - Displays retraction warning badge & alert for compromised literature.
 *    - 1-Click "Copy Citation", "Jump to .bib", and "Edit in Picker".
 *    - Self-healing unresolved citekey fallback with 1-click search.
 * 2. Cross-Reference Card (\ref{...}):
 *    - Resolves target Figure, Table, Equation, or Section in the Visual document.
 *    - Visual snapshot preview: Figure image thumbnail & caption, Table details, Section title.
 *    - 1-Click "Jump to Target" with smooth scrolling and synctex-highlight-pulse animation.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  FolderOpen,
  AlertTriangle,
  ArrowRight,
  Image as ImageIcon,
  Table as TableIcon,
  Sigma,
  Bookmark,
  FileText,
  Search,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  latexSymbolsIndex,
  type BibEntry,
} from '@/features/editor/domain/latex/latex-symbols-index';
import {
  formatShortAuthor,
  formatInTextCitationPreview,
} from '@/features/editor/domain/citation/citation-formatter';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

export interface VisualReferenceHoverCardProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

type HoverCardType = 'citation' | 'reference';

interface HoverCardState {
  type: HoverCardType;
  key: string;
  triggerEl: HTMLElement;
  position: { top: number; left: number; placement: 'top' | 'bottom' };
}

interface ResolvedRefTarget {
  element: HTMLElement;
  type: 'figure' | 'table' | 'equation' | 'section' | 'label';
  title: string;
  caption?: string;
  src?: string;
  line?: number;
}

export function VisualReferenceHoverCard({
  contentRef,
  containerRef,
  className,
}: VisualReferenceHoverCardProps) {
  const [activeCard, setActiveCard] = useState<HoverCardState | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const clearTimeouts = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  };

  const calculatePosition = (triggerEl: HTMLElement) => {
    const rect = triggerEl.getBoundingClientRect();
    const cardWidth = 360;
    const cardHeight = 180;
    const margin = 8;

    // Check vertical space (prefer above, fallback below)
    let placement: 'top' | 'bottom' = 'top';
    let top = rect.top - cardHeight - margin;

    if (top < 10) {
      placement = 'bottom';
      top = rect.bottom + margin;
    }

    // Align horizontally with trigger element, clamped to viewport
    let left = rect.left + rect.width / 2 - cardWidth / 2;
    if (left < 16) left = 16;
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }

    return { top, left, placement };
  };

  // Find target element in DOM for a given \ref label key
  const resolveReferenceTarget = useCallback(
    (labelKey: string): ResolvedRefTarget | null => {
      const contentEl = contentRef.current;
      if (!contentEl || !labelKey) return null;

      const encKey = encodeURIComponent(labelKey);

      // 1. Look for explicit figure with matching label
      const figureEl = contentEl.querySelector<HTMLElement>(
        `figure[data-label="${encKey}"], figure[data-label="${labelKey}"]`
      );
      if (figureEl) {
        const rawCaption = figureEl.getAttribute('data-caption') || '';
        const caption = rawCaption ? decodeURIComponent(rawCaption) : 'Figure';
        const rawSrc = figureEl.getAttribute('data-src') || '';
        const src = rawSrc ? decodeURIComponent(rawSrc) : '';
        const lineAttr = figureEl.getAttribute('data-line');
        const line = lineAttr ? parseInt(lineAttr, 10) : undefined;
        return {
          element: figureEl,
          type: 'figure',
          title: `Figure: ${caption}`,
          caption,
          src,
          line,
        };
      }

      // 2. Look for table with matching label
      const tableEl = contentEl.querySelector<HTMLElement>(
        `table[data-label="${encKey}"], table[data-label="${labelKey}"]`
      );
      if (tableEl) {
        const rawCaption = tableEl.getAttribute('data-caption') || '';
        const caption = rawCaption ? decodeURIComponent(rawCaption) : 'Table';
        const lineAttr = tableEl.getAttribute('data-line');
        const line = lineAttr ? parseInt(lineAttr, 10) : undefined;
        return {
          element: tableEl,
          type: 'table',
          title: `Table: ${caption}`,
          caption,
          line,
        };
      }

      // 3. Look for section heading containing label token
      const labelToken = contentEl.querySelector<HTMLElement>(
        `.latex-label-token[data-label="${encKey}"], .latex-label-token[data-label="${labelKey}"]`
      );
      if (labelToken) {
        const heading = labelToken.closest('h1, h2, h3, h4');
        if (heading) {
          const lineAttr = heading.getAttribute('data-line');
          const line = lineAttr ? parseInt(lineAttr, 10) : undefined;
          const headingText = heading.textContent?.replace(labelToken.textContent || '', '').trim() || 'Section';
          return {
            element: heading as HTMLElement,
            type: 'section',
            title: headingText,
            line,
          };
        }

        const mathBlock = labelToken.closest('.latex-math-block');
        if (mathBlock) {
          const lineAttr = mathBlock.getAttribute('data-line');
          const line = lineAttr ? parseInt(lineAttr, 10) : undefined;
          return {
            element: mathBlock as HTMLElement,
            type: 'equation',
            title: 'Equation',
            line,
          };
        }

        const block = (labelToken.closest('[data-line]') as HTMLElement) || labelToken;
        const lineAttr = block.getAttribute('data-line');
        const line = lineAttr ? parseInt(lineAttr, 10) : undefined;
        return {
          element: block,
          type: 'label',
          title: `Label: ${labelKey}`,
          line,
        };
      }

      // 4. Fallback to closest element matching prefix convention (fig:, tab:, eq:, sec:)
      if (labelKey.startsWith('fig:')) {
        const firstFig = contentEl.querySelector<HTMLElement>('figure');
        if (firstFig) {
          const rawCaption = firstFig.getAttribute('data-caption') || '';
          return {
            element: firstFig,
            type: 'figure',
            title: `Figure: ${rawCaption ? decodeURIComponent(rawCaption) : labelKey}`,
            caption: rawCaption ? decodeURIComponent(rawCaption) : undefined,
            src: firstFig.getAttribute('data-src') ? decodeURIComponent(firstFig.getAttribute('data-src')!) : undefined,
          };
        }
      }

      return null;
    },
    [contentRef]
  );

  // Jump to referenced target element in Visual Mode with smooth scroll and pulse highlight
  const handleJumpToTarget = useCallback((targetEl: HTMLElement) => {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    targetEl.classList.remove('synctex-highlight-pulse');
    void targetEl.offsetWidth; // trigger reflow
    targetEl.classList.add('synctex-highlight-pulse');

    setTimeout(() => {
      targetEl.classList.remove('synctex-highlight-pulse');
    }, 1800);

    setActiveCard(null);
  }, []);

  // Copy citation details to clipboard
  const handleCopyCitation = (entry?: BibEntry, citeKey?: string) => {
    if (!citeKey) return;
    const textToCopy = entry
      ? `${formatShortAuthor(entry.author)} (${entry.year || 'n.d.'}). ${entry.title || citeKey}. ${entry.journal || ''}`
      : `\\cite{${citeKey}}`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Open Citation Picker modal
  const handleEditCitation = (citeKey: string) => {
    editorCommandBus.dispatch({
      type: 'dialog:open',
      dialog: 'citation-picker',
      payload: { initialQuery: citeKey },
    });
    setActiveCard(null);
  };

  // Open source .bib file in workspace
  const handleOpenSourceBib = (sourceFile?: string) => {
    if (!sourceFile) return;
    editorCommandBus.dispatch({
      type: 'workspace:open-file',
      fileId: sourceFile,
      filePath: sourceFile,
    });
    setActiveCard(null);
  };

  // Attach hover listeners to citation and ref chips
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const citeChip = target.closest<HTMLElement>('.latex-citation-chip');
      const refChip = target.closest<HTMLElement>('.latex-ref-chip');

      if (citeChip) {
        const citeKey = citeChip.getAttribute('data-cite');
        if (citeKey) {
          clearTimeouts();
          hoverTimeoutRef.current = setTimeout(() => {
            const pos = calculatePosition(citeChip);
            setActiveCard({
              type: 'citation',
              key: citeKey,
              triggerEl: citeChip,
              position: pos,
            });
          }, 150);
          return;
        }
      }

      if (refChip) {
        const refKey = refChip.getAttribute('data-ref');
        if (refKey) {
          clearTimeouts();
          hoverTimeoutRef.current = setTimeout(() => {
            const pos = calculatePosition(refChip);
            setActiveCard({
              type: 'reference',
              key: refKey,
              triggerEl: refChip,
              position: pos,
            });
          }, 150);
          return;
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      // If moving into the hover card itself, do not close
      if (cardRef.current && related && cardRef.current.contains(related)) {
        return;
      }
      clearTimeouts();
      closeTimeoutRef.current = setTimeout(() => {
        setActiveCard(null);
      }, 250);
    };

    contentEl.addEventListener('mouseover', handleMouseOver);
    contentEl.addEventListener('mouseout', handleMouseOut);

    return () => {
      clearTimeouts();
      contentEl.removeEventListener('mouseover', handleMouseOver);
      contentEl.removeEventListener('mouseout', handleMouseOut);
    };
  }, [contentRef]);

  if (!activeCard) return null;

  // Render Citation Card
  if (activeCard.type === 'citation') {
    const citeKey = activeCard.key;
    const entry = latexSymbolsIndex.getCitationByKey(citeKey);
    const authorShort = entry?.author ? formatShortAuthor(entry.author) : '';
    const inTextPreview = entry ? formatInTextCitationPreview(entry) : '';

    return (
      <div
        ref={cardRef}
        onMouseEnter={clearTimeouts}
        onMouseLeave={() => {
          closeTimeoutRef.current = setTimeout(() => setActiveCard(null), 200);
        }}
        className={cn(
          'visual-hover-card fixed z-50 w-96 p-4 rounded-xl border border-border/80 shadow-2xl bg-card/95 backdrop-blur-md text-foreground text-xs leading-relaxed select-text animate-in fade-in-0 zoom-in-95 duration-150',
          className
        )}
        style={{
          top: `${activeCard.position.top}px`,
          left: `${activeCard.position.left}px`,
        }}
        data-testid="visual-citation-hover-card"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-border/50">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-primary/10 text-primary border border-primary/20 uppercase font-sans">
              {entry?.type ? entry.type.toUpperCase() : 'CITATION'}
            </span>
            <span className="font-mono text-[11px] font-semibold text-foreground/90 bg-muted/80 px-1.5 py-0.5 rounded">
              @{citeKey}
            </span>
          </div>

          {entry?.sourceFile && (
            <button
              type="button"
              onClick={() => handleOpenSourceBib(entry.sourceFile)}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer font-sans"
              title={`Open ${entry.sourceFile}`}
            >
              <FolderOpen className="size-3 text-muted-foreground" />
              <span className="truncate max-w-[120px] font-mono text-[10px]">
                {entry.sourceFile}
              </span>
            </button>
          )}
        </div>

        {/* Retraction Alert Banner */}
        {entry?.isRetracted && (
          <div className="mb-2.5 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-[11px] flex items-start gap-1.5 font-sans leading-normal">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-destructive" />
            <div>
              <span className="font-bold">CẢNH BÁO BÀI BÁO BỊ THU HỒI / RETRACTED:</span>
              <p className="opacity-90 mt-0.5">
                {entry.retractionReason || 'Ấn phẩm này đã bị nhà xuất bản rút lại.'}
              </p>
            </div>
          </div>
        )}

        {/* Card Body */}
        {entry ? (
          <div className="space-y-1.5 font-sans">
            {/* Title */}
            <p className="font-semibold text-foreground text-[13px] leading-snug line-clamp-2">
              {entry.title || 'Untitled Publication'}
            </p>

            {/* Authors */}
            {authorShort && (
              <p className="text-muted-foreground text-[11px]">
                <span className="font-medium text-foreground/80">Authors:</span> {authorShort}
              </p>
            )}

            {/* Venue & Year */}
            {(entry.journal || entry.year) && (
              <p className="text-muted-foreground text-[11px] flex items-center gap-2">
                {entry.journal && <span className="italic truncate">{entry.journal}</span>}
                {entry.year && (
                  <span className="px-1 py-0.2 rounded bg-muted font-mono text-[10px]">
                    {entry.year}
                  </span>
                )}
              </p>
            )}

            {/* DOI Link */}
            {entry.doi && (
              <a
                href={`https://doi.org/${entry.doi}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-mono pt-0.5"
              >
                <span>doi:{entry.doi}</span>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        ) : (
          <div className="py-1 space-y-1 text-muted-foreground font-sans">
            <div className="flex items-center gap-1.5 text-amber-500 font-medium">
              <AlertTriangle className="size-3.5" />
              <span>Unresolved Citation Key</span>
            </div>
            <p className="text-[11px] leading-normal">
              Khóa trích dẫn <code className="font-mono text-foreground font-semibold">@{citeKey}</code> chưa được định nghĩa trong file .bib của dự án.
            </p>
          </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="flex items-center justify-between gap-1.5 pt-2.5 mt-2.5 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleCopyCitation(entry, citeKey)}
            className="h-7 px-2 text-[11px] gap-1 cursor-pointer font-sans"
          >
            {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </Button>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleEditCitation(citeKey)}
              className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer font-sans"
            >
              <Search className="size-3 text-muted-foreground" />
              <span>{entry ? 'Edit Citation' : 'Search & Add'}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render Cross-Reference Card (\ref{...})
  const labelKey = activeCard.key;
  const target = resolveReferenceTarget(labelKey);

  return (
    <div
      ref={cardRef}
      onMouseEnter={clearTimeouts}
      onMouseLeave={() => {
        closeTimeoutRef.current = setTimeout(() => setActiveCard(null), 200);
      }}
      className={cn(
        'visual-hover-card fixed z-50 w-80 p-3.5 rounded-xl border border-border/80 shadow-2xl bg-card/95 backdrop-blur-md text-foreground text-xs leading-relaxed select-text animate-in fade-in-0 zoom-in-95 duration-150',
        className
      )}
      style={{
        top: `${activeCard.position.top}px`,
        left: `${activeCard.position.left}px`,
      }}
      data-testid="visual-reference-hover-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          {target?.type === 'figure' ? (
            <ImageIcon className="size-3.5 text-primary" />
          ) : target?.type === 'table' ? (
            <TableIcon className="size-3.5 text-primary" />
          ) : target?.type === 'equation' ? (
            <Sigma className="size-3.5 text-primary" />
          ) : target?.type === 'section' ? (
            <Bookmark className="size-3.5 text-primary" />
          ) : (
            <FileText className="size-3.5 text-primary" />
          )}
          <span className="font-semibold text-[11px] uppercase tracking-wide font-sans text-foreground/90">
            {target?.type || 'Reference'}
          </span>
        </div>
        <span className="font-mono text-[10px] bg-muted/80 px-1.5 py-0.5 rounded text-muted-foreground">
          {labelKey}
        </span>
      </div>

      {/* Target Content Snapshot */}
      {target ? (
        <div className="space-y-2 font-sans">
          {/* Thumbnail preview if figure */}
          {target.type === 'figure' && target.src && (
            <div className="w-full h-24 bg-muted/30 rounded-lg border border-border/40 overflow-hidden flex items-center justify-center p-1">
              <img
                src={target.src}
                alt={target.caption || labelKey}
                className="max-h-full max-w-full object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Title / Caption */}
          <p className="font-medium text-foreground text-[12px] leading-snug line-clamp-2">
            {target.title}
          </p>

          {target.line && (
            <p className="text-[10px] text-muted-foreground font-mono">
              Source line: L{target.line}
            </p>
          )}

          {/* Jump Action */}
          <div className="pt-2 border-t border-border/50 flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => handleJumpToTarget(target.element)}
              className="h-7 px-3 text-[11px] gap-1.5 cursor-pointer font-sans bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              <span>Jump to Target</span>
              <ArrowRight className="size-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-1 space-y-1 text-muted-foreground font-sans">
          <div className="flex items-center gap-1.5 text-amber-500 font-medium">
            <AlertTriangle className="size-3.5" />
            <span>Target Not Found</span>
          </div>
          <p className="text-[11px] leading-normal">
            Không tìm thấy hình ảnh, bảng hoặc nhãn có tên <code className="font-mono text-foreground font-semibold">\{labelKey}\</code> trong tài liệu này.
          </p>
        </div>
      )}
    </div>
  );
}

export default VisualReferenceHoverCard;
