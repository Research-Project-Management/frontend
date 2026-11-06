'use client';

import React, { useRef, useCallback, useLayoutEffect } from 'react';
import { Page } from 'react-pdf';
import { Check, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { getCappedDevicePixelRatio, releaseCanvasMemory } from '@/shared/lib/pdfjs-worker';
import type { ReaderAnnotation, AnnotationRect, InlineTextInputState, AreaSelectionState, InkDrawingState } from '@/features/library/domain/types/reader.schema';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import { calculatePageAspectRatio } from '@/features/library/domain/reader-search-outline.domain';
import { PageAnnotationOverlay } from './PageAnnotationOverlay';
import JSZip from 'jszip';
import DOMPurify from 'dompurify';

export type { InlineTextInputState, AreaSelectionState, InkDrawingState };

export function DocumentPageSkeleton({
  width,
  height,
  animated = true,
}: {
  width?: number;
  height?: number;
  animated?: boolean;
}) {
  const w = width || 600;
  const h = height ? Math.round(height) : Math.round(w * 1.414);
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-8 bg-background select-none mx-auto',
        animated && 'animate-pulse',
      )}
      style={{ width: w, height: h }}
      aria-hidden="true"
    >
      <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
      <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
      <div className="space-y-2.5 flex-1">
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-11/12 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-4/5 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm mt-4" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-9/12 bg-muted rounded-sm" />
      </div>
      <div className="h-2 w-1/4 bg-muted rounded-sm self-center mt-auto" />
    </div>
  );
}

interface ViewerPageCanvasProps {
  pageNum: number;
  inWindow: boolean;
  effectivePageWidth: number;
  rotation: number;
  themeMode: 'normal' | 'sepia' | 'dark' | 'invert';
  activeTool: ReaderAnnotationTool;
  activeColor?: string;
  cachedDim?: { width: number; height: number };
  pdfDocument?: unknown;
  pageAnnotations?: ReaderAnnotation[];
  pulsingAnnotationId: string | null;
  inlineTextInput: InlineTextInputState | null;
  areaSelection: AreaSelectionState | null;
  inkDrawing?: InkDrawingState | null;
  customTextRenderer?: (textItem: { str: string }) => string;
  onRegisterPageRef: (pageNum: number, el: HTMLDivElement | null) => void;
  onPageDimensionsLoad: (pageNum: number, width: number, height: number) => void;
  onPageClick: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onPageMouseDown: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onPageMouseMove: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onPageMouseUp: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onInlineTextChange: (next: InlineTextInputState | null) => void;
  onSaveInlineText: () => void;
  onOpenAnnotationCard: (ann: ReaderAnnotation, el: HTMLElement) => void;
  onDeleteAnnotation?: (ann: ReaderAnnotation) => void;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: {
      color?: string;
      comment?: string;
      tags?: string[];
      rects?: AnnotationRect[];
    },
  ) => Promise<unknown>;
}

