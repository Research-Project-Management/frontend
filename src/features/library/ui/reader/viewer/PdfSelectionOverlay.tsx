'use client';

import React, { useEffect, useState } from 'react';

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface InternalRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function mergeSelectionRects(rects: SelectionRect[]): SelectionRect[] {
  const valid: InternalRect[] = rects
    .filter((r) => r.width > 0.5 && r.height > 0.5)
    .map((r) => ({
      left: r.left,
      top: r.top,
      right: r.left + r.width,
      bottom: r.top + r.height,
      width: r.width,
      height: r.height,
    }));

  if (valid.length === 0) return [];

  // Group into visual lines
  valid.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: InternalRect[][] = [];

  for (const r of valid) {
    const rCenterY = (r.top + r.bottom) / 2;
    let placed = false;

    for (const line of lines) {
      const ref = line[0];
      const refCenterY = (ref.top + ref.bottom) / 2;
      const minHeight = Math.min(r.height, ref.height);
      const overlapY = Math.min(r.bottom, ref.bottom) - Math.max(r.top, ref.top);
      const centerDist = Math.abs(rCenterY - refCenterY);

      if (overlapY >= minHeight * 0.5 || centerDist <= minHeight * 0.55) {
        line.push(r);
        placed = true;
        break;
      }
    }

    if (!placed) {
      lines.push([r]);
    }
  }

  // Merge horizontally adjacent rects within each line
  const merged: InternalRect[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.left - b.left);
    let curr = { ...line[0] };

    for (let i = 1; i < line.length; i++) {
      const next = line[i];
      const maxH = Math.max(curr.height, next.height);
      const horizontalGap = next.left - curr.right;

      if (horizontalGap <= maxH * 1.5) {
        curr.left = Math.min(curr.left, next.left);
        curr.top = Math.min(curr.top, next.top);
        curr.right = Math.max(curr.right, next.right);
        curr.bottom = Math.max(curr.bottom, next.bottom);
        curr.width = curr.right - curr.left;
        curr.height = curr.bottom - curr.top;
      } else {
        merged.push(curr);
        curr = { ...next };
      }
    }
    merged.push(curr);
  }

  // Sort final merged rects and trim minor vertical overlap between consecutive lines
  merged.sort((a, b) => a.top - b.top || a.left - b.left);
  for (let i = 0; i < merged.length - 1; i++) {
    const curr = merged[i];
    const next = merged[i + 1];
    // Only trim if they are on different visual lines (not side-by-side columns)
    const minH = Math.min(curr.height, next.height);
    const centerDist = Math.abs((curr.top + curr.bottom) / 2 - (next.top + next.bottom) / 2);
    if (centerDist > minH * 0.55 && next.top < curr.bottom && next.bottom > curr.bottom) {
      const midY = (curr.bottom + next.top) / 2;
      curr.bottom = midY;
      curr.height = Math.max(0.5, curr.bottom - curr.top);
      next.top = midY;
      next.height = Math.max(0.5, next.bottom - next.top);
    }
  }

  return merged.map(({ left, top, width, height }) => ({
    left,
    top,
    width,
    height,
  }));
}

interface PdfSelectionOverlayProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function isInsidePdfTextLayer(node: Node | null): boolean {
  if (!node) return false;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  return Boolean(el?.closest('.react-pdf__Page__textLayer, .textLayer'));
}

export function PdfSelectionOverlay({
  scrollContainerRef,
}: PdfSelectionOverlayProps) {
  const [rects, setRects] = useState<SelectionRect[]>([]);

  useEffect(() => {
    let rafId: number | null = null;

    const updateSelection = () => {
      rafId = null;
      const container = scrollContainerRef.current;
      const selection = window.getSelection();

      if (
        !container ||
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0 ||
        !container.contains(selection.anchorNode) ||
        !isInsidePdfTextLayer(selection.anchorNode)
      ) {
        setRects((prev) => (prev.length === 0 ? prev : []));
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const containerRect = container.getBoundingClientRect();
        const rawRects = Array.from(range.getClientRects()).map((cr) => ({
          left: cr.left - containerRect.left + container.scrollLeft,
          top: cr.top - containerRect.top + container.scrollTop,
          width: cr.width,
          height: cr.height,
        }));
        const merged = mergeSelectionRects(rawRects);
        setRects(merged);
      } catch {
        setRects((prev) => (prev.length === 0 ? prev : []));
      }
    };

    const scheduleUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateSelection);
    };

    document.addEventListener('selectionchange', scheduleUpdate);
    return () => {
      document.removeEventListener('selectionchange', scheduleUpdate);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [scrollContainerRef]);

  if (rects.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-[5]"
    >
      {rects.map((r, idx) => (
        <div
          key={idx}
          className="absolute pointer-events-none"
          style={{
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            backgroundColor: 'color-mix(in oklch, var(--primary) 25%, transparent)',
          }}
        />
      ))}
    </div>
  );
}
