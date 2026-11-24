'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { isPdfDocumentValid } from '@/shared/lib/pdfjs-worker';

interface PdfJsAnnotation {
  id?: string;
  subtype?: string;
  url?: string;
  unsafeUrl?: string;
  dest?: string | unknown[] | null;
  rect?: [number, number, number, number];
}

interface PdfJsViewport {
  width: number;
  height: number;
  convertToViewportRectangle: (rect: [number, number, number, number]) => [number, number, number, number];
}

interface PdfJsPage {
  getViewport: (params: { scale: number; rotation?: number }) => PdfJsViewport;
  getAnnotations: (params?: { intent?: string }) => Promise<PdfJsAnnotation[]>;
}

interface PdfJsDocument {
  getPage: (pageNum: number) => Promise<PdfJsPage>;
  getDestination?: (dest: string) => Promise<unknown[] | null>;
  getPageIndex?: (ref: unknown) => Promise<number>;
}

interface NormalizedLinkOverlay {
  id: string;
  type: 'external-link' | 'internal-link';
  url?: string;
  dest?: string | unknown[];
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export interface PagePdfLinkOverlayProps {
  pdfDocument?: unknown;
  pageNum: number;
  rotation?: number;
  disabled?: boolean;
  onHoverExternalLink?: (params: { url: string; rect: DOMRect }) => void;
  onLeaveLink?: () => void;
  onNavigatePage?: (pageNumber: number) => void;
}

/**
 * Zotero-style PDF link overlay extracted directly via `pdfPage.getAnnotations({ intent: 'display' })`
 * (mirrors `zotero/reader/src/pdf/pdf-page-data.mjs`).
 * Supports both `external-link` (arXiv stamps, DOIs, URLs -> LinkPopup + open in new tab)
 * and `internal-link` (in-text citations, TOC, figures, tables -> jump to destination page).
 */
export const PagePdfLinkOverlay = React.memo(function PagePdfLinkOverlay({
  pdfDocument,
  pageNum,
  rotation = 0,
  disabled = false,
  onHoverExternalLink,
  onLeaveLink,
  onNavigatePage,
}: PagePdfLinkOverlayProps) {
  const [links, setLinks] = useState<NormalizedLinkOverlay[]>([]);

  useEffect(() => {
    if (!pdfDocument || !isPdfDocumentValid(pdfDocument)) {
      setLinks([]);
      return;
    }

    let cancelled = false;
    const doc = pdfDocument as PdfJsDocument;

    void (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1, rotation });
        if (viewport.width <= 0 || viewport.height <= 0) return;

        const annotations = await page.getAnnotations({ intent: 'display' });
        if (cancelled || !Array.isArray(annotations)) return;

        const extracted: NormalizedLinkOverlay[] = [];
        for (let i = 0; i < annotations.length; i++) {
          const ann = annotations[i];
          if (!ann || !Array.isArray(ann.rect) || ann.rect.length !== 4) continue;

          const url = typeof ann.url === 'string' && ann.url.trim() ? ann.url.trim() : undefined;
          const hasDest = ann.dest !== undefined && ann.dest !== null;
          if (!url && !hasDest) continue;

          const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle(ann.rect);
          const minX = Math.min(vx1, vx2);
          const maxX = Math.max(vx1, vx2);
          const minY = Math.min(vy1, vy2);
          const maxY = Math.max(vy1, vy2);

          const leftPct = Math.max(0, (minX / viewport.width) * 100);
          const topPct = Math.max(0, (minY / viewport.height) * 100);
          const widthPct = Math.min(100 - leftPct, ((maxX - minX) / viewport.width) * 100);
          const heightPct = Math.min(100 - topPct, ((maxY - minY) / viewport.height) * 100);

          if (widthPct <= 0.05 || heightPct <= 0.05) continue;

          extracted.push({
            id: ann.id || `link-${pageNum}-${i}`,
            type: url ? 'external-link' : 'internal-link',
            url,
            dest: url ? undefined : (ann.dest as string | unknown[]),
            leftPct,
            topPct,
            widthPct,
            heightPct,
          });
        }

        if (!cancelled) {
          setLinks(extracted);
        }
      } catch {
        if (!cancelled) setLinks([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNum, rotation]);

  const handleInternalLinkClick = useCallback(
    async (e: React.MouseEvent, dest: string | unknown[] | undefined) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dest || !pdfDocument || !isPdfDocumentValid(pdfDocument) || !onNavigatePage) return;

      const doc = pdfDocument as PdfJsDocument;
      try {
        const explicitDest =
          typeof dest === 'string' && typeof doc.getDestination === 'function'
            ? await doc.getDestination(dest)
            : Array.isArray(dest)
              ? dest
              : null;

        if (!Array.isArray(explicitDest) || explicitDest.length === 0) return;
        const destRef = explicitDest[0];
        let pageIndex: number | null = null;
        if (typeof destRef === 'number') {
          pageIndex = destRef;
        } else if (destRef && typeof destRef === 'object' && typeof doc.getPageIndex === 'function') {
          pageIndex = await doc.getPageIndex(destRef);
        }

        if (typeof pageIndex === 'number' && pageIndex >= 0) {
          onNavigatePage(pageIndex + 1);
        }
      } catch {
        // Ignore unresolvable PDF destinations
      }
    },
    [pdfDocument, onNavigatePage],
  );

  if (disabled || links.length === 0) return null;

  return (
    <div
      aria-hidden="false"
      className="absolute inset-0 pointer-events-none z-[4]"
    >
      {links.map((link) => {
        const style: React.CSSProperties = {
          left: `${link.leftPct}%`,
          top: `${link.topPct}%`,
          width: `${link.widthPct}%`,
          height: `${link.heightPct}%`,
        };

        if (link.type === 'external-link' && link.url) {
          return (
            <a
              key={link.id}
              data-pdf-external-link="true"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={style}
              onMouseEnter={(e) => {
                onHoverExternalLink?.({
                  url: link.url!,
                  rect: e.currentTarget.getBoundingClientRect(),
                });
              }}
              onMouseLeave={() => onLeaveLink?.()}
              onClick={(e) => e.stopPropagation()}
              className="absolute pointer-events-auto rounded-[2px] transition-colors duration-100 hover:bg-blue-500/15 cursor-pointer"
              aria-label={`Open link ${link.url}`}
            />
          );
        }

        return (
          <a
            key={link.id}
            href="#"
            style={style}
            onClick={(e) => void handleInternalLinkClick(e, link.dest)}
            onMouseLeave={() => onLeaveLink?.()}
            className="absolute pointer-events-auto rounded-[2px] transition-colors duration-100 hover:bg-blue-500/15 cursor-pointer"
            aria-label="Jump to internal document link"
          />
        );
      })}
    </div>
  );
});