export const ViewerPageCanvas = React.memo(function ViewerPageCanvas({
  pageNum,
  inWindow,
  effectivePageWidth,
  rotation,
  themeMode,
  activeTool,
  activeColor,
  cachedDim,
  pdfDocument,
  pageAnnotations,
  pulsingAnnotationId,
  inlineTextInput,
  areaSelection,
  inkDrawing,
  customTextRenderer,
  onRegisterPageRef,
  onPageDimensionsLoad,
  onPageClick,
  onPageMouseDown,
  onPageMouseMove,
  onPageMouseUp,
  onInlineTextChange,
  onSaveInlineText,
  onOpenAnnotationCard,
  onDeleteAnnotation,
  onUpdateAnnotation,
}: ViewerPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setPageRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      onRegisterPageRef(pageNum, el);
    },
    [pageNum, onRegisterPageRef],
  );

  const handlePageLoadSuccess = useCallback(
    (page: { originalWidth?: number; originalHeight?: number; width?: number; height?: number }) => {
      const origW = page.originalWidth || page.width || 600;
      const origH = page.originalHeight || page.height || 848;
      onPageDimensionsLoad(pageNum, origW, origH);
    },
    [pageNum, onPageDimensionsLoad],
  );

  useLayoutEffect(() => {
    if (!inWindow) return;
    const container = containerRef.current;
    return () => {
      releaseCanvasMemory(container ?? containerRef.current);
    };
  }, [inWindow]);

  const aspectRatio = cachedDim
    ? calculatePageAspectRatio(cachedDim, rotation)
    : calculatePageAspectRatio({ width: 600, height: 848 }, rotation);
  const skeletonHeight = Math.round(effectivePageWidth * aspectRatio);

  return (
    <div
      data-page-num={pageNum}
      style={{ width: effectivePageWidth }}
      ref={setPageRef}
      onClick={(e) => onPageClick(e, pageNum)}
      onMouseDown={(e) => onPageMouseDown(e, pageNum)}
      onMouseMove={(e) => onPageMouseMove(e, pageNum)}
      onMouseUp={(e) => onPageMouseUp(e, pageNum)}
      className={cn(
        'bg-background overflow-hidden transition-all relative shrink-0 mx-auto min-h-[400px]',
        themeMode === 'dark' && 'brightness-90 contrast-95',
        themeMode === 'invert' && 'invert-[0.92] hue-rotate-180 contrast-90 brightness-95',
        themeMode === 'sepia' && 'sepia-[0.3] contrast-95 brightness-95',
        (activeTool === 'area' || activeTool === 'note' || activeTool === 'ink' || activeTool === 'eraser') &&
          'cursor-crosshair select-none',
        activeTool === 'text' && 'cursor-text',
      )}
    >
      {inWindow ? (
        <Page
          pdf={(pdfDocument as never) || undefined}
          pageNumber={pageNum}
          width={effectivePageWidth}
          rotate={rotation}
          canvasBackground="#fcfcfb"
          renderTextLayer={true}
          renderAnnotationLayer={true}
          devicePixelRatio={getCappedDevicePixelRatio(2)}
          onLoadSuccess={handlePageLoadSuccess}
          loading={
            <DocumentPageSkeleton
              width={effectivePageWidth}
              height={skeletonHeight}
              animated={true}
            />
          }
          customTextRenderer={customTextRenderer}
        />
      ) : (
        <div
          className="bg-background select-none mx-auto"
          style={{ width: effectivePageWidth, height: skeletonHeight }}
          aria-hidden="true"
        />
      )}

      {/* INLINE TEXT TOOL INPUT */}
      {inWindow && inlineTextInput && inlineTextInput.pageNum === pageNum && (
        <div
          className="absolute z-40 bg-background/95 backdrop-blur-xs border border-border shadow-md rounded-md p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${inlineTextInput.normX * 100}%`,
            top: `${inlineTextInput.normY * 100}%`,
            transform: 'translate(0, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            autoFocus
            aria-label="Text annotation"
            placeholder="Type text annotation..."
            value={inlineTextInput.text}
            onChange={(e) =>
              onInlineTextChange({ ...inlineTextInput, text: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveInlineText();
              else if (e.key === 'Escape') onInlineTextChange(null);
            }}
            className="text-12 px-2 py-1 rounded border border-border bg-muted text-foreground w-56 font-sans focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={onSaveInlineText}
            className="size-6 rounded-md text-primary hover:bg-primary/10 flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Save text (Enter)"
            aria-label="Save text"
          >
            <Check className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onInlineTextChange(null)}
            className="size-6 rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Cancel (Esc)"
            aria-label="Cancel"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ACTIVE AREA SELECTION MARQUEE */}
      {areaSelection?.active && areaSelection.pageNum === pageNum && (
        <div
          className="absolute pointer-events-none border-2 border-dashed rounded-sm z-30 transition-none"
          style={{
            borderColor: activeColor || '#ffd400',
            backgroundColor: activeColor ? `${activeColor}25` : '#ffd40025',
            left: Math.min(areaSelection.startX, areaSelection.currentX),
            top: Math.min(areaSelection.startY, areaSelection.currentY),
            width: Math.abs(areaSelection.currentX - areaSelection.startX),
            height: Math.abs(areaSelection.currentY - areaSelection.startY),
          }}
        />
      )}

      {/* ACTIVE INK DRAWING PREVIEW */}
      {inkDrawing?.active && inkDrawing.pageNum === pageNum && inkDrawing.currentPoints.length > 1 && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-30"
        >
          <path
            d={inkDrawing.currentPoints
              .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${(p.x * 100).toFixed(2)} ${(p.y * 100).toFixed(2)}`)
              .join(' ')}
            fill="none"
            stroke={activeColor || '#ffd400'}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* VISUAL HIGHLIGHTS / UNDERLINE / TEXT / STICKY NOTE / INK OVERLAY */}
      {inWindow && pageAnnotations && (
        <PageAnnotationOverlay
          annotations={pageAnnotations}
          pulsingAnnotationId={pulsingAnnotationId}
          isEraser={activeTool === 'eraser'}
          onSelectAnnotation={onOpenAnnotationCard}
          onDeleteAnnotation={onDeleteAnnotation}
          onUpdateAnnotation={onUpdateAnnotation}
        />
      )}
    </div>
  );
});

export interface EpubChapter {
  id: string;
  title: string;
  href: string;
  htmlContent: string;
}

export function sanitizeReaderHtml(rawHtml: string): string {
  const clean = DOMPurify.sanitize(rawHtml, {
    WHOLE_DOCUMENT: false,
    ADD_TAGS: ['article', 'section', 'header', 'footer', 'figure', 'figcaption'],
    ADD_ATTR: ['target', 'rel', 'id', 'name'],
    FORBID_TAGS: [
      'style',
      'form',
      'input',
      'button',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
      'base',
    ],
    FORBID_ATTR: ['onerror', 'onload'],
  });
  if (typeof DOMParser === 'undefined') return clean;
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = (a.getAttribute('href') || '').trim();
    if (/^(https?:|mailto:|tel:|\/\/)/i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    } else {
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }
  });
  return doc.body.innerHTML;
}

/**
 * Resolves a relative path inside an EPUB archive against a base directory.
 */
function resolveEpubPath(baseDir: string, relativeHref: string): string {
  const cleanHref = relativeHref.split('#')[0];
  if (!baseDir) return cleanHref.replace(/^\/+/, '');
  const parts = `${baseDir}/${cleanHref}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

/**
 * Unpacks an EPUB archive ArrayBuffer into ordered, sanitized HTML chapters.
 */
export async function unpackEpubArchiveChapters(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<EpubChapter[]> {
  const zip = await JSZip.loadAsync(buffer);
  if (signal?.aborted) return [];

  const containerFile = zip.file('META-INF/container.xml');
  let opfPath = '';
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    if (signal?.aborted) return [];
    const match = containerXml.match(/full-path=["']([^"']+)["']/i);
    if (match?.[1]) opfPath = match[1];
  }

  if (!opfPath) {
    const opfFiles = Object.keys(zip.files).filter((k) =>
      k.toLowerCase().endsWith('.opf'),
    );
    opfPath = opfFiles[0] || '';
  }

  if (!opfPath || !zip.file(opfPath)) {
    throw new Error('Invalid EPUB archive: missing package.opf manifest.');
  }

  const opfXml = await zip.file(opfPath)!.async('text');
  if (signal?.aborted) return [];
  const opfDir = opfPath.includes('/')
    ? opfPath.slice(0, opfPath.lastIndexOf('/'))
    : '';

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  const manifestMap = new Map<string, { href: string; mediaType: string }>();
  const itemEls = Array.from(opfDoc.getElementsByTagName('item'));
  for (const el of itemEls) {
    const id = el.getAttribute('id');
    const href = el.getAttribute('href');
    const mediaType = el.getAttribute('media-type') || '';
    if (id && href) {
      manifestMap.set(id, { href, mediaType });
    }
  }

  const itemrefEls = Array.from(opfDoc.getElementsByTagName('itemref'));
  const loadedChapters: EpubChapter[] = [];

  for (let i = 0; i < itemrefEls.length; i++) {
    if (signal?.aborted) return [];
    const idref = itemrefEls[i].getAttribute('idref');
    if (!idref) continue;
    const manifestEntry = manifestMap.get(idref);
    if (!manifestEntry) continue;

    const resolvedPath = resolveEpubPath(opfDir, manifestEntry.href);
    let decodedPath = resolvedPath;
    try {
      decodedPath = decodeURIComponent(resolvedPath);
    } catch {
      decodedPath = resolvedPath;
    }
    const chapterFile = zip.file(resolvedPath) || zip.file(decodedPath);
    if (!chapterFile) continue;

    const rawChapterHtml = await chapterFile.async('text');
    if (signal?.aborted) return [];
    const chapterDoc = parser.parseFromString(rawChapterHtml, 'text/html');
    const headingText =
      chapterDoc.querySelector('h1, h2, h3, title')?.textContent?.trim() ||
      `Section ${loadedChapters.length + 1}`;
    const bodyHtml = chapterDoc.body ? chapterDoc.body.innerHTML : rawChapterHtml;

    const sanitizedHtml = sanitizeReaderHtml(bodyHtml);
    if (sanitizedHtml.trim()) {
      loadedChapters.push({
        id: idref,
        title: headingText,
        href: resolvedPath,
        htmlContent: sanitizedHtml,
      });
    }
  }

  return loadedChapters;
}

/**
 * Pure helper to inject saved annotation highlights and search query marks into sanitized chapter/snapshot HTML.
 */
export function highlightReaderHtml(
  html: string,
  annotations: ReadonlyArray<ReaderAnnotation>,
  currentPageNum: number,
  isSearchOpen: boolean,
  searchQuery: string,
): string {
  if (!html || typeof DOMParser === 'undefined') return html;
  const pageQuotes = (annotations || [])
    .filter((a) => {
      const p = a.pageIndex !== undefined ? a.pageIndex + 1 : a.pageNumber || 1;
      return p === currentPageNum && Boolean(a.quoteText?.trim());
    })
    .map((a) => ({
      id: a.id,
      quote: a.quoteText!.trim(),
      color: a.color || '#ffd400',
    }));

  const q = isSearchOpen ? searchQuery.trim().slice(0, 120) : '';
  if (q.length < 2 && pageQuotes.length === 0) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  for (const item of pageQuotes) {
    if (item.quote.length < 2) continue;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const text = node.nodeValue || '';
      const idx = text.indexOf(item.quote);
      if (idx !== -1) {
        const frag = doc.createDocumentFragment();
        if (idx > 0) frag.appendChild(doc.createTextNode(text.slice(0, idx)));
        const mark = doc.createElement('mark');
        mark.setAttribute('data-annotation-id', item.id);
        mark.style.backgroundColor = `${item.color}55`;
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 2px';
        mark.textContent = item.quote;
        frag.appendChild(mark);
        const after = text.slice(idx + item.quote.length);
        if (after) frag.appendChild(doc.createTextNode(after));
        node.parentNode?.replaceChild(frag, node);
        break;
      }
      node = walker.nextNode() as Text | null;
    }
  }

  if (q.length < 2) return doc.body.innerHTML;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  let matchCount = 0;
  const MAX_MATCHES = 500;

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  for (const textNode of textNodes) {
    if (matchCount >= MAX_MATCHES) break;
    const text = textNode.nodeValue;
    if (!text) continue;
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (matchCount >= MAX_MATCHES) break;
      if (match.index > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)));
      }
      const mark = doc.createElement('mark');
      mark.className = 'bg-amber-300/70 text-foreground rounded px-0.5';
      mark.textContent = match[0];
      fragment.appendChild(mark);
      lastIndex = regex.lastIndex;
      matchCount++;
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return doc.body.innerHTML;
}
